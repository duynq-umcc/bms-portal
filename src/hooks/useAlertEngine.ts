import { useEffect } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  limit,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/contexts/AuthContext'
import { createNotification } from '@/utils/createNotification'
import { scanAndCreateExpiryAlerts } from '@/utils/fifoEngine'
import { checkAndCreatePmWorkOrders, markOverduePmWorkOrders } from '@/utils/pmEngine'
import type { Vendor } from '@/types/firestore'

type NotificationType = 'workOrder' | 'inventory' | 'device' | 'document' | 'system'
type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

interface NotificationPayload {
  title: string
  body: string
  type: NotificationType
  link: string
  priority: NotificationPriority
}

const TAG = '[AlertEngine]'

// P3.3: Separate intervals per check criticality
// Critical: stale work orders (>48h open) — business risk if missed
const CRITICAL_CHECK_MS = 15 * 60 * 1000   // 15 min
// High: low stock, device overdue, critical expiry, PM engine, missing import docs
const HIGH_CHECK_MS = 30 * 60 * 1000        // 30 min
// Normal: document expiry, disposal overdue, SLA contract renewals
const NORMAL_CHECK_MS = 60 * 60 * 1000      // 60 min

// ── Helpers ────────────────────────────────────────────────────────────────────

function log(msg: string, ...args: unknown[]) {
  console.log(TAG, msg, ...args)
}

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return 'N/A'
  return ts.toDate().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function hoursAgo(ts: Timestamp | undefined): number {
  if (!ts) return 0
  return Math.round((Date.now() - ts.toDate().getTime()) / 3_600_000)
}

function sevenDaysFromNow(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d
}

function thirtyDaysFromNow(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d
}

// ── Dedup ──────────────────────────────────────────────────────────────────────

async function isDuplicate(uid: string, link: string): Promise<boolean> {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - 24)

  const q = query(
    collection(db, `notifications/${uid}/items`),
    where('link', '==', link),
    where('isRead', '==', false),
    where('createdAt', '>=', Timestamp.fromDate(cutoff)),
    limit(1),
  )

  const snap = await getDocs(q)
  return !snap.empty
}

// ── Create notification ────────────────────────────────────────────────────────

async function createNotif(uid: string, payload: NotificationPayload): Promise<void> {
  if (await isDuplicate(uid, payload.link)) return
  await createNotification(uid, {
    title: payload.title,
    body: payload.body,
    type: payload.type,
    link: payload.link,
    priority: payload.priority,
  })
}

// ── Check 1 — Low stock inventory ─────────────────────────────────────────────

async function checkLowStock(uid: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'inventory'), where('quantity', '<=', 10)),
  )

  const lowStock = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as { id: string; name: string; quantity: number; unit: string; minQuantity: number }))
    .filter((item) => item.quantity <= (item.minQuantity ?? 0) * 0.5)

  log(`Low stock: ${lowStock.length} items found`)

  for (const item of lowStock) {
    await createNotif(uid, {
      title: `Cần đặt thêm: ${item.name}`,
      body: `Tồn: ${item.quantity} ${item.unit} — Định mức: ${item.minQuantity}`,
      type: 'inventory',
      link: `/warehouse?highlight=${item.id}`,
      priority: item.quantity === 0 ? 'urgent' : 'high',
    })
  }
}

// ── Check 2 — Device service overdue ──────────────────────────────────────────

async function checkDeviceOverdue(uid: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'medicalDevices'), where('status', '==', 'operational')),
  )

  const cutoff = sevenDaysFromNow()
  const overdue = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as { id: string; name: string; nextService?: Timestamp }))
    .filter((device) => {
      if (!device.nextService) return false
      return device.nextService.toDate() < cutoff
    })

  log(`Device overdue: ${overdue.length} found`)

  for (const device of overdue) {
    await createNotif(uid, {
      title: `Thiết bị cần bảo trì: ${device.name}`,
      body: `Hạn bảo trì: ${formatDate(device.nextService)}`,
      type: 'device',
      link: `/medical-devices?id=${device.id}`,
      priority: 'high',
    })
  }
}

// ── Check 3 — Document expiry ─────────────────────────────────────────────────

async function checkDocumentExpiry(uid: string): Promise<void> {
  const cutoff = thirtyDaysFromNow()

  const snap = await getDocs(
    query(collection(db, 'compliance'), where('nextDate', '<=', Timestamp.fromDate(cutoff))),
  )

  const expiring = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as { id: string; item: string; expiryDate?: Timestamp; nextDate?: Timestamp }))
    .filter((c) => {
      const ts = c.nextDate
      if (!ts) return false
      return ts.toDate() > new Date() // only future-dated
    })

  log(`Document expiry: ${expiring.length} found`)

  for (const c of expiring) {
    await createNotif(uid, {
      title: `Chứng từ sắp hết hạn: ${c.item}`,
      body: `Hết hạn: ${formatDate(c.nextDate)}`,
      type: 'document',
      link: `/compliance?id=${c.id}`,
      priority: 'medium',
    })
  }
}

// ── Check 4 — Stale work orders ───────────────────────────────────────────────

async function checkStaleWorkOrders(uid: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'workOrders'), where('status', '==', 'open')),
  )

  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - 48)

  const stale = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as { id: string; title: string; createdAt?: Timestamp; location: string }))
    .filter((wo) => {
      if (!wo.createdAt) return false
      return wo.createdAt.toDate() < cutoff
    })

  log(`Stale work orders: ${stale.length} found`)

  for (const wo of stale) {
    await createNotif(uid, {
      title: `Work order chưa xử lý: ${wo.title}`,
      body: `Đã mở ${hoursAgo(wo.createdAt)} giờ — ${wo.location}`,
      type: 'workOrder',
      link: `/maintenance?id=${wo.id}`,
      priority: 'high',
    })
  }
}

// ── Check 7 — Pending disposal approvals overdue ────────────────────────────────

async function checkPendingDisposals(uid: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'disposalRequests'), where('status', '==', 'approved')),
  )

  const overdue = snap.docs.filter((d) => {
    const data = d.data() as { updatedAt?: Timestamp }
    if (!data.updatedAt) return false
    const daysSinceApproval = Math.floor(
      (Date.now() - data.updatedAt.toMillis()) / 86_400_000,
    )
    return daysSinceApproval > 30
  })

  log(`Pending disposals overdue (>30d): ${overdue.length} found`)

  for (const d of overdue) {
    const data = d.data() as { assetName: string }
    await createNotif(uid, {
      title: `${data.assetName} chưa thực hiện thanh lý`,
      body: 'Đã được HĐ phê duyệt > 30 ngày nhưng chưa thực hiện',
      type: 'system',
      link: `/assets?tab=disposal&req=${d.id}`,
      priority: 'medium',
    })
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

// ── Check 8 — Contract/SLA renewal ─────────────────────────────────────────────

async function checkContractRenewals(uid: string): Promise<void> {
  // P1.2 fix: filter to active vendors first, then iterate embedded contracts
  // (contracts are embedded in vendor docs; Firestore has no subcollection index)
  const cutoff = thirtyDaysFromNow()
  const snap = await getDocs(
    query(collection(db, 'vendors'), where('status', '==', 'active')),
  )

  const upcoming: { vendorName: string; contractTitle: string; endDate: Date }[] = []

  for (const vendorDoc of snap.docs) {
    const vendor = vendorDoc.data() as Vendor
    if (!vendor.contracts?.length) continue
    for (const contract of vendor.contracts) {
      if (!contract.endDate) continue
      const endDate = contract.endDate.toDate()
      if (endDate > new Date() && endDate <= cutoff) {
        upcoming.push({ vendorName: vendor.name, contractTitle: contract.title, endDate })
      }
    }
  }

  log(`Contract renewals: ${upcoming.length} found`)

  for (const c of upcoming) {
    await createNotif(uid, {
      title: `Hợp đồng sắp hết hạn: ${c.contractTitle}`,
      body: `Nhà cung cấp: ${c.vendorName} — hết hạn ${c.endDate.toLocaleDateString('vi-VN')}`,
      type: 'system',
      link: `/vendors`,
      priority: 'medium',
    })
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAlertEngine() {
  const { user } = useAuth()
  const role = user?.role as string | undefined

  useEffect(() => {
    if (!user || !['admin', 'manager'].includes(role ?? '')) return

    // P3.3: Critical checks — every 15 min
    const runCriticalChecks = async () => {
      try {
        await checkStaleWorkOrders(user.uid)
      } catch (err) {
        console.error(TAG, 'Critical check failed:', err)
      }
    }
    runCriticalChecks()
    const criticalInterval = setInterval(runCriticalChecks, CRITICAL_CHECK_MS)

    // P3.3: High-priority checks — every 30 min
    const runHighChecks = async () => {
      try {
        await checkLowStock(user.uid)
        await checkDeviceOverdue(user.uid)
        const created = await scanAndCreateExpiryAlerts()
        log(`Expiry scan: ${created} alerts created`)
        await checkCriticalExpiryNotifications(user.uid)
        await checkMissingImportDocs(user.uid)
        const pm = await checkAndCreatePmWorkOrders()
        log(`PM engine: ${pm.created} WOs created, ${pm.overdue} overdue${pm.skipped > 0 ? ` (${pm.skipped} skipped)` : ''}`)
        const overdue = await markOverduePmWorkOrders()
        if (overdue > 0) log(`PM overdue marked: ${overdue}`)
      } catch (err) {
        console.error(TAG, 'High check failed:', err)
      }
    }
    runHighChecks()
    const highInterval = setInterval(runHighChecks, HIGH_CHECK_MS)

    // P3.3: Normal checks — every 60 min
    const runNormalChecks = async () => {
      try {
        await checkDocumentExpiry(user.uid)
        await checkPendingDisposals(user.uid)
        await checkContractRenewals(user.uid)
      } catch (err) {
        console.error(TAG, 'Normal check failed:', err)
      }
    }
    runNormalChecks()
    const normalInterval = setInterval(runNormalChecks, NORMAL_CHECK_MS)

    return () => {
      clearInterval(criticalInterval)
      clearInterval(highInterval)
      clearInterval(normalInterval)
    }
  }, [user, role])
}

// ── Check 5 — Missing import docs ─────────────────────────────────────────────

async function checkMissingImportDocs(uid: string): Promise<void> {
  // P2.1 fix: query inventoryTransactions directly instead of collectionGroup
  // composite index required: inventoryTransactions(type ASC, legalDocsStatus ASC, date ASC)
  const snap = await getDocs(
    query(
      collection(db, 'inventoryTransactions'),
      where('type', '==', 'import'),
    ),
  )

  const cutoffMs = Date.now() - 3 * 86_400_000

  const missing = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as { id: string; type: string; legalDocsStatus?: string; date?: Timestamp; itemName?: string }))
    .filter(
      (t) =>
        t.type === 'import' &&
        t.legalDocsStatus !== 'complete' &&
        t.legalDocsStatus !== 'verified' &&
        (t.date?.toMillis() ?? 0) < cutoffMs
    )

  log(`Missing import docs: ${missing.length} found`)

  for (const t of missing) {
    await createNotif(uid, {
      title: `Thiếu hồ sơ nhập kho: ${t.itemName ?? t.id ?? 'N/A'}`,
      body: `Phiếu nhập ${t.id} — chưa đủ chứng từ pháp lý > 3 ngày`,
      type: 'inventory',
      link: `/warehouse?tab=imports&highlight=${t.id}`,
      priority: 'high',
    })
  }
}

// ── Check 6 — Critical expiry notifications ────────────────────────────────────

async function checkCriticalExpiryNotifications(uid: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, 'expiryAlerts'),
      where('alertLevel', '==', 'critical'),
      where('isRead', '==', false),
    ),
  )

  log(`Critical expiry alerts: ${snap.size} found`)

  for (const alertDoc of snap.docs) {
    const a = alertDoc.data()
    await createNotif(uid, {
      title: `Hàng sắp hết hạn: ${a.itemName}`,
      body: `Lô ${a.batchNumber} — còn ${a.daysRemaining} ngày (${formatDate(a.expiryDate)})`,
      type: 'inventory',
      link: `/warehouse?tab=expiry&item=${a.itemId}`,
      priority: a.daysRemaining <= 7 ? 'urgent' : 'high',
    })
  }
}
