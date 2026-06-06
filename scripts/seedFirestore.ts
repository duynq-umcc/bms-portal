import admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Initialize Admin SDK with service account ────────────────────────────

const serviceAccount = JSON.parse(readFileSync(resolve(__dirname, '..', 'service-account.json'), 'utf-8'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

// ─── Period helpers ────────────────────────────────────────────────────────────

function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getPrevPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

// ─── KPI computation (Admin SDK) ──────────────────────────────────────────────

async function computeTechnicianKpiAdmin(uid: string, period: string): Promise<Record<string, unknown>> {
  const [year, month] = period.split('-').map(Number)
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)
  const startTs = admin.firestore.Timestamp.fromDate(startOfMonth)
  const endTs = admin.firestore.Timestamp.fromDate(endOfMonth)

  // WO Stats
  const allWoSnap = await db.collection('workOrders')
    .where('assignedTo', '==', uid)
    .where('createdAt', '>=', startTs)
    .where('createdAt', '<=', endTs)
    .get()

  const completedWoSnap = await db.collection('workOrders')
    .where('assignedTo', '==', uid)
    .where('status', '==', 'completed')
    .where('completedAt', '>=', startTs)
    .where('completedAt', '<=', endTs)
    .get()

  const pmWoSnap = await db.collection('pmWorkOrders')
    .where('assignedTo', '==', uid)
    .where('dueDate', '>=', startTs)
    .where('dueDate', '<=', endTs)
    .get()

  const allWos = allWoSnap.docs.map((d) => d.data())
  const completedWos = completedWoSnap.docs.map((d) => d.data())
  const pmWos = pmWoSnap.docs.map((d) => d.data())

  const completedOnTime = completedWos.filter((wo) => {
    if (!wo.dueDate || !wo.completedAt) return false
    return wo.completedAt.toMillis() <= wo.dueDate.toMillis()
  }).length

  const completionHours = completedWos
    .filter((wo) => wo.completedAt && wo.createdAt)
    .map((wo) => (wo.completedAt.toMillis() - wo.createdAt.toMillis()) / 3_600_000)
  const avgCompletionHours = completionHours.length > 0
    ? Math.round(completionHours.reduce((a, b) => a + b, 0) / completionHours.length)
    : 0

  // Response Stats
  const responseTimes = allWos
    .filter((wo) => wo.startedAt && wo.createdAt)
    .map((wo) => (wo.startedAt.toMillis() - wo.createdAt.toMillis()) / 60_000)
    .filter((t) => t > 0 && t < 10_000)
  const avgResponseMinutes = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0

  // Incident Stats
  const incidentSnap = await db.collection('incidents')
    .where('reportedBy', '==', uid)
    .where('createdAt', '>=', startTs)
    .where('createdAt', '<=', endTs)
    .get()
  const incidents = incidentSnap.docs.map((d) => d.data())

  let recurringCount = 0
  for (let i = 0; i < incidents.length; i++) {
    const current = incidents[i]
    const thirtyDaysBefore = current.createdAt.toMillis() - 30 * 86_400_000
    const isRecurring = incidents.some((prev, j) =>
      j !== i &&
      prev.location === current.location &&
      prev.category === current.category &&
      prev.createdAt.toMillis() > thirtyDaysBefore &&
      prev.createdAt.toMillis() < current.createdAt.toMillis(),
    )
    if (isRecurring) recurringCount++
  }

  // PM Stats
  const pmCompleted = pmWos.filter((wo) => wo.status === 'completed').length
  const pmOnTime = pmWos.filter((wo) =>
    wo.status === 'completed' && wo.completedAt && wo.dueDate &&
    wo.completedAt.toMillis() <= wo.dueDate.toMillis(),
  ).length

  const woStats = {
    totalAssigned: allWos.length,
    totalCompleted: completedWos.length,
    completedOnTime,
    overdue: allWos.filter((wo) =>
      wo.status !== 'completed' && wo.status !== 'cancelled' && wo.dueDate &&
      wo.dueDate.toMillis() < Date.now(),
    ).length,
    inProgress: allWos.filter((wo) => wo.status === 'in_progress').length,
    completionRate: allWos.length > 0
      ? Math.round((completedWos.length / allWos.length) * 100) : 0,
    onTimeRate: completedWos.length > 0
      ? Math.round((completedOnTime / completedWos.length) * 100) : 0,
    avgCompletionHours,
  }

  const responseStats = {
    avgResponseMinutes,
    fastestResponseMinutes: responseTimes.length > 0 ? Math.round(Math.min(...responseTimes)) : 0,
    slowestResponseMinutes: responseTimes.length > 0 ? Math.round(Math.max(...responseTimes)) : 0,
    totalResponseSamples: responseTimes.length,
  }

  const incidentStats = {
    totalIncidentsReported: incidents.length,
    recurringIncidents: recurringCount,
    recurringRate: incidents.length > 0
      ? Math.round((recurringCount / incidents.length) * 100) : 0,
    criticalIncidents: incidents.filter((i) => i.severity === 'high' || i.severity === 'critical').length,
  }

  const pmStats = {
    pmScheduled: pmWos.length,
    pmCompleted,
    pmOnTime,
    pmCompletionRate: pmWos.length > 0
      ? Math.round((pmCompleted / pmWos.length) * 100) : 0,
  }

  // Score
  const score =
    (woStats.completionRate / 100) * 30 +
    (woStats.onTimeRate / 100) * 25 +
    Math.max(0, 1 - (avgResponseMinutes - 60) / 180) * 20 +
    (pmStats.pmCompletionRate / 100) * 15 +
    Math.max(0, 1 - incidentStats.recurringRate / 100) * 10
  const scoreRounded = Math.round(Math.min(100, score))

  const grade =
    scoreRounded >= 90 ? 'A' :
    scoreRounded >= 75 ? 'B' :
    scoreRounded >= 60 ? 'C' :
    scoreRounded >= 45 ? 'D' : 'F'

  // User info
  const userDoc = await db.collection('users').doc(uid).get()
  const userData = userDoc.data() ?? {}

  return {
    uid,
    period,
    name: userData.displayName ?? uid,
    department: userData.dept ?? '',
    role: userData.role ?? '',
    woStats,
    responseStats,
    incidentStats,
    pmStats,
    score: scoreRounded,
    grade,
    trend: 'stable',
    calculatedAt: admin.firestore.Timestamp.now(),
    previousPeriodScore: null,
  }
}

async function seedTechnicianKpi(): Promise<void> {
  const period = getCurrentPeriod()
  const usersSnap = await db.collection('users')
    .where('role', 'in', ['technician', 'manager'])
    .get()

  if (usersSnap.empty) {
    console.log('  No technicians/managers found — skipping technicianKpi.')
    return
  }

  let seeded = 0
  for (const userDoc of usersSnap.docs) {
    try {
      const kpi = await computeTechnicianKpiAdmin(userDoc.id, period)
      await db.collection('technicianKpi').doc(userDoc.id).set(kpi)
      seeded++
    } catch (err) {
      console.error(`  Failed for uid=${userDoc.id}:`, err)
    }
  }
  console.log(`  ✅ technicianKpi: seeded for ${seeded} users (period=${period})`)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function addDaysFn(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function addMonthsFn(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

function computeNextDueDate(frequency: { type: string; intervalDays: number; dayOfMonth?: number | null }): admin.firestore.Timestamp {
  const now = new Date()
  switch (frequency.type) {
    case 'monthly': {
      const next = addMonthsFn(now, 1)
      if (frequency.dayOfMonth) {
        next.setDate(frequency.dayOfMonth)
      }
      return admin.firestore.Timestamp.fromDate(next)
    }
    case 'quarterly':
      return admin.firestore.Timestamp.fromDate(addDaysFn(now, 90))
    case 'biannual':
      return admin.firestore.Timestamp.fromDate(addDaysFn(now, 180))
    case 'annual':
      return admin.firestore.Timestamp.fromDate(addDaysFn(now, 365))
    default:
      return admin.firestore.Timestamp.fromDate(addDaysFn(now, frequency.intervalDays))
  }
}

// ─── Seed PM Schedules ────────────────────────────────────────────────────

async function seedPmSchedules(): Promise<void> {
  const pmTemplates = [
    {
      name: 'BT định kỳ AHU-3 (ICU)',
      assetType: 'system' as const,
      assetName: 'AHU-3 — ICU + Phòng mổ',
      assetCode: 'AHU-003',
      department: 'Kỹ thuật',
      location: 'Tầng 3 — ICU',
      frequency: { type: 'monthly' as const, intervalDays: 30, dayOfMonth: 15 },
      estimatedDuration: 120,
      tasks: [
        { description: 'Vệ sinh bộ lọc sơ cấp G4', estimatedMinutes: 20, requiresSpecialist: false, toolsRequired: ['Máy hút bụi', 'Bàn chải'] },
        { description: 'Vệ sinh bộ lọc trung cấp F7/F9', estimatedMinutes: 30, requiresSpecialist: false, toolsRequired: ['Máy hút bụi'] },
        { description: 'Kiểm tra belt quạt — căng chỉnh', estimatedMinutes: 20, requiresSpecialist: false, toolsRequired: ['Thước đo độ căng'] },
        { description: 'Kiểm tra motor quạt — nhiệt độ, độ rung', estimatedMinutes: 15, requiresSpecialist: false, toolsRequired: ['Đồng hồ đo nhiệt'] },
        { description: 'Kiểm tra coil lạnh — vệ sinh nếu cần', estimatedMinutes: 20, requiresSpecialist: true, toolsRequired: ['Hóa chất vệ sinh coil'] },
        { description: 'Ghi chép chỉ số nhiệt độ cấp/hồi', estimatedMinutes: 5, requiresSpecialist: false, toolsRequired: ['Nhiệt kế'] },
        { description: 'Chụp ảnh trước và sau bảo trì', estimatedMinutes: 10, requiresSpecialist: false, toolsRequired: ['Điện thoại/camera'] },
      ],
      autoCreateWO: true,
      autoCreateDaysBefore: 7,
    },
    {
      name: 'BT định kỳ Máy phát dự phòng',
      assetType: 'system' as const,
      assetName: 'Máy phát Caterpillar 500KVA',
      assetCode: 'GEN-001',
      department: 'Kỹ thuật',
      location: 'Tầng hầm — Phòng máy',
      frequency: { type: 'monthly' as const, intervalDays: 30, dayOfMonth: 20 },
      estimatedDuration: 90,
      tasks: [
        { description: 'Kiểm tra mức dầu động cơ', estimatedMinutes: 10, requiresSpecialist: false, toolsRequired: ['Giẻ lau'] },
        { description: 'Kiểm tra mức nước làm mát', estimatedMinutes: 5, requiresSpecialist: false, toolsRequired: [] },
        { description: 'Kiểm tra acqui — điện áp, nước cất', estimatedMinutes: 15, requiresSpecialist: false, toolsRequired: ['Đồng hồ VOM'] },
        { description: 'Chạy thử không tải 15 phút', estimatedMinutes: 20, requiresSpecialist: false, toolsRequired: [] },
        { description: 'Ghi chỉ số đồng hồ giờ chạy, nhiên liệu', estimatedMinutes: 5, requiresSpecialist: false, toolsRequired: [] },
        { description: 'Kiểm tra rò rỉ dầu/nhiên liệu', estimatedMinutes: 10, requiresSpecialist: false, toolsRequired: [] },
      ],
      autoCreateWO: true,
      autoCreateDaysBefore: 7,
    },
    {
      name: 'BT định kỳ Thang máy S1 (Quý)',
      assetType: 'equipment' as const,
      assetName: 'Thang máy S1 — Khu A',
      assetCode: 'LIFT-S1',
      department: 'Kỹ thuật',
      location: 'Tầng B1→T5',
      frequency: { type: 'quarterly' as const, intervalDays: 90, monthsOfYear: [1, 4, 7, 10] },
      estimatedDuration: 180,
      requiresContractor: true,
      tasks: [
        { description: 'Bôi trơn ray dẫn hướng', estimatedMinutes: 30, requiresSpecialist: true, toolsRequired: ['Dầu bôi trơn chuyên dụng'] },
        { description: 'Kiểm tra cáp tải, cáp hạn chế tốc độ', estimatedMinutes: 40, requiresSpecialist: true, toolsRequired: [] },
        { description: 'Kiểm tra phanh điện từ', estimatedMinutes: 30, requiresSpecialist: true, toolsRequired: [] },
        { description: 'Test các công tắc an toàn', estimatedMinutes: 30, requiresSpecialist: true, toolsRequired: [] },
        { description: 'Vệ sinh hố pit, buồng máy', estimatedMinutes: 20, requiresSpecialist: false, toolsRequired: ['Chổi, xẻng'] },
        { description: 'Ghi biên bản bảo trì', estimatedMinutes: 10, requiresSpecialist: false, toolsRequired: [] },
      ],
      autoCreateWO: true,
      autoCreateDaysBefore: 14,
    },
    {
      name: 'Kiểm định nồi hơi hàng năm',
      assetType: 'equipment' as const,
      assetName: 'Nồi hơi hấp tiệt khuẩn',
      assetCode: 'BOIL-001',
      department: 'Kỹ thuật',
      location: 'Tầng 1 — Tiệt khuẩn',
      frequency: { type: 'annual' as const, intervalDays: 365, monthsOfYear: [1] },
      estimatedDuration: 480,
      requiresContractor: true,
      tasks: [
        { description: 'Kiểm tra van an toàn — áp suất mở van', estimatedMinutes: 60, requiresSpecialist: true, toolsRequired: [] },
        { description: 'Kiểm tra thiết bị đo lường (đồng hồ áp, nhiệt)', estimatedMinutes: 60, requiresSpecialist: true, toolsRequired: [] },
        { description: 'Kiểm tra bên trong nồi hơi (ăn mòn, cáu cặn)', estimatedMinutes: 120, requiresSpecialist: true, toolsRequired: [] },
        { description: 'Thử thủy lực (1.5x áp suất làm việc)', estimatedMinutes: 120, requiresSpecialist: true, toolsRequired: [] },
        { description: 'Cấp chứng chỉ kiểm định', estimatedMinutes: 60, requiresSpecialist: true, toolsRequired: [] },
      ],
      autoCreateWO: true,
      autoCreateDaysBefore: 30,
    },
    {
      name: 'BT định kỳ Máy X-quang DR (Nửa năm)',
      assetType: 'device' as const,
      assetName: 'Máy X-quang kỹ thuật số DR',
      assetCode: 'XRAY-DR-01',
      department: 'Chẩn đoán hình ảnh',
      location: 'Tầng 2 — Phòng X-quang',
      frequency: { type: 'biannual' as const, intervalDays: 180, monthsOfYear: [1, 7] },
      estimatedDuration: 240,
      requiresContractor: true,
      tasks: [
        { description: 'Calibration detector panel', estimatedMinutes: 60, requiresSpecialist: true, toolsRequired: ['Phantom calibration'] },
        { description: 'Kiểm tra ống phát tia X — độ lọc HVL', estimatedMinutes: 60, requiresSpecialist: true, toolsRequired: ['Dosimeter'] },
        { description: 'Kiểm tra hệ thống cơ khí — bàn, collimator', estimatedMinutes: 40, requiresSpecialist: true, toolsRequired: [] },
        { description: 'Update firmware nếu có bản mới', estimatedMinutes: 40, requiresSpecialist: true, toolsRequired: ['Laptop service'] },
        { description: 'Ghi biên bản + cập nhật lý lịch máy', estimatedMinutes: 20, requiresSpecialist: false, toolsRequired: [] },
      ],
      autoCreateWO: true,
      autoCreateDaysBefore: 14,
    },
  ]

  for (const template of pmTemplates) {
    const nextDueDate = computeNextDueDate(template.frequency)

    await db.collection('pmSchedules').add({
      ...template,
      assetId: '',
      tasks: template.tasks.map((t, i) => ({
        ...t,
        id: `task-${i + 1}`,
      })),
      isActive: true,
      lastExecutedDate: null,
      nextDueDate,
      requiresContractor: template.requiresContractor ?? false,
      contractorId: null,
      assignedTo: null,
      assignedToName: null,
      createdBy: 'seed',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  console.log(`✅ pmSchedules: ${pmTemplates.length} seeded`)
}

// ─── Check if already seeded ───────────────────────────────────────────────

async function isAlreadySeeded(): Promise<boolean> {
  const snap = await db.collection('pmSchedules').limit(1).get()
  return !snap.empty
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Starting Firestore seed...\n')

  const alreadySeeded = await isAlreadySeeded()
  if (alreadySeeded) {
    console.log('pmSchedules already seeded — skipping.')
  } else {
    await seedPmSchedules()
  }

  await seedTechnicianKpi()

  console.log('\nSeed complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
