import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  Timestamp,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { db } from '@/firebase/config'

export interface BatchInfo {
  batchNumber: string
  importDate: Timestamp
  expiryDate: Timestamp | null
  quantity: number
  daysRemaining: number
  alertLevel: 'notice' | 'warning' | 'critical' | null
}

export interface FIFOWarning {
  type: 'fifo_violation'
  message: string
  oldestBatch: BatchInfo
  selectedBatch: string
}

export interface FIFOValidation {
  valid: boolean
  warning: FIFOWarning | null
}

export function computeDaysRemaining(expiryDate: Timestamp): number {
  return Math.floor((expiryDate.toMillis() - Date.now()) / 86400000)
}

export function getAlertLevel(
  days: number,
): 'notice' | 'warning' | 'critical' | null {
  if (days > 180) return null
  if (days > 90) return 'notice'
  if (days > 30) return 'warning'
  return 'critical'
}

function docToBatch(doc: QuerySnapshot<DocumentData>['docs'][number]): BatchInfo {
  const d = doc.data()
  const expiryDate: Timestamp | null = d.expiryDate ?? null
  const daysRemaining =
    expiryDate !== null ? computeDaysRemaining(expiryDate) : 9999
  return {
    batchNumber: d.batchNumber ?? '—',
    importDate: d.importDate ?? Timestamp.now(),
    expiryDate,
    quantity: d.quantity ?? 0,
    daysRemaining,
    alertLevel: expiryDate !== null ? getAlertLevel(daysRemaining) : null,
  }
}

export async function getBatchesFIFO(itemId: string): Promise<BatchInfo[]> {
  const q = query(
    collection(db, 'inventoryTransactions'),
    where('itemId', '==', itemId),
    where('type', '==', 'import'),
    orderBy('importDate', 'asc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(docToBatch).filter((b) => b.quantity > 0)
}

export async function getBatchesFEFO(itemId: string): Promise<BatchInfo[]> {
  const q = query(
    collection(db, 'inventoryTransactions'),
    where('itemId', '==', itemId),
    where('type', '==', 'import'),
    orderBy('expiryDate', 'asc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(docToBatch).filter((b) => b.quantity > 0)
}

function formatDate(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export interface ExportBatchLine {
  batchNumber: string
  importDate: Timestamp
  expiryDate: Timestamp | null
  deductQty: number
  remainingAfter: number
}

export interface ExportPreview {
  lines: ExportBatchLine[]
  totalAvailable: number
  isValid: boolean
  errorMessage?: string
}

export async function getExportBatchPreview(
  itemId: string,
  qty: number,
  method: 'fifo' | 'fefo' = 'fifo',
  currentBatchNumber?: string,
): Promise<ExportPreview> {
  const batches = method === 'fifo'
    ? await getBatchesFIFO(itemId)
    : await getBatchesFEFO(itemId)

  const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0)

  // If currentBatchNumber provided, validate against that batch first (UI-level check)
  if (currentBatchNumber) {
    const currentBatch = batches.find((b) => b.batchNumber === currentBatchNumber)
    if (currentBatch && qty > currentBatch.quantity) {
      return {
        lines: [],
        totalAvailable,
        isValid: false,
        errorMessage: `Lô ${currentBatchNumber} chỉ còn ${currentBatch.quantity}. Vui lòng chọn lô khác hoặc giảm số lượng.`,
      }
    }
  }

  if (qty > totalAvailable) {
    return {
      lines: [],
      totalAvailable,
      isValid: false,
      errorMessage: `Tổng tồn kho không đủ: cần ${qty}, còn ${totalAvailable}`,
    }
  }

  const lines: ExportBatchLine[] = []
  let remaining = qty
  for (const batch of batches) {
    if (remaining <= 0) break
    const deduct = Math.min(batch.quantity, remaining)
    lines.push({
      batchNumber: batch.batchNumber,
      importDate: batch.importDate,
      expiryDate: batch.expiryDate,
      deductQty: deduct,
      remainingAfter: batch.quantity - deduct,
    })
    remaining -= deduct
  }

  return {
    lines,
    totalAvailable,
    isValid: remaining <= 0,
    errorMessage: remaining > 0
      ? `Chỉ còn ${totalAvailable} trong kho`
      : undefined,
  }
}

export async function validateFIFOExport(
  itemId: string,
  selectedBatch: string,
  _qty: number,
): Promise<FIFOValidation> {
  const batches = await getBatchesFIFO(itemId)
  const oldest = batches[0]

  if (!oldest) return { valid: true, warning: null }
  if (oldest.batchNumber === selectedBatch)
    return { valid: true, warning: null }

  return {
    valid: false,
    warning: {
      type: 'fifo_violation',
      message: `Lô ${selectedBatch} không phải lô cũ nhất.\nLô nhập trước: ${oldest.batchNumber}\n(nhập ${formatDate(oldest.importDate)}).\nXuất theo FIFO để tránh hàng tồn lâu.`,
      oldestBatch: oldest,
      selectedBatch,
    },
  }
}

export async function scanAndCreateExpiryAlerts(): Promise<number> {
  const now = Date.now()
  const cutoff180 = Timestamp.fromMillis(now + 180 * 86400000)

  const snap = await getDocs(
    query(
      collection(db, 'inventory'),
      where('expiryDate', '<=', cutoff180),
      where('expiryDate', '!=', null),
    ),
  )

  let created = 0
  for (const docSnap of snap.docs) {
    const item = { id: docSnap.id, ...docSnap.data() } as {
      id: string
      name: string
      expiryDate: Timestamp
      batchNumber?: string
    }
    if (!item.expiryDate) continue

    const days = computeDaysRemaining(item.expiryDate)
    const level = getAlertLevel(days)
    if (!level) continue

    const existing = await getDocs(
      query(
        collection(db, 'expiryAlerts'),
        where('itemId', '==', item.id),
        where('isRead', '==', false),
        where('alertLevel', '==', level),
        where('resolvedAt', '==', null),
      ),
    )
    if (!existing.empty) continue

    await addDoc(collection(db, 'expiryAlerts'), {
      itemId: item.id,
      itemName: item.name,
      batchNumber: item.batchNumber ?? '—',
      expiryDate: item.expiryDate,
      daysRemaining: days,
      alertLevel: level,
      isRead: false,
      createdAt: Timestamp.now(),
      resolvedAt: null,
    })
    created++
  }
  return created
}
