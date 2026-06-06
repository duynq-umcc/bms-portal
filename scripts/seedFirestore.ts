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

  console.log('\nSeed complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
