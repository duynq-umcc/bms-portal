/**
 * BMS Hospital – Firestore seed script
 * Uses casual for random utilities and Vietnamese static data arrays.
 *
 * Run:  npm run seed
 *   or:  npx ts-node --project scripts/tsconfig.json scripts/seedFirestore.ts
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS (service-account key) or
 * FIREBASE_PROJECT_ID env var. For emulators use: npm run seed:emulator
 */

import admin from 'firebase-admin'
import casual from 'casual'

// Seed for reproducible data across runs
casual.seed(12345)

// ──────────────────────────────────────────────────────────────────────────────
// Vietnamese static data helpers
// ──────────────────────────────────────────────────────────────────────────────

const VI_FIRST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Đặng', 'Vũ', 'Ngô', 'Trịnh', 'Bùi', 'Đỗ', 'Lý', 'Phan', 'Cao', 'Võ', 'Vương', 'Trương', 'Nguyễn', 'Lê', 'Chu']
const VI_LAST_NAMES = ['Văn', 'Thị', 'Hữu', 'Đình', 'Minh', 'Quang', 'Hồng', 'Thanh', 'An', 'Thu', 'Lan', 'Hương', 'Yến', 'Mai', 'Oanh', 'Phương', 'Hạnh', 'Nhung', 'Tuấn', 'Long', 'Hải', 'Đức', 'Nam', 'Tùng', 'Khoa', 'Thắng', 'Hùng', 'Hà', 'Thịnh', 'Đạt', 'Thành']
const VI_PERSON_NAMES = ['Nguyễn Văn Minh', 'Trần Thị Hương', 'Lê Quang Đức', 'Phạm Thị Mai', 'Hoàng Văn Tùng', 'Đặng Thị Lan', 'Vũ Văn Hùng', 'Ngô Thị Thu', 'Trịnh Văn Nam', 'Bùi Thị Hà', 'Đỗ Minh Tuấn', 'Lý Thị Yến', 'Phạm Văn Long', 'Trần Văn An', 'Nguyễn Thị Oanh', 'Vương Đình Khoa', 'Trương Thị Ngọc', 'Nguyễn Hữu Thắng', 'Lê Thị Hồng Nhung', 'Đinh Công Minh', 'Bùi Đức Thịnh', 'Trịnh Thị Phương', 'Phan Văn Hải', 'Hoàng Thị Lan', 'Nguyễn Thành Đạt', 'Cao Thị Mai', 'Võ Hoàng Long', 'Lê Thị Hạnh', 'Chu Văn Tuấn', 'Đặng Thị Quỳnh', 'Nguyễn Văn Đức', 'Trần Văn Hùng', 'Lê Thị Lan', 'Phạm Văn Thành', 'Hoàng Thị Mai', 'Vũ Văn Nam', 'Đặng Văn Tùng', 'Bùi Thị Oanh', 'Ngô Văn Minh', 'Lý Thị Hà']
const VI_COMPANIES = ['Công ty TNHH Kỹ thuật Điện ABC', 'Công ty CP Thiết bị Y tế MedTech', 'Dịch vụ Bảo trì HVAC Việt Nam', 'Công ty PCCC Phú Thành', 'Công ty TNHH Điện Lạnh Nam Phát', 'Công ty Vật tư Y tế Phúc An', 'Trung tâm Bảo trì Thiết bị Y tế Sài Gòn', 'Công ty TNHH Giải pháp CNTT Gia Minh', 'Công ty CP Nước sạch Sài Gòn', 'Công ty Bảo vệ An Ninh Thành Phố', 'Công ty TNHH Vệ sinh Môi trường Xanh', 'Công ty TNHH PCCC Thăng Long', 'Công ty CP Thiết bị IT Việt Nam', 'Dịch vụ Thẩm định An toàn Điện', 'Công ty TNHH Xây dựng Hồng Phát', 'Trung tâm Kiểm định Kỹ thuật An toàn', 'Công ty TNHH Gas Công nghiệp Việt', 'Dịch vụ Thẩm định Thiết bị Y tế', 'Công ty TNHH Môi trường Xanh Việt', 'Công ty TNHH Thiết bị Cơ điện Thịnh Phát', 'Công ty CP Vật tư Xây dựng Phú Vinh', 'Công ty TNHH Thương mại Đại Phú', 'Công ty TNHH Dịch vụ Kỹ thuật Hùng Vương']
const VI_STREETS = ['Nguyễn Trãi', 'Lê Lợi', 'Điện Biên Phủ', ' Pasteur', 'Nguyễn Văn Linh', 'Trần Hưng Đạo', 'Lý Thường Kiệt', 'Cách Mạng Tháng 8', 'Phan Chu Trinh', 'Võ Văn Tần', 'Nguyễn Thị Minh Khai', 'Bà Huyện Thanh Quan', 'Trương Định', 'Đặng Huy Trứ', 'Lê Quý Đôn', 'Hùng Vương', 'Phan Đăng Lưu', 'Trần Quốc Toản', 'Nguyễn Tri Phương', 'Bạch Đằng']
const VI_CITIES = ['Quận 1', 'Quận 3', 'Quận 5', 'Quận 10', 'Quận Bình Thạnh', 'Quận Gò Vấp', 'Quận Phú Nhuận', 'Quận Tân Bình', 'Quận Tân Phú', 'Quận Bình Tân', 'Thủ Đức', 'Hóc Môn', 'Củ Chi', 'Quận 7', 'Quận 4']

function viName(): string {
  return casual.random_element(VI_PERSON_NAMES)
}

function viCompany(): string {
  return casual.random_element(VI_COMPANIES)
}

function viStreet(): string {
  const num = casual.integer(1, 500)
  const street = casual.random_element(VI_STREETS)
  return `${num} Đường ${street}`
}

function viCity(): string {
  return casual.random_element(VI_CITIES)
}

// ──────────────────────────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────────────────────────

if (!admin.apps || !admin.apps.length) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
  if (emulatorHost) {
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost
    admin.initializeApp({ projectId: 'demo-project' })
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID ?? 'bms-portal-firestore'
    admin.initializeApp({ projectId })
  }
}

const db = admin.firestore()
db.settings({ ignoreUndefinedProperties: true })

const TS = admin.firestore.Timestamp
const now = new Date()

function ts(daysFromNow = 0): admin.firestore.Timestamp {
  const d = new Date(now)
  d.setDate(d.getDate() + daysFromNow)
  return TS.fromDate(d)
}

const LOCATIONS = [
  'Tầng 1 – Lobby', 'Tầng 2 – Khoa Khám bệnh', 'Tầng 3 – Khoa Nội trú',
  'Tầng 4 – Khoa Tim mạch', 'Tầng 5 – Khoa Ngoại', 'Tầng hầm – Phòng máy',
  'ICU – Khoa Hồi sức tích cực', 'Khoa Cấp cứu', 'Khoa Nhi',
  'Khoa Sản', 'Khoa Mắt', 'Khoa Nội soi', 'Khoa Xét nghiệm',
  'Khoa Chẩn đoán hình ảnh', 'Phòng mổ 1', 'Phòng mổ 2', 'Phòng Server',
  'Phòng hành chính', 'Hội trường tầng 4', 'Khoa Dược',
]

const BMS_SYSTEMS = [
  'Hệ thống điện chính', 'Hệ thống nước sạch', 'Hệ thống HVAC',
  'Hệ thống khí O2', 'Máy phát điện dự phòng', 'Hệ thống PCCC',
  'Hệ thống BMS tòa nhà', 'Hệ thống camera CCTV', 'Thang máy A',
  'Thang máy B', 'Hệ thống xử lý nước thải', 'Hệ thống wifi',
]

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
const WO_STATUSES = ['pending', 'in_progress', 'completed'] as const
const INCIDENT_STATUSES = ['open', 'investigating', 'closed'] as const
const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
const INCIDENT_TYPES = [
  'power_outage', 'water_leak', 'equipment_failure', 'fire',
  'security', 'medical', 'gas_leak', 'environmental',
] as const

const TECHNICIAN_UIDS = ['staff-03', 'staff-09', 'staff-11', 'staff-16', 'staff-23', 'staff-29']
const MEDICAL_STAFF_UIDS = ['staff-04', 'staff-10', 'staff-15', 'staff-19', 'staff-24', 'staff-30']

// ──────────────────────────────────────────────────────────────────────────────
// Seed functions
// ──────────────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🔄 Starting Firestore seed…')

  // Seed org/users (always written, not batched with the 7 collections)
  await seedStaff()
  await seedInfra()

  // 7 collections × 20 records each – all in a single batch
  const batch = db.batch()

  for (const doc of seedWorkOrders(20)) batch.set(db.collection('workOrders').doc(), doc)
  for (const doc of seedDevices(20)) batch.set(db.collection('devices').doc(), doc)
  for (const doc of seedInventory(20)) batch.set(db.collection('inventory').doc(), doc)
  for (const doc of seedSystemReadings(20)) batch.set(db.collection('systemReadings').doc(), doc)
  for (const doc of seedIncidents(20)) batch.set(db.collection('incidents').doc(), doc)
  for (const doc of seedVendors(20)) batch.set(db.collection('vendors').doc(), doc)
  for (const doc of seedAssets(20)) batch.set(db.collection('assets').doc(), doc)

  await batch.commit()
  console.log('✅ Seed completed')
  console.log('   Collections: workOrders(20) | devices(20) | inventory(20) | systemReadings(20) | incidents(20) | vendors(20) | assets(20)')
}

async function seedStaff() {
  const staff = [
    { uid: 'staff-01', displayName: 'Nguyễn Văn Minh', email: 'minh.nv@bms-hospital.vn', dept: 'admin', role: 'Giám đốc', phone: '0901234001', managerId: undefined as string | undefined, status: 'active' },
    { uid: 'staff-02', displayName: 'Trần Thị Hương', email: 'huong.tt@bms-hospital.vn', dept: 'it', role: 'Trưởng phòng IT', phone: '0901234002', managerId: 'staff-01', status: 'active' },
    { uid: 'staff-03', displayName: 'Lê Quang Đức', email: 'duc.lq@bms-hospital.vn', dept: 'electrical', role: 'Kỹ sư điện', phone: '0901234003', managerId: 'staff-01', status: 'active' },
    { uid: 'staff-04', displayName: 'Phạm Thị Mai', email: 'mai.pt@bms-hospital.vn', dept: 'medical', role: 'Trưởng phòng Y tế', phone: '0901234004', managerId: 'staff-01', status: 'active' },
    { uid: 'staff-05', displayName: 'Hoàng Văn Tùng', email: 'tung.hv@bms-hospital.vn', dept: 'warehouse', role: 'Thủ kho', phone: '0901234005', managerId: 'staff-01', status: 'active' },
    { uid: 'staff-06', displayName: 'Đặng Thị Lan', email: 'lan.dt@bms-hospital.vn', dept: 'compliance', role: 'Chuyên viên compliance', phone: '0901234006', managerId: 'staff-01', status: 'active' },
    { uid: 'staff-07', displayName: 'Vũ Văn Hùng', email: 'hung.vv@bms-hospital.vn', dept: 'civil', role: 'Kỹ sư xây dựng', phone: '0901234007', managerId: 'staff-01', status: 'active' },
    { uid: 'staff-08', displayName: 'Ngô Thị Thu', email: 'thu.nt@bms-hospital.vn', dept: 'it', role: 'Kỹ thuật viên', phone: '0901234008', managerId: 'staff-02', status: 'active' },
    { uid: 'staff-09', displayName: 'Trịnh Văn Nam', email: 'nam.tv@bms-hospital.vn', dept: 'electrical', role: 'Kỹ thuật viên điện', phone: '0901234009', managerId: 'staff-03', status: 'active' },
    { uid: 'staff-10', displayName: 'Bùi Thị Hà', email: 'ha.bt@bms-hospital.vn', dept: 'medical', role: 'Nhân viên y tế', phone: '0901234010', managerId: 'staff-04', status: 'active' },
    { uid: 'staff-11', displayName: 'Đỗ Minh Tuấn', email: 'tuan.dm@bms-hospital.vn', dept: 'electrical', role: 'Kỹ thuật viên điện', phone: '0901234011', managerId: 'staff-03', status: 'active' },
    { uid: 'staff-12', displayName: 'Lý Thị Yến', email: 'yen.lt@bms-hospital.vn', dept: 'warehouse', role: 'Nhân viên kho', phone: '0901234012', managerId: 'staff-05', status: 'active' },
    { uid: 'staff-13', displayName: 'Phạm Văn Long', email: 'long.pv@bms-hospital.vn', dept: 'civil', role: 'Công nhân xây dựng', phone: '0901234013', managerId: 'staff-07', status: 'active' },
    { uid: 'staff-14', displayName: 'Trần Văn An', email: 'an.tv2@bms-hospital.vn', dept: 'it', role: 'Quản trị mạng', phone: '0901234014', managerId: 'staff-02', status: 'active' },
    { uid: 'staff-15', displayName: 'Nguyễn Thị Oanh', email: 'oanh.nt@bms-hospital.vn', dept: 'medical', role: 'Kỹ thuật viên thiết bị', phone: '0901234015', managerId: 'staff-04', status: 'active' },
    { uid: 'staff-16', displayName: 'Vương Đình Khoa', email: 'khoa.vd@bms-hospital.vn', dept: 'electrical', role: 'Kỹ thuật viên điện', phone: '0901234016', managerId: 'staff-03', status: 'active' },
    { uid: 'staff-17', displayName: 'Trương Thị Ngọc', email: 'ngoc.tt2@bms-hospital.vn', dept: 'it', role: 'Lập trình viên', phone: '0901234017', managerId: 'staff-02', status: 'active' },
    { uid: 'staff-18', displayName: 'Nguyễn Hữu Thắng', email: 'thang.nh@bms-hospital.vn', dept: 'civil', role: 'Giám sát công trình', phone: '0901234018', managerId: 'staff-07', status: 'active' },
    { uid: 'staff-19', displayName: 'Lê Thị Hồng Nhung', email: 'nhung.lth@bms-hospital.vn', dept: 'medical', role: 'Nhân viên y tế', phone: '0901234019', managerId: 'staff-04', status: 'active' },
    { uid: 'staff-20', displayName: 'Đinh Công Minh', email: 'minh.dc@bms-hospital.vn', dept: 'warehouse', role: 'Nhân viên kho', phone: '0901234020', managerId: 'staff-05', status: 'active' },
    { uid: 'staff-21', displayName: 'Bùi Đức Thịnh', email: 'thinh.bd@bms-hospital.vn', dept: 'it', role: 'An ninh mạng', phone: '0901234021', managerId: 'staff-02', status: 'active' },
    { uid: 'staff-22', displayName: 'Trịnh Thị Phương', email: 'phuong.tt3@bms-hospital.vn', dept: 'compliance', role: 'Chuyên viên quality', phone: '0901234022', managerId: 'staff-06', status: 'active' },
    { uid: 'staff-23', displayName: 'Phan Văn Hải', email: 'hai.pv@bms-hospital.vn', dept: 'electrical', role: 'Thợ điện bảo trì', phone: '0901234023', managerId: 'staff-03', status: 'active' },
    { uid: 'staff-24', displayName: 'Hoàng Thị Lan', email: 'lan.ht2@bms-hospital.vn', dept: 'medical', role: 'Nhân viên y tế', phone: '0901234024', managerId: 'staff-04', status: 'active' },
    { uid: 'staff-25', displayName: 'Nguyễn Thành Đạt', email: 'dat.nt@bms-hospital.vn', dept: 'civil', role: 'Kỹ thuật viên xây dựng', phone: '0901234025', managerId: 'staff-07', status: 'active' },
    { uid: 'staff-26', displayName: 'Cao Thị Mai', email: 'mai.ct@bms-hospital.vn', dept: 'warehouse', role: 'Kế toán kho', phone: '0901234026', managerId: 'staff-05', status: 'active' },
    { uid: 'staff-27', displayName: 'Võ Hoàng Long', email: 'long.vh@bms-hospital.vn', dept: 'it', role: 'DevOps Engineer', phone: '0901234027', managerId: 'staff-02', status: 'active' },
    { uid: 'staff-28', displayName: 'Lê Thị Hạnh', email: 'hanh.lt@bms-hospital.vn', dept: 'compliance', role: 'Chuyên viên an toàn', phone: '0901234028', managerId: 'staff-06', status: 'active' },
    { uid: 'staff-29', displayName: 'Chu Văn Tuấn', email: 'tuan.cv@bms-hospital.vn', dept: 'electrical', role: 'Thợ điện bảo trì', phone: '0901234029', managerId: 'staff-03', status: 'active' },
    { uid: 'staff-30', displayName: 'Đặng Thị Quỳnh', email: 'quynh.dt@bms-hospital.vn', dept: 'medical', role: 'Nhân viên y tế', phone: '0901234030', managerId: 'staff-04', status: 'active' },
  ]
  const batch = db.batch()
  for (const s of staff) {
    batch.set(db.doc(`org/${s.uid}`), { ...s })
    batch.set(db.doc(`users/${s.uid}`), { uid: s.uid, email: s.email, displayName: s.displayName, dept: s.dept, role: s.role, phone: s.phone, status: s.status, createdAt: ts() })
  }
  await batch.commit()
  console.log('   ✅ org (30) + users (30) seeded')
}

async function seedInfra() {
  const infra = [
    { id: 'elec-01', name: 'Hệ thống điện chính', type: 'electrical', status: 'online', location: 'Tầng 1 – Phòng máy điện', lastReading: 415, unit: 'V', threshold: { min: 380, max: 440 }, updatedAt: ts() },
    { id: 'water-01', name: 'Hệ thống nước sạch', type: 'water', status: 'online', location: 'Tầng hầm – Bể nước', lastReading: 72, unit: 'm³/h', threshold: { min: 50, max: 100 }, updatedAt: ts() },
    { id: 'hvac-01', name: 'Hệ thống HVAC', type: 'hvac', status: 'online', location: 'Tầng 2 – Phòng máy lạnh', lastReading: 22, unit: '°C', threshold: { min: 18, max: 26 }, updatedAt: ts() },
    { id: 'o2-01', name: 'Hệ thống khí O2', type: 'o2', status: 'online', location: 'Tầng 1 – Bồn O2', lastReading: 8.5, unit: 'bar', threshold: { min: 6, max: 12 }, updatedAt: ts() },
    { id: 'gen-01', name: 'Máy phát điện dự phòng', type: 'generator', status: 'offline', location: 'Tầng hầm – Phòng máy phát', lastReading: 0, unit: 'kW', threshold: { min: 0, max: 500 }, updatedAt: ts() },
  ]
  const batch = db.batch()
  for (const s of infra) batch.set(db.doc(`infra/${s.id}`), s)
  await batch.commit()
  console.log('   ✅ infra (5) seeded')
}

// ── Work Orders ───────────────────────────────────────────────────────────────
function seedWorkOrders(count: number) {
  const templates = [
    { title: 'Thay thế bộ lọc điều hòa không khí', desc: 'Bộ lọc AHU tại {loc} đã bám bụi nhiều, cần thay mới để đảm bảo chất lượng không khí.', system: 'Hệ thống HVAC' },
    { title: 'Kiểm tra áp lực nước', desc: 'Nhân viên báo áp lực nước yếu tại {loc}.', system: 'Hệ thống nước sạch' },
    { title: 'Bảo trì định kỳ máy phát điện', desc: 'Thực hiện bảo trì định kỳ 500h cho máy phát điện dự phòng tại {loc}.', system: 'Máy phát điện dự phòng' },
    { title: 'Sửa chữa ổ cắm điện', desc: 'Ổ cắm điện tại {loc} bị lỏng, cần sửa chữa ngay.', system: 'Hệ thống điện chính' },
    { title: 'Hiệu chuẩn cảm biến nhiệt độ HVAC', desc: 'Cảm biến nhiệt độ tại {loc} có độ lệch ±2°C, cần hiệu chuẩn.', system: 'Hệ thống HVAC' },
    { title: 'Lắp đặt báo động rò rỉ O2', desc: 'Lắp thêm cảm biến rò rỉ O2 tại khu vực cấp khí trung tâm {loc}.', system: 'Hệ thống khí O2' },
    { title: 'Vệ sinh bể nước ngầm', desc: 'Bể nước ngầm tại {loc} cần vệ sinh và khử trùng định kỳ 6 tháng/lần.', system: 'Hệ thống nước sạch' },
    { title: 'Thay dây điện hành lang', desc: 'Dây điện hành lang tại {loc} đã cũ, cần thay mới.', system: 'Hệ thống điện chính' },
    { title: 'Bảo dưỡng quạt thông gió', desc: 'Quạt thông gió tại {loc} có tiếng ồn bất thường.', system: 'Hệ thống HVAC' },
    { title: 'Kiểm tra UPS phòng Server', desc: 'Kiểm tra dung lượng và tình trạng ắc quy UPS tại {loc}.', system: 'Hệ thống điện chính' },
    { title: 'Sửa rò rỉ van nước', desc: 'Van nước tại {loc} bị rò rỉ, gây thất thoát nước.', system: 'Hệ thống nước sạch' },
    { title: 'Thay đèn LED hành lang', desc: 'Đèn LED hành lang tại {loc} đã hỏng, cần thay thế.', system: 'Hệ thống điện chính' },
    { title: 'Bảo trì máy nén lạnh AHU', desc: 'Máy nén lạnh AHU tại {loc} có hiệu suất giảm, cần bảo trì.', system: 'Hệ thống HVAC' },
    { title: 'Kiểm tra áp suất O2', desc: 'Khu vực {loc} báo áp suất O2 không ổn định.', system: 'Hệ thống khí O2' },
    { title: 'Lắp đặt ổ cắm điện mới', desc: 'Cần lắp thêm ổ cắm điện 3 chấu cho {loc}.', system: 'Hệ thống điện chính' },
    { title: 'Vệ sinh tấm lọc F7 điều hòa', desc: 'Tấm lọc F7 tại AHU {loc} đã bám bụi nặng.', system: 'Hệ thống HVAC' },
    { title: 'Thay aptomat tủ điện', desc: 'Aptomat tủ điện tại {loc} bị hỏng không cắt được.', system: 'Hệ thống điện chính' },
    { title: 'Kiểm tra bơm nước tầng hầm', desc: 'Bơm nước sạch tại {loc} chạy liên tục không ngắt.', system: 'Hệ thống nước sạch' },
    { title: 'Hiệu chuẩn đồng hồ đo áp suất O2', desc: 'Đồng hồ đo áp suất O2 tại {loc} cần hiệu chuẩn.', system: 'Hệ thống khí O2' },
    { title: 'Bảo dưỡng bình tích áp thủy lực', desc: 'Kiểm tra áp suất và gioăng cao su bình tích áp HVAC tại {loc}.', system: 'Hệ thống HVAC' },
  ]

  return templates.slice(0, count).map((t, i) => {
    const loc = LOCATIONS[i % LOCATIONS.length]
    const assignedTo = casual.random_element(TECHNICIAN_UIDS)
    const createdAtDays = -casual.integer(1, 60)
    const updatedAtDays = Math.max(createdAtDays, createdAtDays - casual.integer(0, 10))
    return {
      title: t.title,
      description: t.desc.replace('{loc}', loc),
      system: t.system,
      location: loc,
      priority: casual.random_element([...PRIORITIES]),
      status: casual.random_element([...WO_STATUSES]),
      createdBy: casual.random_element(TECHNICIAN_UIDS),
      assignedTo,
      createdAt: ts(createdAtDays),
      updatedAt: ts(updatedAtDays),
      tags: Array.from({ length: casual.integer(1, 3) }, () => casual.random_element(['bảo trì', 'sửa chữa', 'định kỳ', 'cấp cứu', 'thay thế', 'kiểm tra'])),
    }
  })
}

// ── Devices ───────────────────────────────────────────────────────────────────
function seedDevices(count: number) {
  const templates = [
    { name: 'Máy chụp MRI 3.0T', model: 'Siemens MAGNETOM Vida', manufacturer: 'Siemens Healthineers', location: 'Khoa Chẩn đoán hình ảnh' },
    { name: 'Máy CT Scanner 256 slices', model: 'Philips Incisive CT', manufacturer: 'Philips Healthcare', location: 'Khoa Chẩn đoán hình ảnh' },
    { name: 'Máy X-quang kỹ thuật số', model: 'Philips DigitalDiagnost', manufacturer: 'Philips Healthcare', location: 'Khoa X-quang' },
    { name: 'Máy siêu âm tim 4D', model: 'GE Vivid E95', manufacturer: 'GE HealthCare', location: 'Khoa Tim mạch' },
    { name: 'Monitor theo dõi bệnh nhân', model: 'Philips IntelliVue MX450', manufacturer: 'Philips Healthcare', location: 'Khoa Cấp cứu' },
    { name: 'Máy gây mê', model: 'Dräger Fabius Tiro', manufacturer: 'Dräger', location: 'Phòng mổ 1' },
    { name: 'Máy thở', model: 'Hamilton C6', manufacturer: 'Hamilton Medical', location: 'ICU' },
    { name: 'Máy siêu âm di động', model: 'Sonosite Edge II', manufacturer: 'Fujifilm SonoSite', location: 'Khoa Nhi' },
    { name: 'Máy điện tim 12 lead', model: 'GE MAC 2000', manufacturer: 'GE HealthCare', location: 'Khoa Tim mạch' },
    { name: 'Bơm tiêm điện', model: 'B. Braun Perfusor Space', manufacturer: 'B. Braun', location: 'ICU' },
    { name: 'Máy hấp tiệt trùng', model: 'Tuttnauer 3870EA', manufacturer: 'Tuttnauer', location: 'Khoa Khám bệnh' },
    { name: 'Máy sinh hóa tự động', model: 'Roche Cobas C702', manufacturer: 'Roche Diagnostics', location: 'Khoa Xét nghiệm' },
    { name: 'Máy huyết học tự động', model: 'Sysmex XN-2000', manufacturer: 'Sysmex', location: 'Khoa Xét nghiệm' },
    { name: 'Monitor sản khoa', model: 'Philips Avalon FM50', manufacturer: 'Philips Healthcare', location: 'Khoa Sản' },
    { name: 'Máy nội soi dạ dày', model: 'Olympus GIF-HQ190', manufacturer: 'Olympus', location: 'Khoa Nội soi' },
    { name: 'Máy nội soi đại tràng', model: 'Olympus CF-HQ190L', manufacturer: 'Olympus', location: 'Khoa Nội soi' },
    { name: 'Máy X-quang di động', model: 'Siemens Mobilett Mira', manufacturer: 'Siemens Healthineers', location: 'Khoa Cấp cứu' },
    { name: 'Máy đo loãng xương', model: 'Hologic Horizon A', manufacturer: 'Hologic', location: 'Khoa Khám bệnh' },
    { name: 'Máy siêu âm mạch máu', model: 'Samsung HS70A', manufacturer: 'Samsung Medison', location: 'Khoa Tim mạch' },
    { name: 'Máy phẫu thuật Phaco', model: 'Alcon Centurion', manufacturer: 'Alcon', location: 'Khoa Mắt' },
  ]
  const deviceStatuses = ['operational', 'operational', 'operational', 'calibration', 'maintenance', 'out_of_service'] as const

  return templates.slice(0, count).map((t, i) => ({
    name: t.name,
    model: t.model,
    serial: `SN-${casual.numerify('########').toUpperCase()}`,
    manufacturer: t.manufacturer,
    location: t.location,
    dept: 'medical',
    status: casual.random_element([...deviceStatuses]),
    purchaseDate: ts(-casual.integer(365, 2190)),
    lastService: ts(-casual.integer(7, 180)),
    nextCalibration: ts(casual.integer(1, 180)),
    serviceHistory: Array.from({ length: casual.integer(0, 4) }, () => ({
      date: ts(-casual.integer(30, 365)),
      type: casual.random_element(['bảo trì định kỳ', 'sửa chữa', 'hiệu chuẩn', 'thay thế linh kiện']),
      description: casual.random_element([
        'Thay lọc và kiểm tra hoạt động',
        'Hiệu chuẩn theo tiêu chuẩn nhà sản xuất',
        'Thay linh kiện hao mòn',
        'Bảo trì tổng thể định kỳ',
      ]),
      cost: casual.integer(500000, 50000000),
      vendor: casual.company_name,
    })),
    warrantyExpiry: ts(casual.integer(30, 1095)),
    contactPerson: casual.random_element(MEDICAL_STAFF_UIDS),
    notes: Math.random() < 0.4 ? casual.sentence : undefined,
  }))
}

// ── Inventory ─────────────────────────────────────────────────────────────────
function seedInventory(count: number) {
  const templates = [
    { name: 'Bóng đèn LED 18W', category: 'Điện', unit: 'cái', price: 45000 },
    { name: 'Dây điện CV 2.5mm²', category: 'Điện', unit: 'm', price: 18000 },
    { name: 'Cầu chì 10A', category: 'Điện', unit: 'cái', price: 25000 },
    { name: 'Ổ cắm điện 3 chấu', category: 'Điện', unit: 'cái', price: 85000 },
    { name: 'Aptomat 32A', category: 'Điện', unit: 'cái', price: 120000 },
    { name: 'Van nước DN25', category: 'Nước', unit: 'cái', price: 95000 },
    { name: 'Ống PVC DN27', category: 'Nước', unit: 'm', price: 35000 },
    { name: 'Bộ lọc điều hòa AHU', category: 'HVAC', unit: 'bộ', price: 850000 },
    { name: 'Dầu máy nén lạnh', category: 'HVAC', unit: 'lít', price: 220000 },
    { name: 'Gas R-410A', category: 'HVAC', unit: 'kg', price: 350000 },
    { name: 'Bông lọc HEPA H14', category: 'HVAC', unit: 'tấm', price: 2400000 },
    { name: 'Bình chữa cháy CO2 5kg', category: 'PCCC', unit: 'cái', price: 680000 },
    { name: 'Bình chữa cháy bột 8kg', category: 'PCCC', unit: 'cái', price: 450000 },
    { name: 'Găng tay y tế', category: 'Y tế', unit: 'hộp', price: 95000 },
    { name: 'Cáp mạng Cat6 305m', category: 'IT', unit: 'cuộn', price: 2800000 },
    { name: 'Patch cord Cat6 3m', category: 'IT', unit: 'cái', price: 85000 },
    { name: 'Switch PoE 24 port', category: 'IT', unit: 'cái', price: 8500000 },
    { name: 'UPS 3kVA', category: 'IT', unit: 'cái', price: 15000000 },
    { name: 'Đèn exit thoát hiểm', category: 'PCCC', unit: 'cái', price: 380000 },
    { name: 'Thiết bị bảo hộ lao động', category: 'An toàn', unit: 'bộ', price: 650000 },
  ]

  return templates.slice(0, count).map((t) => {
    const quantity = casual.integer(2, 200)
    const minStock = Math.ceil(quantity * casual.double(0.05, 0.25))
    return {
      code: `WH-${casual.numerify('######').toUpperCase()}`,
      name: t.name,
      category: t.category,
      unit: t.unit,
      quantity,
      minStock,
      maxStock: Math.ceil(quantity * casual.double(1.5, 3)),
      location: `Kho vật tư – ${casual.random_element(['Kệ A', 'Kệ B', 'Kệ C', 'Kệ D', 'Kệ E'])}${casual.integer(1, 10)}`,
      price: t.price,
      supplier: viCompany(),
      lastImport: ts(-casual.integer(1, 90)),
      lastExport: ts(-casual.integer(0, 30)),
      stockStatus: quantity < minStock ? 'low_stock' : quantity > 150 ? 'overstock' : 'normal',
    }
  })
}

// ── System Readings ───────────────────────────────────────────────────────────
function seedSystemReadings(count: number) {
  const systemTypes = [
    { system: 'Hệ thống điện chính', unit: 'V', min: 380, max: 440, typical: 415 },
    { system: 'Hệ thống nước sạch', unit: 'm³/h', min: 50, max: 100, typical: 72 },
    { system: 'Hệ thống HVAC', unit: '°C', min: 18, max: 26, typical: 22 },
    { system: 'Hệ thống khí O2', unit: 'bar', min: 6, max: 12, typical: 8.5 },
    { system: 'Máy phát điện dự phòng', unit: 'kW', min: 0, max: 500, typical: 0 },
    { system: 'Hệ thống PCCC', unit: 'L/min', min: 100, max: 200, typical: 150 },
    { system: 'Hệ thống BMS tòa nhà', unit: '%', min: 0, max: 100, typical: 85 },
    { system: 'Thang máy A', unit: 'lần/ngày', min: 0, max: 500, typical: 280 },
    { system: 'Thang máy B', unit: 'lần/ngày', min: 0, max: 500, typical: 250 },
    { system: 'Hệ thống wifi', unit: 'dBm', min: -80, max: -40, typical: -60 },
    { system: 'Hệ thống xử lý nước thải', unit: 'pH', min: 6, max: 9, typical: 7.2 },
    { system: 'Hệ thống camera CCTV', unit: 'Mbps', min: 0, max: 100, typical: 45 },
    { system: 'Phòng Server', unit: '°C', min: 18, max: 26, typical: 21 },
    { system: 'Phòng Server – Độ ẩm', unit: '%', min: 40, max: 60, typical: 50 },
    { system: 'Khoa ICU – Nhiệt độ', unit: '°C', min: 22, max: 26, typical: 24 },
    { system: 'Khoa ICU – Độ ẩm', unit: '%', min: 40, max: 60, typical: 55 },
    { system: 'Phòng mổ 1 – Nhiệt độ', unit: '°C', min: 20, max: 25, typical: 22 },
    { system: 'Phòng mổ 2 – Nhiệt độ', unit: '°C', min: 20, max: 25, typical: 22 },
    { system: 'Hệ thống điện dự phòng', unit: '%', min: 0, max: 100, typical: 95 },
    { system: 'Hệ thống xử lý nước RO', unit: 'L/h', min: 400, max: 600, typical: 500 },
  ]

  return systemTypes.slice(0, count).map((s, i) => {
    const value = s.unit === 'V' || s.unit === 'bar' || s.unit === '°C' || s.unit === 'pH' || s.unit === 'dBm' || s.unit === '%'
      ? parseFloat(casual.double(s.min, s.max).toFixed(1))
      : casual.integer(s.min, s.max)

    const isAnomaly = Math.random() < 0.15
    const displayValue = isAnomaly
      ? parseFloat(casual.double(s.min * 0.7, s.max * 1.3).toFixed(1))
      : value

    const outOfRange = displayValue < s.min || displayValue > s.max

    return {
      system: s.system,
      location: LOCATIONS[i % LOCATIONS.length],
      metric: s.unit,
      value: displayValue,
      thresholdMin: s.min,
      thresholdMax: s.max,
      isAnomaly,
      isAlert: outOfRange,
      alertLevel: outOfRange ? (Math.abs(displayValue - (displayValue < s.min ? s.min : s.max)) > (s.max - s.min) * 0.2 ? 'critical' : 'warning') : null,
      recordedAt: ts(-casual.integer(0, 7)),
      recordedBy: 'system',
    }
  })
}

// ── Incidents ─────────────────────────────────────────────────────────────────
function seedIncidents(count: number) {
  const templates = [
    { title: 'Mất điện toàn bộ khu vực {loc}', type: 'power_outage', severity: 'high' },
    { title: 'Rò rỉ nước tại {loc}', type: 'water_leak', severity: 'medium' },
    { title: 'Máy thiết bị y tế không khởi động tại {loc}', type: 'equipment_failure', severity: 'critical' },
    { title: 'Báo động cháy giả tại {loc}', type: 'fire', severity: 'low' },
    { title: 'Hệ thống O2 áp suất thấp tại {loc}', type: 'equipment_failure', severity: 'critical' },
    { title: 'Camera CCTV mất tín hiệu tại {loc}', type: 'security', severity: 'medium' },
    { title: 'Máy điều hòa quá nhiệt tại {loc}', type: 'equipment_failure', severity: 'high' },
    { title: 'Đèn exit không hoạt động tại {loc}', type: 'equipment_failure', severity: 'medium' },
    { title: 'Nước thải tràn tại {loc}', type: 'water_leak', severity: 'high' },
    { title: 'Máy thở báo lỗi tại {loc}', type: 'medical', severity: 'critical' },
    { title: 'Gas rò rỉ nhẹ tại {loc}', type: 'gas_leak', severity: 'high' },
    { title: 'UPS sụt pin tại {loc}', type: 'equipment_failure', severity: 'medium' },
    { title: 'Cửa tự động kẹt tại {loc}', type: 'equipment_failure', severity: 'low' },
    { title: 'Nhiệt độ vượt ngưỡng tại {loc}', type: 'equipment_failure', severity: 'medium' },
    { title: 'Cảm biến pH báo lỗi tại {loc}', type: 'environmental', severity: 'medium' },
    { title: 'Thang máy kẹt giữa tầng tại {loc}', type: 'equipment_failure', severity: 'high' },
    { title: 'Điện áp lưới dao động mạnh tại {loc}', type: 'power_outage', severity: 'high' },
    { title: 'Máy chiếu bị sọc hình tại {loc}', type: 'equipment_failure', severity: 'low' },
    { title: 'Máy MRI phát tiếng ồn bất thường tại {loc}', type: 'equipment_failure', severity: 'medium' },
    { title: 'Cửa chống cháy không đóng được tại {loc}', type: 'fire', severity: 'medium' },
  ]

  const actions = [
    'Bật aptomat tổng và kiểm tra CB nhánh',
    'Khóa van và thay thế gioăng',
    'Reset nguồn và liên hệ kỹ thuật',
    'Kiểm tra van điều áp và bổ sung khí',
    'Thay cáp mạng và reset thiết bị',
    'Vệ sinh lưới lọc và bổ sung gas lạnh',
    'Thông ống thoát và vệ sinh khu vực',
    'Chuyển bệnh nhân sang thiết bị dự phòng',
    'Sơ tán khu vực, kiểm tra các mối nối',
    'Thay ắc quy UPS',
  ]

  return templates.slice(0, count).map((t) => {
    const loc = casual.random_element(LOCATIONS)
    const status = casual.random_element([...INCIDENT_STATUSES])
    return {
      title: t.title.replace('{loc}', loc),
      description: `Sự cố ${t.type.replace('_', ' ')} được phát hiện tại ${loc}. Cần xử lý khẩn cấp.`,
      type: t.type,
      severity: t.severity,
      location: loc,
      status,
      reportedBy: casual.random_element([...TECHNICIAN_UIDS, ...MEDICAL_STAFF_UIDS]),
      assignedTo: casual.random_element(TECHNICIAN_UIDS),
      createdAt: ts(-casual.integer(1, 30)),
      updatedAt: ts(-casual.integer(0, 10)),
      resolvedAt: status === 'closed' ? ts(-casual.integer(0, 5)) : undefined,
      actionTaken: casual.random_element(actions),
      impact: casual.random_element(['toàn khoa', 'một phòng', 'một tầng', 'toàn tòa nhà', 'thiết bị duy nhất']),
      estimatedDowntime: status === 'closed' ? `${casual.integer(15, 240)} phút` : null,
      rootCause: status === 'closed' ? casual.random_element([
        'Hết thời gian bảo trì định kỳ',
        'Thiết bị hết vật tư tiêu hao',
        'Lỗi phần mềm / firmware',
        'Điều kiện môi trường vượt ngưỡng',
        'Hết tuổi thọ linh kiện',
      ]) : undefined,
      tags: Array.from({ length: casual.integer(1, 3) }, () => casual.random_element(['bảo trì', 'cấp cứu', 'an toàn', 'thiết bị', 'hệ thống', 'PCCC', 'điện', 'nước'])),
    }
  })
}

// ── Vendors ───────────────────────────────────────────────────────────────────
function seedVendors(count: number) {
  const templates = [
    { name: 'Công ty TNHH Kỹ thuật Điện ABC', type: 'contractor', services: ['Điện', 'PCCC'] },
    { name: 'Công ty CP Thiết bị Y tế MedTech', type: 'supplier', services: ['Thiết bị y tế', 'Vật tư y tế'] },
    { name: 'Dịch vụ Bảo trì HVAC Việt Nam', type: 'service', services: ['HVAC', 'Điều hòa không khí'] },
    { name: 'Công ty PCCC Phú Thành', type: 'contractor', services: ['PCCC', 'An toàn'] },
    { name: 'Nhà cung cấp vật tư xây dựng X', type: 'supplier', services: ['Vật tư xây dựng'] },
    { name: 'Công ty TNHH Điện Lạnh Nam Phát', type: 'contractor', services: ['HVAC', 'Điện lạnh'] },
    { name: 'Công ty Vật tư Y tế Phúc An', type: 'supplier', services: ['Vật tư y tế', 'Dược phẩm'] },
    { name: 'Trung tâm Bảo trì Thiết bị Y tế Sài Gòn', type: 'service', services: ['Thiết bị y tế', 'Bảo trì'] },
    { name: 'Công ty TNHH Giải pháp CNTT Gia Minh', type: 'supplier', services: ['CNTT', 'Thiết bị mạng'] },
    { name: 'Công ty CP Nước sạch Sài Gòn', type: 'supplier', services: ['Nước sạch', 'Xử lý nước'] },
    { name: 'Công ty Bảo vệ An Ninh Thành Phố', type: 'service', services: ['Bảo vệ', 'An ninh'] },
    { name: 'Công ty TNHH Vệ sinh Môi trường Xanh', type: 'service', services: ['Vệ sinh', 'Môi trường'] },
    { name: 'Công ty TNHH PCCC Thăng Long', type: 'contractor', services: ['PCCC', 'An toàn'] },
    { name: 'Công ty CP Thiết bị IT Việt Nam', type: 'supplier', services: ['Thiết bị IT', 'Mạng'] },
    { name: 'Dịch vụ Thẩm định An toàn Điện', type: 'service', services: ['Điện', 'Thẩm định'] },
    { name: 'Công ty TNHH Xây dựng Hồng Phát', type: 'contractor', services: ['Xây dựng', 'Sửa chữa'] },
    { name: 'Trung tâm Kiểm định Kỹ thuật An toàn', type: 'service', services: ['Kiểm định', 'An toàn'] },
    { name: 'Công ty TNHH Gas Công nghiệp Việt', type: 'supplier', services: ['Gas công nghiệp', 'Y tế'] },
    { name: 'Dịch vụ Thẩm định Thiết bị Y tế', type: 'service', services: ['Thiết bị y tế', 'Thẩm định'] },
    { name: 'Công ty TNHH Môi trường Xanh Việt', type: 'contractor', services: ['Môi trường', 'Xử lý nước thải'] },
  ]
  const vendorStatuses = ['active', 'active', 'active', 'inactive', 'under_review'] as const

  return templates.slice(0, count).map((t) => ({
    name: t.name,
    type: t.type,
    contact: viName(),
    phone: casual.numerify('0#########'),
    email: `${viName().replace(/ /g, '.').toLowerCase()}@bms-hospital.vn`,
    address: `${viStreet()}, ${viCity()}, TP.HCM`,
    website: `https://www.${casual.word.toLowerCase()}.vn`,
    services: t.services,
    rating: parseFloat(casual.double(3.0, 5.0).toFixed(1)),
    status: casual.random_element([...vendorStatuses]),
    contracts: Math.random() < 0.7 ? [{
      id: `CT-${casual.numerify('######').toUpperCase()}`,
      title: `Hợp đồng ${casual.random_element(t.services)} 2026`,
      startDate: ts(-casual.integer(0, 180)),
      endDate: ts(casual.integer(30, 365)),
      value: casual.integer(30000000, 1000000000),
      status: casual.random_element(['active', 'active', 'expired', 'pending_renewal'] as const),
    }] : [],
    taxCode: casual.numerify('#############'),
    bankAccount: casual.numerify('###############'),
    bankName: casual.random_element(['Vietcombank', 'VietinBank', 'BIDV', 'Agribank', 'ACB', 'Techcombank']),
    notes: Math.random() < 0.3 ? casual.sentence : undefined,
    createdAt: ts(-casual.integer(180, 730)),
  }))
}

// ── Assets ────────────────────────────────────────────────────────────────────
function seedAssets(count: number) {
  const templates = [
    { name: 'Máy phát điện dự phòng 500kVA', category: 'Điện', dept: 'electrical', price: 2500000000, life: 15 },
    { name: 'Hệ thống HVAC VRF 150kW', category: 'Cơ điện', dept: 'electrical', price: 4200000000, life: 10 },
    { name: 'Máy biến áp 1000kVA', category: 'Điện', dept: 'electrical', price: 1800000000, life: 20 },
    { name: 'Hệ thống Camera CCTV 64 kênh', category: 'IT', dept: 'it', price: 950000000, life: 7 },
    { name: 'Thang máy khách 8 người', category: 'Cơ điện', dept: 'electrical', price: 3500000000, life: 20 },
    { name: 'Thang máy bệnh nhân 6 người', category: 'Cơ điện', dept: 'electrical', price: 3200000000, life: 20 },
    { name: 'Hệ thống mạng LAN 1000 ports', category: 'IT', dept: 'it', price: 1200000000, life: 7 },
    { name: 'Hệ thống chấm công', category: 'IT', dept: 'it', price: 350000000, life: 5 },
    { name: 'Bồn nước ngầm Inox 5000L', category: 'Cơ điện', dept: 'electrical', price: 800000000, life: 15 },
    { name: 'Hệ thống UPS 30kVA', category: 'Điện', dept: 'electrical', price: 1500000000, life: 10 },
    { name: 'Máy photocopy Ricoh 7500', category: 'Văn phòng', dept: 'admin', price: 450000000, life: 5 },
    { name: 'Hệ thống phát điện mặt trời 50kW', category: 'Điện', dept: 'electrical', price: 3500000000, life: 20 },
    { name: 'Hệ thống âm thanh nội bộ PA', category: 'IT', dept: 'it', price: 550000000, life: 8 },
    { name: 'Hệ thống wifi công cộng', category: 'IT', dept: 'it', price: 680000000, life: 5 },
    { name: 'Máy chiếu laser Full HD', category: 'Văn phòng', dept: 'admin', price: 120000000, life: 5 },
    { name: 'Máy in đa năng A3', category: 'Văn phòng', dept: 'admin', price: 280000000, life: 5 },
    { name: 'Xe đẩy bệnh nhân', category: 'Y tế', dept: 'medical', price: 35000000, life: 8 },
    { name: 'Bình oxy y tế 40L', category: 'Y tế', dept: 'medical', price: 8500000, life: 10 },
    { name: 'Hệ thống giặt ủi công nghiệp', category: 'Hậu cần', dept: 'admin', price: 1200000000, life: 12 },
    { name: 'Hệ thống xử lý nước thải 200m³/ngày', category: 'Môi trường', dept: 'civil', price: 3500000000, life: 20 },
  ]
  const assetStatuses = ['active', 'active', 'active', 'maintenance', 'retired'] as const

  return templates.slice(0, count).map((t, i) => {
    const ageDays = casual.integer(180, 2555)
    const purchaseDate = ts(-ageDays)
    const annualDepreciation = t.price / t.life
    const accumulatedDepreciation = Math.min(parseFloat((annualDepreciation * (ageDays / 365)).toFixed(0)), t.price * 0.9)
    const currentValue = t.price - accumulatedDepreciation

    return {
      code: `AST-${casual.numerify('######').toUpperCase()}`,
      name: t.name,
      category: t.category,
      location: LOCATIONS[i % LOCATIONS.length],
      dept: t.dept,
      purchaseDate,
      purchasePrice: t.price,
      usefulLifeYears: t.life,
      salvageValue: parseFloat((t.price * 0.1).toFixed(0)),
      status: casual.random_element([...assetStatuses]),
      depreciationMethod: 'straight_line',
      annualDepreciation: parseFloat(annualDepreciation.toFixed(0)),
      accumulatedDepreciation,
      currentValue,
      assignedTo: casual.random_element([...TECHNICIAN_UIDS]),
      warrantyExpiry: ts(-ageDays + t.life * 365),
      maintenanceSchedule: `${casual.integer(30, 365)} ngày`,
      lastMaintenance: ts(-casual.integer(1, 180)),
      nextMaintenance: ts(casual.integer(1, 90)),
      insurancePolicy: `BH-${casual.numerify('########').toUpperCase()}`,
      insuranceExpiry: ts(casual.integer(30, 365)),
      notes: Math.random() < 0.3 ? casual.sentence : undefined,
    }
  })
}

// ──────────────────────────────────────────────────────────────────────────────

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
