import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

admin.initializeApp()

const db = admin.firestore()

// Triggered on first user creation — seeds all collections with sample data
export const onFirstUserSignIn = functions.auth
  .user()
  .onCreate(async (user) => {
    const seedDoc = await db.doc('meta/seedStatus').get()
    if (seedDoc.exists) return

    const batch = db.batch()

    // ── Seed org (30+ staff) ──────────────────────────────────────────
    const staff: Record<string, object>[] = [
      { uid: 'staff-01', displayName: 'Nguyễn Văn Minh', email: 'minh.nv@bms-hospital.vn', dept: 'admin', role: 'Giám đốc', position: 'Director', phone: '0901234001', managerId: undefined, status: 'active' },
      { uid: 'staff-02', displayName: 'Trần Thị Hương', email: 'huong.tt@bms-hospital.vn', dept: 'it', role: 'Trưởng phòng IT', position: 'IT Manager', phone: '0901234002', managerId: 'staff-01', status: 'active' },
      { uid: 'staff-03', displayName: 'Lê Quang Đức', email: 'duc.lq@bms-hospital.vn', dept: 'electrical', role: 'Kỹ sư điện', position: 'Electrical Engineer', phone: '0901234003', managerId: 'staff-01', status: 'active' },
      { uid: 'staff-04', displayName: 'Phạm Thị Mai', email: 'mai.pt@bms-hospital.vn', dept: 'medical', role: 'Trưởng phòng Y tế', position: 'Medical Manager', phone: '0901234004', managerId: 'staff-01', status: 'active' },
      { uid: 'staff-05', displayName: 'Hoàng Văn Tùng', email: 'tung.hv@bms-hospital.vn', dept: 'warehouse', role: 'Thủ kho', position: 'Warehouse Supervisor', phone: '0901234005', managerId: 'staff-01', status: 'active' },
      { uid: 'staff-06', displayName: 'Đặng Thị Lan', email: 'lan.dt@bms-hospital.vn', dept: 'compliance', role: 'Chuyên viên compliance', position: 'Compliance Officer', phone: '0901234006', managerId: 'staff-01', status: 'active' },
      { uid: 'staff-07', displayName: 'Vũ Văn Hùng', email: 'hung.vv@bms-hospital.vn', dept: 'civil', role: 'Kỹ sư xây dựng', position: 'Civil Engineer', phone: '0901234007', managerId: 'staff-01', status: 'active' },
      { uid: 'staff-08', displayName: 'Ngô Thị Thu', email: 'thu.nt@bms-hospital.vn', dept: 'it', role: 'Kỹ thuật viên', position: 'Tech Support', phone: '0901234008', managerId: 'staff-02', status: 'active' },
      { uid: 'staff-09', displayName: 'Trịnh Văn Nam', email: 'nam.tv@bms-hospital.vn', dept: 'electrical', role: 'Kỹ thuật viên điện', position: 'Electrical Technician', phone: '0901234009', managerId: 'staff-03', status: 'active' },
      { uid: 'staff-10', displayName: 'Bùi Thị Hà', email: 'ha.bt@bms-hospital.vn', dept: 'medical', role: 'Nhân viên y tế', position: 'Medical Staff', phone: '0901234010', managerId: 'staff-04', status: 'active' },
      { uid: 'staff-11', displayName: 'Đỗ Minh Tuấn', email: 'tuan.dm@bms-hospital.vn', dept: 'electrical', role: 'Kỹ thuật viên điện', position: 'Electrical Technician', phone: '0901234011', managerId: 'staff-03', status: 'active' },
      { uid: 'staff-12', displayName: 'Lý Thị Yến', email: 'yen.lt@bms-hospital.vn', dept: 'warehouse', role: 'Nhân viên kho', position: 'Warehouse Staff', phone: '0901234012', managerId: 'staff-05', status: 'active' },
      { uid: 'staff-13', displayName: 'Phạm Văn Long', email: 'long.pv@bms-hospital.vn', dept: 'civil', role: 'Công nhân xây dựng', position: 'Construction Worker', phone: '0901234013', managerId: 'staff-07', status: 'active' },
      { uid: 'staff-14', displayName: 'Trần Văn An', email: 'an.tv2@bms-hospital.vn', dept: 'it', role: 'Quản trị mạng', position: 'Network Admin', phone: '0901234014', managerId: 'staff-02', status: 'active' },
      { uid: 'staff-15', displayName: 'Nguyễn Thị Oanh', email: 'oanh.nt@bms-hospital.vn', dept: 'medical', role: 'Kỹ thuật viên thiết bị', position: 'Device Technician', phone: '0901234015', managerId: 'staff-04', status: 'active' },
      { uid: 'staff-16', displayName: 'Vương Đình Khoa', email: 'khoa.vd@bms-hospital.vn', dept: 'electrical', role: 'Kỹ thuật viên điện', position: 'Electrical Technician', phone: '0901234016', managerId: 'staff-03', status: 'active' },
      { uid: 'staff-17', displayName: 'Trương Thị Ngọc', email: 'ngoc.tt2@bms-hospital.vn', dept: 'it', role: 'Lập trình viên', position: 'Software Developer', phone: '0901234017', managerId: 'staff-02', status: 'active' },
      { uid: 'staff-18', displayName: 'Nguyễn Hữu Thắng', email: 'thang.nh@bms-hospital.vn', dept: 'civil', role: 'Giám sát công trình', position: 'Site Supervisor', phone: '0901234018', managerId: 'staff-07', status: 'active' },
      { uid: 'staff-19', displayName: 'Lê Thị Hồng Nhung', email: 'nhung.lth@bms-hospital.vn', dept: 'medical', role: 'Nhân viên y tế', position: 'Medical Staff', phone: '0901234019', managerId: 'staff-04', status: 'active' },
      { uid: 'staff-20', displayName: 'Đinh Công Minh', email: 'minh.dc@bms-hospital.vn', dept: 'warehouse', role: 'Nhân viên kho', position: 'Warehouse Staff', phone: '0901234020', managerId: 'staff-05', status: 'active' },
      { uid: 'staff-21', displayName: 'Bùi Đức Thịnh', email: 'thinh.bd@bms-hospital.vn', dept: 'it', role: 'An ninh mạng', position: 'Cybersecurity Engineer', phone: '0901234021', managerId: 'staff-02', status: 'active' },
      { uid: 'staff-22', displayName: 'Trịnh Thị Phương', email: 'phuong.tt3@bms-hospital.vn', dept: 'compliance', role: 'Chuyên viên quality', position: 'Quality Assurance', phone: '0901234022', managerId: 'staff-06', status: 'active' },
      { uid: 'staff-23', displayName: 'Phan Văn Hải', email: 'hai.pv@bms-hospital.vn', dept: 'electrical', role: 'Thợ điện bảo trì', position: 'Maintenance Electrician', phone: '0901234023', managerId: 'staff-03', status: 'active' },
      { uid: 'staff-24', displayName: 'Hoàng Thị Lan', email: 'lan.ht2@bms-hospital.vn', dept: 'medical', role: 'Nhân viên y tế', position: 'Medical Staff', phone: '0901234024', managerId: 'staff-04', status: 'active' },
      { uid: 'staff-25', displayName: 'Nguyễn Thành Đạt', email: 'dat.nt@bms-hospital.vn', dept: 'civil', role: 'Kỹ thuật viên xây dựng', position: 'Civil Tech', phone: '0901234025', managerId: 'staff-07', status: 'active' },
      { uid: 'staff-26', displayName: 'Cao Thị Mai', email: 'mai.ct@bms-hospital.vn', dept: 'warehouse', role: 'Kế toán kho', position: 'Inventory Accountant', phone: '0901234026', managerId: 'staff-05', status: 'active' },
      { uid: 'staff-27', displayName: 'Võ Hoàng Long', email: 'long.vh@bms-hospital.vn', dept: 'it', role: 'DevOps Engineer', position: 'DevOps', phone: '0901234027', managerId: 'staff-02', status: 'active' },
      { uid: 'staff-28', displayName: 'Lê Thị Hạnh', email: 'hanh.lt@bms-hospital.vn', dept: 'compliance', role: 'Chuyên viên an toàn', position: 'Safety Officer', phone: '0901234028', managerId: 'staff-06', status: 'active' },
      { uid: 'staff-29', displayName: 'Chu Văn Tuấn', email: 'tuan.cv@bms-hospital.vn', dept: 'electrical', role: 'Thợ điện bảo trì', position: 'Maintenance Electrician', phone: '0901234029', managerId: 'staff-03', status: 'active' },
      { uid: 'staff-30', displayName: 'Đặng Thị Quỳnh', email: 'quynh.dt@bms-hospital.vn', dept: 'medical', role: 'Nhân viên y tế', position: 'Medical Staff', phone: '0901234030', managerId: 'staff-04', status: 'active' },
    ]
    for (const s of staff) {
      batch.set(db.doc(`org/${s.uid}`), s)
    }

    // ── Seed infra (5 systems) ────────────────────────────────────────
    const infraSystems = [
      { id: 'elec-01', name: 'Hệ thống điện chính', type: 'electrical' as const, status: 'online' as const, location: 'Tầng 1 - Phòng máy điện', lastReading: 415, unit: 'V', threshold: { min: 380, max: 440 }, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { id: 'water-01', name: 'Hệ thống nước sạch', type: 'water' as const, status: 'online' as const, location: 'Tầng hầm - Bể nước', lastReading: 72, unit: 'm³/h', threshold: { min: 50, max: 100 }, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { id: 'hvac-01', name: 'Hệ thống HVAC', type: 'hvac' as const, status: 'online' as const, location: 'Tầng 2 - Phòng máy lạnh', lastReading: 22, unit: '°C', threshold: { min: 18, max: 26 }, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { id: 'o2-01', name: 'Hệ thống khí O2', type: 'o2' as const, status: 'online' as const, location: 'Tầng 1 - Bồn O2', lastReading: 8.5, unit: 'bar', threshold: { min: 6, max: 12 }, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { id: 'gen-01', name: 'Máy phát điện dự phòng', type: 'generator' as const, status: 'offline' as const, location: 'Tầng hầm - Phòng máy phát', lastReading: 0, unit: 'kW', threshold: { min: 0, max: 500 }, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    ]
    for (const s of infraSystems) {
      batch.set(db.doc(`infra/${s.id}`), s)
    }

    // ── Seed work orders (25+) ─────────────────────────────────────────
    const priorities = ['low', 'medium', 'high', 'critical'] as const
    const statuses = ['pending', 'in_progress', 'completed', 'pending', 'in_progress'] as const
    const systems = ['Hệ thống điện chính', 'Hệ thống nước sạch', 'Hệ thống HVAC', 'Hệ thống khí O2', 'Máy phát điện dự phòng']
    const locations = ['Tầng 1', 'Tầng 2', 'Tầng 3', 'Tầng hầm', 'Khoa Cấp cứu', 'Khoa Tim mạch', 'Khoa Nhi', 'Phòng mổ', 'Khoa Thần kinh', 'Khoa Ngoại tổng hợp', 'Khoa Sản']
    const workOrders = [
      { title: 'Thay thế bộ lọc điều hòa không khí', description: 'Bộ lọc AHU tầng 2 đã bám bụi nhiều, cần thay mới để đảm bảo chất lượng không khí.', system: systems[2], location: locations[1], priority: priorities[1], status: statuses[0] },
      { title: 'Kiểm tra áp lực nước tầng 3', description: 'Nhân viên y tế báo áp lực nước yếu tại vòi nước khoa Nhi.', system: systems[1], location: locations[6], priority: priorities[2], status: statuses[1] },
      { title: 'Bảo trì định kỳ máy phát điện', description: 'Thực hiện bảo trì định kỳ 500h theo手册 cho máy phát điện dự phòng.', system: systems[4], location: locations[3], priority: priorities[0], status: statuses[2] },
      { title: 'Sửa chữa ổ cắm điện phòng mổ', description: 'Ổ cắm điện tại phòng mổ số 2 bị lỏng, cần sửa chữa ngay.', system: systems[0], location: locations[7], priority: priorities[3], status: statuses[1] },
      { title: 'Hiệu chuẩn cảm biến nhiệt độ HVAC', description: 'Cảm biến nhiệt độ phòng Server có độ lệch ±2°C, cần hiệu chuẩn.', system: systems[2], location: locations[0], priority: priorities[2], status: statuses[0] },
      { title: 'Lắp đặt báo động rò rỉ O2', description: 'Lắp thêm cảm biến rò rỉ O2 tại khu vực cấp khí trung tâm.', system: systems[3], location: locations[0], priority: priorities[1], status: statuses[2] },
      { title: 'Vệ sinh bể nước ngầm', description: 'Bể nước ngầm cần vệ sinh và khử trùng định kỳ 6 tháng/lần.', system: systems[1], location: locations[3], priority: priorities[0], status: statuses[2] },
      { title: 'Thay dây điện hành lang tầng 2', description: 'Một số dây điện hành lang tầng 2 đã cũ, cần thay mới.', system: systems[0], location: locations[1], priority: priorities[2], status: statuses[0] },
      { title: 'Bảo dưỡng quạt thông gió', description: 'Quạt thông gió tầng hầm có tiếng ồn bất thường.', system: systems[2], location: locations[3], priority: priorities[1], status: statuses[1] },
      { title: 'Kiểm tra UPS phòng Server', description: 'Kiểm tra dung lượng và tình trạng ắc quy UPS.', system: systems[0], location: locations[0], priority: priorities[2], status: statuses[2] },
      { title: 'Sửa rò rỉ van nước tầng 4', description: 'Van nước tại hành lang tầng 4 bị rò rỉ, gây thất thoát nước.', system: systems[1], location: locations[1], priority: priorities[2], status: statuses[1] },
      { title: 'Thay đèn LED hành lang tầng 1', description: '10 bóng đèn LED hành lang tầng 1 đã hỏng, cần thay thế.', system: systems[0], location: locations[0], priority: priorities[1], status: statuses[0] },
      { title: 'Bảo trì máy nén lạnh AHU', description: 'Máy nén lạnh AHU tầng 2 có hiệu suất giảm, cần bảo trì.', system: systems[2], location: locations[1], priority: priorities[2], status: statuses[0] },
      { title: 'Kiểm tra áp suất O2 khoa Cấp cứu', description: 'Khoa Cấp cứu báo áp suất O2 không ổn định.', system: systems[3], location: locations[4], priority: priorities[3], status: statuses[1] },
      { title: 'Lắp đặt ổ cắm điện mới khoa Ngoại', description: 'Cần lắp thêm 4 ổ cắm điện 3 chấu cho khoa Ngoại tổng hợp.', system: systems[0], location: locations[9], priority: priorities[1], status: statuses[0] },
      { title: 'Vệ sinh tấm lọc F7 điều hòa', description: 'Tấm lọc F7 tại AHU tầng 3 đã bám bụi nặng.', system: systems[2], location: locations[2], priority: priorities[1], status: statuses[2] },
      { title: 'Thay aptomat tủ điện tầng 2', description: 'Aptomat 32A tủ điện tầng 2 bị hỏng không cắt được.', system: systems[0], location: locations[1], priority: priorities[2], status: statuses[1] },
      { title: 'Kiểm tra bơm nước tầng hầm', description: 'Bơm nước sạch tầng hầm chạy liên tục không ngắt.', system: systems[1], location: locations[3], priority: priorities[2], status: statuses[0] },
      { title: 'Hiệu chuẩn đồng hồ đo áp suất O2', description: 'Đồng hồ đo áp suất O2 tại trạm trung tâm cần hiệu chuẩn.', system: systems[3], location: locations[0], priority: priorities[1], status: statuses[0] },
      { title: 'Bảo trì máy phát điện dự phòng', description: 'Kiểm tra và bảo trì định kỳ máy phát điện Diesel 500kVA.', system: systems[4], location: locations[3], priority: priorities[1], status: statuses[2] },
      { title: 'Sửa quạt hút phòng mổ 3', description: 'Quạt hút phòng mổ 3 có tiếng kêu lạ, cần kiểm tra.', system: systems[2], location: locations[7], priority: priorities[2], status: statuses[1] },
      { title: 'Thay bóng đèn UV diệt khuẩn', description: 'Đèn UV trong điều hòa trung tâm khoa Nhi đã hết hạn.', system: systems[2], location: locations[6], priority: priorities[1], status: statuses[0] },
      { title: 'Lắp đặt cảm biến rò rỉ nước', description: 'Lắp cảm biến rò rỉ nước tại phòng máy điện tầng hầm.', system: systems[1], location: locations[3], priority: priorities[1], status: statuses[2] },
      { title: 'Kiểm tra tiếp địa hệ thống điện', description: 'Đo điện trở tiếp địa toàn bộ hệ thống điện bệnh viện.', system: systems[0], location: locations[0], priority: priorities[2], status: statuses[0] },
      { title: 'Bảo dưỡng bình tích áp thủy lực', description: 'Kiểm tra áp suất và gioăng cao su bình tích áp HVAC.', system: systems[2], location: locations[3], priority: priorities[1], status: statuses[0] },
    ]
    for (const wo of workOrders) {
      batch.set(db.collection('workOrders').doc(), {
        ...wo,
        createdBy: user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    // ── Seed fire safety (20+ records) ────────────────────────────────
    const fireRecords = [
      { type: 'equipment' as const, name: 'Bình chữa cháy CO2 5kg', location: 'Tầng 1 - Hành lang', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-09-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-03-01')) },
      { type: 'equipment' as const, name: 'Bình chữa cháy bột 8kg', location: 'Tầng 2 - Khoa Tim mạch', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-09-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-03-01')) },
      { type: 'equipment' as const, name: 'Vòi chữa cháy DN50', location: 'Tầng 1 - Cầu thang B', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-07-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')) },
      { type: 'drill' as const, name: 'Diễn tập PCCC quý II/2026', location: 'Toàn bộ tòa nhà', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-07-15')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-04-15')) },
      { type: 'drill' as const, name: 'Diễn tập sơ tán khẩn cấp', location: 'Khoa Cấp cứu', status: 'due' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-06-10')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-03-10')) },
      { type: 'inspection' as const, name: 'Kiểm tra hệ thống báo cháy tự động', location: 'Toàn bộ tòa nhà', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-12-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-06-01')) },
      { type: 'equipment' as const, name: 'Đèn exit thoát hiểm', location: 'Cầu thang A, B, C', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-08-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-02-01')) },
      { type: 'training' as const, name: 'Đào tạo PCCC cho nhân viên mới', location: 'Hội trường tầng 4', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-08-20')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-02-20')) },
      { type: 'equipment' as const, name: 'Bình chữa cháy CO2 5kg', location: 'Tầng 3 - Khoa Nhi', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-09-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-03-01')) },
      { type: 'equipment' as const, name: 'Bình chữa cháy bột 8kg', location: 'Tầng 4 - Khoa Thần kinh', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-09-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-03-01')) },
      { type: 'equipment' as const, name: 'Hệ thống chữa cháy sprinkler', location: 'Tầng 1 - Khoa Cấp cứu', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-10-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-04-01')) },
      { type: 'inspection' as const, name: 'Kiểm định bình chữa cháy định kỳ', location: 'Toàn bộ tòa nhà', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-11-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-05-01')) },
      { type: 'equipment' as const, name: 'Vòi chữa cháy DN65', location: 'Tầng 2 - Khoa Tim mạch', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-07-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')) },
      { type: 'training' as const, name: 'Diễn tập PCCC quý III/2026', location: 'Toàn bộ tòa nhà', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-10-15')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-04-15')) },
      { type: 'drill' as const, name: 'Diễn tập sơ tán khoa Sản', location: 'Khoa Sản tầng 5', status: 'due' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-06-20')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-03-20')) },
      { type: 'equipment' as const, name: 'Đèn exit thoát hiểm', location: 'Tầng hầm - Bãi giữ xe', status: 'maintenance' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-08-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-02-01')), notes: 'Đèn nhấp nháy, cần thay board nguồn' },
      { type: 'equipment' as const, name: 'Bình chữa cháy CO2 5kg', location: 'Tầng hầm - Phòng máy phát', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-09-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-03-01')) },
      { type: 'inspection' as const, name: 'Kiểm tra vòi chữa cháy và van', location: 'Tất cả các tầng', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-12-01')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-06-01')) },
      { type: 'training' as const, name: 'Tập huấn PCCC cho đội ngũ y tá', location: 'Hội trường tầng 4', status: 'ok' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-09-10')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2026-03-10')) },
      { type: 'equipment' as const, name: 'Hệ thống báo cháy zone 3', location: 'Tầng 3 - Khoa Nhi', status: 'due' as const, nextDue: admin.firestore.Timestamp.fromDate(new Date('2026-06-15')), lastChecked: admin.firestore.Timestamp.fromDate(new Date('2025-12-15')), notes: 'Cần kiểm tra đầu báo khói zone 3' },
    ]
    for (const r of fireRecords) {
      batch.set(db.collection('fireSafety').doc(), r)
    }

    // ── Seed medical devices (30+ devices) ───────────────────────────
    const devices = [
      { name: 'Máy chụp MRI 3.0T', model: 'Siemens MAGNETOM Vida', serial: 'MR2024001', manufacturer: 'Siemens Healthineers', location: 'Khoa Chẩn đoán hình ảnh', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-15')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-02-01')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-08-01')), serviceHistory: [] },
      { name: 'Máy CT Scanner 256 slices', model: 'Philips Incisive CT', serial: 'CT2023005', manufacturer: 'Philips Healthcare', location: 'Khoa Chẩn đoán hình ảnh', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-06-20')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-03-15')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-09-15')), serviceHistory: [] },
      { name: 'Máy X-quang kỹ thuật số', model: 'Philips DigitalDiagnost', serial: 'XR2022003', manufacturer: 'Philips Healthcare', location: 'Khoa X-quang', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-03-10')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-01-20')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-07-20')), serviceHistory: [] },
      { name: 'Máy siêu âm tim 4D', model: 'GE Vivid E95', serial: 'US2024002', manufacturer: 'GE HealthCare', location: 'Khoa Tim mạch', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2024-05-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-04-01')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-10-01')), serviceHistory: [] },
      { name: 'Monitor theo dõi bệnh nhân', model: 'Philips IntelliVue MX450', serial: 'MON2023001', manufacturer: 'Philips Healthcare', location: 'Khoa Cấp cứu', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-08-15')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-03-01')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-09-01')), serviceHistory: [] },
      { name: 'Máy gây mê', model: 'Dräger Fabius Tiro', serial: 'AN2023007', manufacturer: 'Dräger', location: 'Phòng mổ 1', dept: 'medical' as const, status: 'calibration' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-09-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-02-15')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-06-05')), serviceHistory: [] },
      { name: 'Máy thở', model: 'Hamilton C6', serial: 'VENT2023004', manufacturer: 'Hamilton Medical', location: 'ICU', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-04-20')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-05-01')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-11-01')), serviceHistory: [] },
      { name: 'Máy siêu âm di động', model: 'Sonosite Edge II', serial: 'US2024008', manufacturer: 'Fujifilm SonoSite', location: 'Khoa Nhi', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2024-07-10')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-03-20')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-09-20')), serviceHistory: [] },
      { name: 'Máy điện tim 12 lead', model: 'GE MAC 2000', serial: 'ECG2022001', manufacturer: 'GE HealthCare', location: 'Khoa Tim mạch', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-11-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-01-10')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-07-10')), serviceHistory: [] },
      { name: 'Bơm tiêm điện', model: 'B. Braun Perfusor Space', serial: 'SYR2023002', manufacturer: 'B. Braun', location: 'ICU', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-02-28')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-04-15')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-10-15')), serviceHistory: [] },
      { name: 'Máy hấp tiệt trùng', model: 'Tuttnauer 3870EA', serial: 'ST2022005', manufacturer: 'Tuttnauer', location: 'Khoa Khám bệnh', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-06-15')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-02-10')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-08-10')), serviceHistory: [] },
      { name: 'Máy sinh hóa tự động', model: 'Roche Cobas C702', serial: 'BIO2023003', manufacturer: 'Roche Diagnostics', location: 'Khoa Xét nghiệm', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-03-20')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-01-15')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-07-15')), serviceHistory: [] },
      { name: 'Máy huyết học tự động', model: 'Sysmex XN-2000', serial: 'HEM2023004', manufacturer: 'Sysmex', location: 'Khoa Xét nghiệm', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-04-10')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-03-05')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-09-05')), serviceHistory: [] },
      { name: 'Monitor sản khoa', model: 'Philips Avalon FM50', serial: 'OB2022006', manufacturer: 'Philips Healthcare', location: 'Khoa Sản', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-09-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-02-20')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-08-20')), serviceHistory: [] },
      { name: 'Máy nội soi dạ dày', model: 'Olympus GIF-HQ190', serial: 'ENDO2023007', manufacturer: 'Olympus', location: 'Khoa Nội soi', dept: 'medical' as const, status: 'maintenance' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-05-15')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-01-25')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-07-25')), serviceHistory: [] },
      { name: 'Máy nội soi đại tràng', model: 'Olympus CF-HQ190L', serial: 'ENDO2023008', manufacturer: 'Olympus', location: 'Khoa Nội soi', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-05-20')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-02-01')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-08-01')), serviceHistory: [] },
      { name: 'Máy MRI di động', model: 'GE SIGMA 1.5T', serial: 'MR2023009', manufacturer: 'GE HealthCare', location: 'Khoa Chẩn đoán hình ảnh', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-07-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-03-10')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-09-10')), serviceHistory: [] },
      { name: 'Máy X-quang di động', model: 'Siemens Mobilett Mira', serial: 'XR2024010', manufacturer: 'Siemens Healthineers', location: 'Khoa Cấp cứu', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2024-02-15')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-04-01')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-10-01')), serviceHistory: [] },
      { name: 'Máy đo loãng xương', model: 'Hologic Horizon A', serial: 'DEXA2023011', manufacturer: 'Hologic', location: 'Khoa Khám bệnh', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-10-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-04-15')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-10-15')), serviceHistory: [] },
      { name: 'Máy siêu âm mạch máu', model: 'Samsung HS70A', serial: 'US2023012', manufacturer: 'Samsung Medison', location: 'Khoa Tim mạch', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-11-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-05-01')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-11-01')), serviceHistory: [] },
      { name: 'Máy rửa dạ dày tự động', model: 'Nipro ROCHO', serial: 'GAST2022013', manufacturer: 'Nipro', location: 'Khoa Cấp cứu', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-08-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-01-30')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-07-30')), serviceHistory: [] },
      { name: 'Bộ Monitor 5 thông số', model: 'Philips IntelliVue MP5', serial: 'MON2023014', manufacturer: 'Philips Healthcare', location: 'Khoa Hồi sức tích cực', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-09-15')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-03-25')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-09-25')), serviceHistory: [] },
      { name: 'Máy gây mê di động', model: 'Dräger Perseus A500', serial: 'AN2023015', manufacturer: 'Dräger', location: 'Phòng mổ 2', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-10-20')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-04-10')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-10-10')), serviceHistory: [] },
      { name: 'Máy thở di động', model: 'Medtronic Puritan Bennett 560', serial: 'VENT2023016', manufacturer: 'Medtronic', location: 'Khoa Cấp cứu', dept: 'medical' as const, status: 'out_of_service' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-02-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-01-05')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-07-05')), serviceHistory: [] },
      { name: 'Máy tán sỏi ngoài cơ thể', model: 'Dornier Compact Sigma', serial: 'LITH2022017', manufacturer: 'Dornier MedTech', location: 'Khoa Ngoại', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-04-15')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-02-28')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-08-28')), serviceHistory: [] },
      { name: 'Máy phẫu thuật Phaco', model: 'Alcon Centurion', serial: 'OPHTH2023018', manufacturer: 'Alcon', location: 'Khoa Mắt', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-06-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-03-15')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-09-15')), serviceHistory: [] },
      { name: 'Máy C-arm X-quang', model: 'Siemens Arcadis Orbic', serial: 'XR2023019', manufacturer: 'Siemens Healthineers', location: 'Phòng mổ 3', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-08-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-02-15')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-08-15')), serviceHistory: [] },
      { name: 'Bàn mổ điện', model: 'Stryker 1150', serial: 'SURG2022020', manufacturer: 'Stryker', location: 'Phòng mổ 1', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-05-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-01-15')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-07-15')), serviceHistory: [] },
      { name: 'Máy siêu âm 4D phụ khoa', model: 'Voluson E10', serial: 'US2024021', manufacturer: 'GE HealthCare', location: 'Khoa Sản', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2024-03-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-04-20')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-10-20')), serviceHistory: [] },
      { name: 'Máy đốt điện phẫu thuật', model: 'Erbe ICC 350', serial: 'ELEC2022022', manufacturer: 'Erbe Elektromedizin', location: 'Phòng mổ 1', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-07-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-03-01')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-09-01')), serviceHistory: [] },
      { name: 'Máy X-quang toàn thân DR', model: 'Philips DigitalDiagnost C90', serial: 'XR2024023', manufacturer: 'Philips Healthcare', location: 'Khoa Chẩn đoán hình ảnh', dept: 'medical' as const, status: 'operational' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')), lastService: admin.firestore.Timestamp.fromDate(new Date('2026-02-05')), nextCalibration: admin.firestore.Timestamp.fromDate(new Date('2026-08-05')), serviceHistory: [] },
    ]
    for (const d of devices) {
      batch.set(db.collection('medicalDevices').doc(), d)
    }

    // ── Seed compliance (20+ records) ───────────────────────────────
    const compliance = [
      { type: 'calibration' as const, item: 'Cân phân tích', standard: 'ISO 17025', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-06-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-06-01')), status: 'due' as const, certNumber: 'CAL-2025-001' },
      { type: 'certification' as const, item: 'Giấy phép hoạt động Y tế', standard: 'Thông tư 46/2019/TT-BYT', frequency: '5 năm', lastDate: admin.firestore.Timestamp.fromDate(new Date('2022-01-15')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2027-01-15')), status: 'compliant' as const, certNumber: 'GPYT-2022-001' },
      { type: 'inspection' as const, item: 'PCCC - Thẩm duyệt', standard: 'QCVN 06:2022/BXD', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-12-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-01')), status: 'compliant' as const, certNumber: 'PCCC-2025-001' },
      { type: 'calibration' as const, item: 'Nhiệt kế chuẩn', standard: 'ISO 17025', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-08-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-08-01')), status: 'compliant' as const, certNumber: 'CAL-2025-002' },
      { type: 'audit' as const, item: 'Kiểm toán nội bộ ISO 9001', standard: 'ISO 9001:2015', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-11-20')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-11-20')), status: 'compliant' as const, certNumber: 'ISO-9001-2025' },
      { type: 'calibration' as const, item: 'Đồng hồ đo áp suất', standard: 'ISO 17025', frequency: '6 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-12-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-06-01')), status: 'due' as const, certNumber: 'CAL-2025-003' },
      { type: 'inspection' as const, item: 'Kiểm định thang máy', standard: 'QCVN 08:2016/BXD', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-09-15')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-09-15')), status: 'compliant' as const, certNumber: 'ELV-2025-001' },
      { type: 'certification' as const, item: 'Chứng chỉ hệ thống QLNL theo ISO 14001', standard: 'ISO 14001:2015', frequency: '3 năm', lastDate: admin.firestore.Timestamp.fromDate(new Date('2024-03-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2027-03-01')), status: 'compliant' as const, certNumber: 'ISO-14001-2024' },
      { type: 'calibration' as const, item: 'Đồng hồ đo lưu lượng nước', standard: 'ISO 17025', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-07-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-07-01')), status: 'compliant' as const, certNumber: 'CAL-2025-004' },
      { type: 'calibration' as const, item: 'Máy đo pH chuẩn', standard: 'ISO 17025', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-05-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-01')), status: 'overdue' as const, certNumber: 'CAL-2025-005' },
      { type: 'inspection' as const, item: 'Kiểm định bình chịu áp lực', standard: 'QCVN 02:2020/BCT', frequency: '24 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2024-06-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-06-01')), status: 'due' as const, certNumber: 'BP-2024-001' },
      { type: 'audit' as const, item: 'Đánh giá nội bộ ISO 14001', standard: 'ISO 14001:2015', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-10-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-10-01')), status: 'compliant' as const, certNumber: 'ISO14001-INT-2025' },
      { type: 'certification' as const, item: 'Chứng chỉ HACCP cho bếp ăn', standard: 'TCVN 11833:2017', frequency: '3 năm', lastDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-15')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2027-01-15')), status: 'compliant' as const, certNumber: 'HACCP-2024-001' },
      { type: 'calibration' as const, item: 'Máy đo nồng độ O2', standard: 'ISO 17025', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-09-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-09-01')), status: 'compliant' as const, certNumber: 'CAL-2025-006' },
      { type: 'inspection' as const, item: 'Kiểm tra an toàn điện định kỳ', standard: 'QCVN QTĐ-5:2009/BCT', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-11-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-11-01')), status: 'compliant' as const, certNumber: 'ATD-2025-001' },
      { type: 'certification' as const, item: 'Giấy phép môi trường', standard: 'Luật BVMT 2020', frequency: '5 năm', lastDate: admin.firestore.Timestamp.fromDate(new Date('2023-06-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2028-06-01')), status: 'compliant' as const, certNumber: 'GPMT-2023-001' },
      { type: 'calibration' as const, item: 'Thiết bị đo huyết áp chuẩn', standard: 'ISO 17025', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-10-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-10-01')), status: 'compliant' as const, certNumber: 'CAL-2025-007' },
      { type: 'audit' as const, item: 'Đánh giá nội bộ ISO 45001', standard: 'ISO 45001:2018', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-12-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-01')), status: 'compliant' as const, certNumber: 'ISO45001-INT-2025' },
      { type: 'inspection' as const, item: 'Kiểm định nồi hấp tiệt trùng', standard: 'QCVN 08:2016/BXD', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-10-15')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-10-15')), status: 'compliant' as const, certNumber: 'NHS-2025-001' },
      { type: 'calibration' as const, item: 'Đồng hồ đo nhiệt độ môi trường', standard: 'ISO 17025', frequency: '12 tháng', lastDate: admin.firestore.Timestamp.fromDate(new Date('2025-11-01')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2026-11-01')), status: 'compliant' as const, certNumber: 'CAL-2025-008' },
      { type: 'certification' as const, item: 'Chứng chỉ an toàn thông tin ISO 27001', standard: 'ISO 27001:2022', frequency: '3 năm', lastDate: admin.firestore.Timestamp.fromDate(new Date('2024-06-15')), nextDate: admin.firestore.Timestamp.fromDate(new Date('2027-06-15')), status: 'compliant' as const, certNumber: 'ISO27001-2024' },
    ]
    for (const c of compliance) {
      batch.set(db.collection('compliance').doc(), c)
    }

    // ── Seed warehouse (50+ items) ───────────────────────────────────
    const warehouse = [
      { code: 'WH-001', name: 'Bóng đèn LED 18W', category: 'Điện', unit: 'cái', quantity: 200, minStock: 50, location: 'Kho vật tư - Kệ A1', price: 45000 },
      { code: 'WH-002', name: 'Dây điện CV 2.5mm²', category: 'Điện', unit: 'm', quantity: 500, minStock: 100, location: 'Kho vật tư - Kệ A2', price: 18000 },
      { code: 'WH-003', name: 'Cầu chì 10A', category: 'Điện', unit: 'cái', quantity: 80, minStock: 20, location: 'Kho vật tư - Kệ A3', price: 25000 },
      { code: 'WH-004', name: 'Ổ cắm điện 3 chấu', category: 'Điện', unit: 'cái', quantity: 60, minStock: 15, location: 'Kho vật tư - Kệ A4', price: 85000 },
      { code: 'WH-005', name: 'Aptomat 32A', category: 'Điện', unit: 'cái', quantity: 30, minStock: 10, location: 'Kho vật tư - Kệ A5', price: 120000 },
      { code: 'WH-006', name: 'Van nước DN25', category: 'Nước', unit: 'cái', quantity: 40, minStock: 10, location: 'Kho vật tư - Kệ B1', price: 95000 },
      { code: 'WH-007', name: 'Ống PVC DN27', category: 'Nước', unit: 'm', quantity: 100, minStock: 30, location: 'Kho vật tư - Kệ B2', price: 35000 },
      { code: 'WH-008', name: 'Bộ lọc điều hòa AHU', category: 'HVAC', unit: 'bộ', quantity: 15, minStock: 5, location: 'Kho vật tư - Kệ C1', price: 850000 },
      { code: 'WH-009', name: 'Dầu máy nén lạnh', category: 'HVAC', unit: 'lít', quantity: 50, minStock: 10, location: 'Kho vật tư - Kệ C2', price: 220000 },
      { code: 'WH-010', name: 'Gas R-410A', category: 'HVAC', unit: 'kg', quantity: 20, minStock: 5, location: 'Kho vật tư - Kệ C3', price: 350000 },
      { code: 'WH-011', name: 'Bông lọc HEPA H14', category: 'HVAC', unit: 'tấm', quantity: 8, minStock: 3, location: 'Kho vật tư - Kệ C4', price: 2400000 },
      { code: 'WH-012', name: 'Bình chữa cháy CO2 5kg', category: 'PCCC', unit: 'cái', quantity: 25, minStock: 10, location: 'Kho PCCC - Kệ D1', price: 680000 },
      { code: 'WH-013', name: 'Bình chữa cháy bột 8kg', category: 'PCCC', unit: 'cái', quantity: 20, minStock: 8, location: 'Kho PCCC - Kệ D2', price: 450000 },
      { code: 'WH-014', name: 'Vật tư y tế tiêu hao', category: 'Y tế', unit: 'gói', quantity: 150, minStock: 30, location: 'Kho Y tế - Kệ E1', price: 120000 },
      { code: 'WH-015', name: 'Găng tay y tế', category: 'Y tế', unit: 'hộp', quantity: 80, minStock: 20, location: 'Kho Y tế - Kệ E2', price: 95000 },
      { code: 'WH-016', name: 'Dây điện CV 4mm²', category: 'Điện', unit: 'm', quantity: 300, minStock: 80, location: 'Kho vật tư - Kệ A6', price: 28000 },
      { code: 'WH-017', name: 'CB 1 pha 20A', category: 'Điện', unit: 'cái', quantity: 50, minStock: 15, location: 'Kho vật tư - Kệ A7', price: 75000 },
      { code: 'WH-018', name: 'Ống luồn dây điện DN20', category: 'Điện', unit: 'm', quantity: 200, minStock: 50, location: 'Kho vật tư - Kệ A8', price: 12000 },
      { code: 'WH-019', name: 'Van xả khí tự động', category: 'Nước', unit: 'cái', quantity: 25, minStock: 8, location: 'Kho vật tư - Kệ B3', price: 135000 },
      { code: 'WH-020', name: 'Bồn nước Inox 1000L', category: 'Nước', unit: 'cái', quantity: 5, minStock: 2, location: 'Kho vật tư - Kệ B4', price: 15000000 },
      { code: 'WH-021', name: 'Máy bơm nước CM 1.5HP', category: 'Nước', unit: 'cái', quantity: 4, minStock: 2, location: 'Kho vật tư - Kệ B5', price: 4500000 },
      { code: 'WH-022', name: 'Tấm lọc F7 AHU', category: 'HVAC', unit: 'tấm', quantity: 20, minStock: 5, location: 'Kho vật tư - Kệ C5', price: 480000 },
      { code: 'WH-023', name: 'Quạt hướng trục 25W', category: 'HVAC', unit: 'cái', quantity: 10, minStock: 3, location: 'Kho vật tư - Kệ C6', price: 1200000 },
      { code: 'WH-024', name: 'Gas R-32', category: 'HVAC', unit: 'kg', quantity: 15, minStock: 5, location: 'Kho vật tư - Kệ C7', price: 280000 },
      { code: 'WH-025', name: 'Bơm gas máy lạnh', category: 'HVAC', unit: 'cái', quantity: 3, minStock: 1, location: 'Kho vật tư - Kệ C8', price: 8500000 },
      { code: 'WH-026', name: 'Vòi chữa cháy DN50', category: 'PCCC', unit: 'cái', quantity: 15, minStock: 5, location: 'Kho PCCC - Kệ D3', price: 380000 },
      { code: 'WH-027', name: 'Đầu báo khói', category: 'PCCC', unit: 'cái', quantity: 30, minStock: 10, location: 'Kho PCCC - Kệ D4', price: 420000 },
      { code: 'WH-028', name: 'Bình sạc CO2 5kg', category: 'PCCC', unit: 'cái', quantity: 10, minStock: 5, location: 'Kho PCCC - Kệ D5', price: 680000 },
      { code: 'WH-029', name: 'Bông lọc G4 AHU', category: 'HVAC', unit: 'tấm', quantity: 30, minStock: 10, location: 'Kho vật tư - Kệ C9', price: 180000 },
      { code: 'WH-030', name: 'Ống PVC DN34', category: 'Nước', unit: 'm', quantity: 80, minStock: 20, location: 'Kho vật tư - Kệ B6', price: 48000 },
      { code: 'WH-031', name: 'Cáp mạng Cat6 305m', category: 'IT', unit: 'cuộn', quantity: 10, minStock: 3, location: 'Kho IT - Kệ F1', price: 2800000 },
      { code: 'WH-032', name: 'Patch cord Cat6 3m', category: 'IT', unit: 'cái', quantity: 100, minStock: 30, location: 'Kho IT - Kệ F2', price: 85000 },
      { code: 'WH-033', name: 'Switch PoE 24 port', category: 'IT', unit: 'cái', quantity: 5, minStock: 2, location: 'Kho IT - Kệ F3', price: 8500000 },
      { code: 'WH-034', name: 'Router WiFi 6', category: 'IT', unit: 'cái', quantity: 8, minStock: 3, location: 'Kho IT - Kệ F4', price: 2200000 },
      { code: 'WH-035', name: 'UPS 3kVA', category: 'IT', unit: 'cái', quantity: 3, minStock: 1, location: 'Kho IT - Kệ F5', price: 15000000 },
      { code: 'WH-036', name: 'HDD 4TB NAS', category: 'IT', unit: 'cái', quantity: 10, minStock: 3, location: 'Kho IT - Kệ F6', price: 3200000 },
      { code: 'WH-037', name: 'Máy in bill Y tế', category: 'IT', unit: 'cái', quantity: 6, minStock: 2, location: 'Kho IT - Kệ F7', price: 4500000 },
      { code: 'WH-038', name: 'Đèn exit thoát hiểm', category: 'PCCC', unit: 'cái', quantity: 40, minStock: 15, location: 'Kho PCCC - Kệ D6', price: 380000 },
      { code: 'WH-039', name: 'Bộ Kit PCCC di động', category: 'PCCC', unit: 'bộ', quantity: 6, minStock: 2, location: 'Kho PCCC - Kệ D7', price: 1200000 },
      { code: 'WH-040', name: 'Keo dán ống PVC', category: 'Nước', unit: 'lon', quantity: 50, minStock: 15, location: 'Kho vật tư - Kệ B7', price: 45000 },
      { code: 'WH-041', name: 'Băng tan nhiệt ống đồng', category: 'HVAC', unit: 'cuộn', quantity: 15, minStock: 5, location: 'Kho vật tư - Kệ C10', price: 180000 },
      { code: 'WH-042', name: 'Dây rút nhựa các kích cỡ', category: 'Điện', unit: 'gói', quantity: 100, minStock: 30, location: 'Kho vật tư - Kệ A9', price: 35000 },
      { code: 'WH-043', name: 'Thiết bị bảo hộ lao động', category: 'An toàn', unit: 'bộ', quantity: 30, minStock: 10, location: 'Kho An toàn - Kệ G1', price: 650000 },
      { code: 'WH-044', name: 'Găng tay cách điện', category: 'An toàn', unit: 'đôi', quantity: 20, minStock: 8, location: 'Kho An toàn - Kệ G2', price: 280000 },
      { code: 'WH-045', name: 'Kính bảo hộ', category: 'An toàn', unit: 'cái', quantity: 50, minStock: 15, location: 'Kho An toàn - Kệ G3', price: 85000 },
      { code: 'WH-046', name: 'Sơn dầu Alkyd', category: 'Xây dựng', unit: 'thùng', quantity: 20, minStock: 5, location: 'Kho XD - Kệ H1', price: 950000 },
      { code: 'WH-047', name: 'Xi măng PCB40', category: 'Xây dựng', unit: 'bao', quantity: 100, minStock: 30, location: 'Kho XD - Kệ H2', price: 85000 },
      { code: 'WH-048', name: 'Cát xây dựng', category: 'Xây dựng', unit: 'm³', quantity: 20, minStock: 5, location: 'Kho XD - Kệ H3', price: 180000 },
      { code: 'WH-049', name: 'Gạch ceramic 60x60', category: 'Xây dựng', unit: 'm²', quantity: 150, minStock: 40, location: 'Kho XD - Kệ H4', price: 220000 },
      { code: 'WH-050', name: 'Keo silicon trung tính', category: 'Xây dựng', unit: 'tuýp', quantity: 80, minStock: 25, location: 'Kho XD - Kệ H5', price: 65000 },
    ]
    for (const w of warehouse) {
      batch.set(db.collection('warehouse').doc(), w)
    }

    // ── Seed assets (40+ assets) ──────────────────────────────────────
    const assets = [
      { code: 'AST-001', name: 'Máy phát điện dự phòng 500kVA', category: 'Điện', location: 'Tầng hầm', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2020-03-15')), purchasePrice: 2500000000, usefulLifeYears: 15, salvageValue: 250000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-002', name: 'Hệ thống HVAC VRF 150kW', category: 'Cơ điện', location: 'Tầng 1-4', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2021-06-20')), purchasePrice: 4200000000, usefulLifeYears: 10, salvageValue: 420000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-003', name: 'Máy biến áp 1000kVA', category: 'Điện', location: 'Tầng hầm', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2019-08-10')), purchasePrice: 1800000000, usefulLifeYears: 20, salvageValue: 180000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-004', name: 'Hệ thống Camera CCTV 64 kênh', category: 'IT', location: 'Toàn bộ tòa nhà', dept: 'it' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-01-10')), purchasePrice: 950000000, usefulLifeYears: 7, salvageValue: 95000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-005', name: 'Thang máy khách 8 người', category: 'Cơ điện', location: 'Thang máy A', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2018-05-20')), purchasePrice: 3500000000, usefulLifeYears: 20, salvageValue: 350000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-006', name: 'Thang máy bệnh nhân 6 người', category: 'Cơ điện', location: 'Thang máy B', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2018-05-20')), purchasePrice: 3200000000, usefulLifeYears: 20, salvageValue: 320000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-007', name: 'Hệ thống mạng LAN 1000 ports', category: 'IT', location: 'Phòng Server', dept: 'it' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2021-03-15')), purchasePrice: 1200000000, usefulLifeYears: 7, salvageValue: 120000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-008', name: 'Hệ thống chấm công Vingroup', category: 'IT', location: 'Lobby tầng 1', dept: 'it' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2020-11-01')), purchasePrice: 350000000, usefulLifeYears: 5, salvageValue: 35000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-009', name: 'Bồn nước ngầm Inox 5000L', category: 'Cơ điện', location: 'Tầng hầm - Bể nước', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2018-06-01')), purchasePrice: 800000000, usefulLifeYears: 15, salvageValue: 80000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-010', name: 'Hệ thống UPS 30kVA', category: 'Điện', location: 'Phòng Server', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2021-09-01')), purchasePrice: 1500000000, usefulLifeYears: 10, salvageValue: 150000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-011', name: 'Máy photocopy Ricoh 7500', category: 'Văn phòng', location: 'Phòng hành chính', dept: 'admin' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-03-10')), purchasePrice: 450000000, usefulLifeYears: 5, salvageValue: 45000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-012', name: 'Hệ thống phát điện mặt trời 50kW', category: 'Điện', location: 'Mái tầng 5', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-06-15')), purchasePrice: 3500000000, usefulLifeYears: 20, salvageValue: 350000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-013', name: 'Thang máy vật liệu', category: 'Cơ điện', location: 'Thang máy vận chuyển', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2018-05-20')), purchasePrice: 1800000000, usefulLifeYears: 20, salvageValue: 180000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-014', name: 'Hệ thống âm thanh nội bộ PA', category: 'IT', location: 'Toàn bộ tòa nhà', dept: 'it' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2020-08-01')), purchasePrice: 550000000, usefulLifeYears: 8, salvageValue: 55000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-015', name: 'Hệ thống wifi công cộng', category: 'IT', location: 'Toàn bộ tòa nhà', dept: 'it' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-06-01')), purchasePrice: 680000000, usefulLifeYears: 5, salvageValue: 68000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-016', name: 'Máy chiếu laser Full HD', category: 'Văn phòng', location: 'Hội trường tầng 4', dept: 'admin' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-01-15')), purchasePrice: 120000000, usefulLifeYears: 5, salvageValue: 12000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-017', name: 'Máy in đa năng A3', category: 'Văn phòng', location: 'Phòng hành chính', dept: 'admin' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-05-01')), purchasePrice: 280000000, usefulLifeYears: 5, salvageValue: 28000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-018', name: 'Xe đẩy bệnh nhân', category: 'Y tế', location: 'Khoa Cấp cứu', dept: 'medical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2021-04-01')), purchasePrice: 35000000, usefulLifeYears: 8, salvageValue: 3500000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-019', name: 'Bình oxy y tế 40L', category: 'Y tế', location: 'Khoa Cấp cứu', dept: 'medical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-09-01')), purchasePrice: 8500000, usefulLifeYears: 10, salvageValue: 850000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-020', name: 'Tủ đông y tế -80°C', category: 'Y tế', location: 'Khoa Xét nghiệm', dept: 'medical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-02-01')), purchasePrice: 450000000, usefulLifeYears: 10, salvageValue: 45000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-021', name: 'Hệ thống giặt ủi công nghiệp', category: 'Hậu cần', location: 'Tầng hầm - Phòng giặt', dept: 'admin' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2019-12-01')), purchasePrice: 1200000000, usefulLifeYears: 12, salvageValue: 120000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-022', name: 'Máy hấp tiệt trùng EOG', category: 'Y tế', location: 'Khoa Khám bệnh', dept: 'medical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-06-15')), purchasePrice: 850000000, usefulLifeYears: 10, salvageValue: 85000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-023', name: 'Hệ thống xử lý nước thải 200m³/ngày', category: 'Môi trường', location: 'Tầng hầm - Trạm XLNT', dept: 'civil' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2019-03-01')), purchasePrice: 3500000000, usefulLifeYears: 20, salvageValue: 350000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-024', name: 'Bể chứa nước thải 50m³', category: 'Môi trường', location: 'Tầng hầm', dept: 'civil' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2019-03-01')), purchasePrice: 800000000, usefulLifeYears: 20, salvageValue: 80000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-025', name: 'Hệ thống lọc nước RO 500L/h', category: 'Môi trường', location: 'Tầng hầm', dept: 'civil' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2020-07-01')), purchasePrice: 680000000, usefulLifeYears: 10, salvageValue: 68000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-026', name: 'Máy photocopy Ricoh 5000', category: 'Văn phòng', location: 'Phòng kế toán', dept: 'admin' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2021-11-01')), purchasePrice: 320000000, usefulLifeYears: 5, salvageValue: 32000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-027', name: 'Máy lạnh cassette 5HP', category: 'Cơ điện', location: 'Phòng họp tầng 2', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-04-01')), purchasePrice: 45000000, usefulLifeYears: 8, salvageValue: 4500000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-028', name: 'Máy lạnh cassette 5HP', category: 'Cơ điện', location: 'Hội trường tầng 4', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-04-01')), purchasePrice: 45000000, usefulLifeYears: 8, salvageValue: 4500000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-029', name: 'Thiết bị PCCC di động', category: 'PCCC', location: 'Kho PCCC', dept: 'compliance' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-08-01')), purchasePrice: 280000000, usefulLifeYears: 10, salvageValue: 28000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-030', name: 'Cân sức khỏe kỹ thuật số', category: 'Y tế', location: 'Khoa Khám bệnh', dept: 'medical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-10-01')), purchasePrice: 15000000, usefulLifeYears: 5, salvageValue: 1500000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-031', name: 'Hệ thống BMS tòa nhà', category: 'Cơ điện', location: 'Phòng Server', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2018-06-01')), purchasePrice: 2800000000, usefulLifeYears: 15, salvageValue: 280000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-032', name: 'Hệ thống CCTV đầu ghi NVR 64CH', category: 'IT', location: 'Phòng bảo vệ', dept: 'it' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-01-10')), purchasePrice: 450000000, usefulLifeYears: 7, salvageValue: 45000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-033', name: 'Camera IP dome 4MP', category: 'IT', location: 'Toàn bộ tòa nhà', dept: 'it' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2022-01-10')), purchasePrice: 280000000, usefulLifeYears: 5, salvageValue: 28000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-034', name: 'Máy phát điện dự phòng 300kVA', category: 'Điện', location: 'Tầng hầm', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2019-07-15')), purchasePrice: 1800000000, usefulLifeYears: 15, salvageValue: 180000000, status: 'maintenance' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-035', name: 'Hệ thống khí y tế trung tâm O2', category: 'Y tế', location: 'Tầng hầm - Trạm khí', dept: 'medical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2018-06-01')), purchasePrice: 4500000000, usefulLifeYears: 20, salvageValue: 450000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-036', name: 'Thiết bị đo nồng độ khí', category: 'Môi trường', location: 'Tầng hầm - Trạm XLNT', dept: 'compliance' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2023-03-01')), purchasePrice: 180000000, usefulLifeYears: 5, salvageValue: 18000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-037', name: 'Máy hút ẩm công nghiệp', category: 'Cơ điện', location: 'Phòng Server', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2021-09-01')), purchasePrice: 45000000, usefulLifeYears: 8, salvageValue: 4500000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-038', name: 'Hệ thống chống sét tòa nhà', category: 'Điện', location: 'Mái và tầng hầm', dept: 'electrical' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2018-06-01')), purchasePrice: 650000000, usefulLifeYears: 15, salvageValue: 65000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-039', name: 'Hệ thống kiểm soát vào ra ACS', category: 'IT', location: 'Lobby và các cửa ra vào', dept: 'it' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2021-06-01')), purchasePrice: 750000000, usefulLifeYears: 7, salvageValue: 75000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
      { code: 'AST-040', name: 'Cửa cuốn chống cháy tầng hầm', category: 'Cơ điện', location: 'Tầng hầm', dept: 'civil' as const, purchaseDate: admin.firestore.Timestamp.fromDate(new Date('2018-06-01')), purchasePrice: 380000000, usefulLifeYears: 15, salvageValue: 38000000, status: 'active' as const, depreciationMethod: 'straight_line' as const },
    ]
    for (const a of assets) {
      batch.set(db.collection('assets').doc(), a)
    }

    // ── Seed vendors (20+ vendors) ───────────────────────────────────
    const vendors = [
      { name: 'Công ty TNHH Kỹ thuật Điện ABC', type: 'contractor' as const, contact: 'Nguyễn Văn A', phone: '02812345678', email: 'contact@abcdien.vn', address: '123 Điện Biên Phủ, Quận 3, TP.HCM', contracts: [{ id: 'CT-001', title: 'Hợp đồng bảo trì điện 2026', startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-31')), value: 180000000, status: 'active' as const }], rating: 4.5, status: 'active' as const },
      { name: 'Công ty CP Thiết bị Y tế MedTech', type: 'supplier' as const, contact: 'Trần Thị B', phone: '02823456789', email: 'sales@medtech.vn', address: '456 Nguyễn Trãi, Quận 5, TP.HCM', contracts: [{ id: 'CT-002', title: 'Cung cấp vật tư y tế 2026', startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-31')), value: 500000000, status: 'active' as const }], rating: 4.8, status: 'active' as const },
      { name: 'Dịch vụ Bảo trì HVAC Việt Nam', type: 'service' as const, contact: 'Lê Văn C', phone: '02834567890', email: 'info@hvacvietnam.com', address: '789 Lê Văn Việt, Quận 9, TP.HCM', contracts: [], rating: 4.2, status: 'active' as const },
      { name: 'Công ty PCCC Phú Thành', type: 'contractor' as const, contact: 'Phạm Văn D', phone: '02845678901', email: 'phuthanhpccc@vnn.vn', address: '321 Lý Thường Kiệt, Quận 10, TP.HCM', contracts: [{ id: 'CT-003', title: 'Kiểm tra PCCC định kỳ 2026', startDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2027-02-28')), value: 60000000, status: 'active' as const }], rating: 4.0, status: 'active' as const },
      { name: 'Nhà cung cấp vật tư xây dựng X', type: 'supplier' as const, contact: 'Hoàng Thị E', phone: '02856789012', email: 'sales@vtxdungx.vn', address: '654 Trần Hưng Đạo, Quận 1, TP.HCM', contracts: [], rating: 3.8, status: 'active' as const },
      { name: 'Công ty TNHH Điện Lạnh Nam Phát', type: 'contractor' as const, contact: 'Võ Minh Tuấn', phone: '02867890123', email: 'namphatdienlanh@gmail.com', address: '12 Trường Chinh, Quận Tân Bình, TP.HCM', contracts: [{ id: 'CT-004', title: 'Bảo trì điều hòa trung tâm 2026', startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-31')), value: 120000000, status: 'active' as const }], rating: 4.3, status: 'active' as const },
      { name: 'Công ty Vật tư Y tế Phúc An', type: 'supplier' as const, contact: 'Đặng Thị Phúc', phone: '02878901234', email: 'phucanyt@medsupplies.vn', address: '88 Võ Thị Sáu, Quận 3, TP.HCM', contracts: [{ id: 'CT-005', title: 'Cung cấp vật tư tiêu hao 2026', startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-31')), value: 350000000, status: 'active' as const }], rating: 4.6, status: 'active' as const },
      { name: 'Trung tâm Bảo trì Thiết bị Y tế Sài Gòn', type: 'service' as const, contact: 'Nguyễn Đình Hùng', phone: '02889012345', email: 'sggmedical@gmail.com', address: '56 Nguyễn Tri Phương, Quận 5, TP.HCM', contracts: [{ id: 'CT-006', title: 'Hợp đồng bảo trì thiết bị y tế 2026', startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-31')), value: 280000000, status: 'active' as const }], rating: 4.7, status: 'active' as const },
      { name: 'Công ty TNHH Giải pháp CNTT Gia Minh', type: 'supplier' as const, contact: 'Trần Gia Minh', phone: '02890123456', email: 'info@giaminh.com.vn', address: '200 Lê Văn Sỹ, Quận Tân Bình, TP.HCM', contracts: [], rating: 4.4, status: 'active' as const },
      { name: 'Công ty CP Nước sạch Sài Gòn', type: 'supplier' as const, contact: 'Lê Hoàng Nam', phone: '02801234567', email: 'cskh@nuocsachsg.com', address: '73 Đinh Tiên Hoàng, Quận 1, TP.HCM', contracts: [{ id: 'CT-007', title: 'Cung cấp nước sạch 2026', startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-31')), value: 450000000, status: 'active' as const }], rating: 4.1, status: 'active' as const },
      { name: 'Công ty Bảo vệ An Ninh Thành Phố', type: 'service' as const, contact: 'Phan Thanh Hùng', phone: '02812345000', email: 'anninh.tp@gmail.com', address: '45 Bà Huyện Thanh Quan, Quận 3, TP.HCM', contracts: [{ id: 'CT-008', title: 'Dịch vụ bảo vệ 2026', startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-31')), value: 960000000, status: 'active' as const }], rating: 4.2, status: 'active' as const },
      { name: 'Công ty TNHH Vệ sinh Môi trường Xanh', type: 'service' as const, contact: 'Bùi Thị Xanh', phone: '02823456001', email: 'xanhvesinh@gmail.com', address: '67 Lý Thái Tổ, Quận 10, TP.HCM', contracts: [{ id: 'CT-009', title: 'Dịch vụ vệ sinh 2026', startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-31')), value: 720000000, status: 'active' as const }], rating: 3.9, status: 'active' as const },
      { name: 'Công ty TNHH PCCC Thăng Long', type: 'contractor' as const, contact: 'Ngô Đình Thăng', phone: '02834567002', email: 'pcccthanglong@vnn.vn', address: '90 Trần Hưng Đạo, Quận 5, TP.HCM', contracts: [], rating: 4.5, status: 'active' as const },
      { name: 'Công ty CP Thiết bị IT Việt Nam', type: 'supplier' as const, contact: 'Trịnh Minh Quân', phone: '02845678003', email: 'sales@itvietnam.com', address: '34 Pasteur, Quận 1, TP.HCM', contracts: [], rating: 4.6, status: 'active' as const },
      { name: 'Dịch vụ Thẩm định An toàn Điện', type: 'service' as const, contact: 'Đặng Văn Hùng', phone: '02856789004', email: 'kdvantm@gmail.com', address: '78 Nguyễn Huệ, Quận 1, TP.HCM', contracts: [], rating: 4.3, status: 'active' as const },
      { name: 'Công ty TNHH Xây dựng Hồng Phát', type: 'contractor' as const, contact: 'Vũ Hồng Phát', phone: '02867890005', email: 'hongphatxd@gmail.com', address: '156 Cái Khế, Quận Ninh Kiều, Cần Thơ', contracts: [], rating: 4.0, status: 'active' as const },
      { name: 'Trung tâm Kiểm định Kỹ thuật An toàn', type: 'service' as const, contact: 'Hoàng Văn Kiên', phone: '02878901006', email: 'kiemdinhan.toan@gmail.com', address: '23 Nguyễn Văn Cừ, Quận 5, TP.HCM', contracts: [], rating: 4.7, status: 'active' as const },
      { name: 'Công ty TNHH Gas Công nghiệp Việt', type: 'supplier' as const, contact: 'Phạm Thị Hồng', phone: '02889012007', email: 'gascongnghiep@gmail.com', address: '89 Lê Quang Định, Quận Gò Vấp, TP.HCM', contracts: [], rating: 4.4, status: 'active' as const },
      { name: 'Dịch vụ Thẩm định Thiết bị Y tế', type: 'service' as const, contact: 'Lý Thị Mai', phone: '02890123008', email: 'thamdinhyt@gmail.com', address: '41 Võ Văn Kiệt, Quận 1, TP.HCM', contracts: [], rating: 4.8, status: 'active' as const },
      { name: 'Công ty TNHH Môi trường Xanh Việt', type: 'contractor' as const, contact: 'Trương Minh Tuấn', phone: '02801234009', email: 'moitruongxanhviet@gmail.com', address: '55 Lê Đại Hành, Quận 11, TP.HCM', contracts: [{ id: 'CT-010', title: 'Xử lý nước thải 2026', startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-12-31')), value: 240000000, status: 'active' as const }], rating: 4.1, status: 'active' as const },
    ]
    for (const v of vendors) {
      batch.set(db.collection('vendors').doc(), v)
    }

    // ── Seed environment logs (6 months) ──────────────────────────────
    const now = new Date()
    for (let i = 0; i < 180; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = admin.firestore.Timestamp.fromDate(date)
      batch.set(db.collection('environment').doc(), {
        type: 'energy' as const, date: dateStr,
        value: 2800 + Math.floor(Math.random() * 600),
        unit: 'kWh', category: 'Điện', notes: '',
      })
      if (i % 3 === 0) {
        batch.set(db.collection('environment').doc(), {
          type: 'water' as const, date: dateStr,
          value: 180 + Math.floor(Math.random() * 80),
          unit: 'm³', category: 'Nước', notes: '',
        })
      }
      if (i % 7 === 0) {
        batch.set(db.collection('environment').doc(), {
          type: 'waste' as const, date: dateStr,
          value: 120 + Math.floor(Math.random() * 50),
          unit: 'kg', category: 'Rác thải y tế', notes: '',
        })
      }
    }

    // ── Seed reports (12 months of KPIs) ────────────────────────────
    const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']
    for (let y = 2025; y <= 2026; y++) {
      for (let mi = 0; mi < 12; mi++) {
        if (y === 2026 && mi > 4) break
        const m = months[mi]
        batch.set(db.collection('reports').doc(), {
          month: m, year: y,
          kpis: {
            uptime: 95 + Math.floor(Math.random() * 5),
            workOrderCompletion: 80 + Math.floor(Math.random() * 18),
            energyEfficiency: 85 + Math.floor(Math.random() * 12),
            complianceRate: 88 + Math.floor(Math.random() * 12),
            assetUtilization: 70 + Math.floor(Math.random() * 25),
            incidentCount: Math.floor(Math.random() * 5),
          },
          costs: {
            maintenance: 80000000 + Math.floor(Math.random() * 40000000),
            electricity: 450000000 + Math.floor(Math.random() * 100000000),
            water: 80000000 + Math.floor(Math.random() * 20000000),
            medicalDevices: 120000000 + Math.floor(Math.random() * 80000000),
            civilWorks: 50000000 + Math.floor(Math.random() * 100000000),
            other: 30000000 + Math.floor(Math.random() * 20000000),
            total: 0,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }
    }

    // ── Seed civil projects (20+ projects) ────────────────────────────
    const civilProjects = [
      { name: 'Sửa chữa trần thạch cao tầng 3', description: 'Trần thạch cao tầng 3 bị nứt và ố vàng tại nhiều vị trí, cần sửa chữa và sơn lại.', location: 'Tầng 3 - Toàn bộ hành lang', status: 'in_progress' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-06-15')), budget: 150000000, spent: 65000000, manager: 'staff-07', progress: 45 },
      { name: 'Lắp đặt vách kính phòng họp tầng 4', description: 'Lắp đặt vách kính cường lực cho phòng họp tầng 4 để tăng không gian làm việc.', location: 'Tầng 4 - Phòng họp A', status: 'completed' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-04-30')), budget: 280000000, spent: 265000000, manager: 'staff-07', progress: 100 },
      { name: 'Cải tạo nhà vệ sinh tầng 2', description: 'Cải tạo 4 nhà vệ sinh tầng 2 theo tiêu chuẩn bệnh viện.', location: 'Tầng 2 - Nhà vệ sinh B', status: 'in_progress' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-15')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-07-30')), budget: 450000000, spent: 80000000, manager: 'staff-18', progress: 18 },
      { name: 'Sơn lại mặt tiền tòa nhà', description: 'Sơn lại mặt tiền tòa nhà chính và tầng 1 để cải thiện hình ảnh bệnh viện.', location: 'Mặt tiền tòa nhà', status: 'planning' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-07-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-09-30')), budget: 350000000, spent: 0, manager: 'staff-07', progress: 0 },
      { name: 'Xây dựng bãi giữ xe máy', description: 'Xây dựng bãi giữ xe máy có mái che cho nhân viên và bệnh nhân.', location: 'Khu vực sân sau', status: 'planning' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-08-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-10-30')), budget: 200000000, spent: 0, manager: 'staff-18', progress: 0 },
      { name: 'Nâng cấp hệ thống chiếu sáng LED', description: 'Thay thế toàn bộ đèn huỳnh quang tầng 1 bằng đèn LED tiết kiệm điện.', location: 'Tầng 1', status: 'in_progress' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-10')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-06-30')), budget: 180000000, spent: 95000000, manager: 'staff-07', progress: 55 },
      { name: 'Cải tạo phòng chờ khoa Cấp cứu', description: 'Mở rộng và nâng cấp phòng chờ khoa Cấp cứu để phục vụ bệnh nhân tốt hơn.', location: 'Tầng 1 - Khoa Cấp cứu', status: 'on_hold' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-06-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-09-30')), budget: 600000000, spent: 20000000, manager: 'staff-25', progress: 5 },
      { name: 'Lắp đặt mái che hành lang ngoài trời', description: 'Lắp đặt mái che polycarbonate cho hành lang tầng 1 để che nắng mưa.', location: 'Tầng 1 - Hành lang ngoài', status: 'completed' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-02-15')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-04-15')), budget: 220000000, spent: 215000000, manager: 'staff-07', progress: 100 },
      { name: 'Xây tường ngăn khu vực hành chính', description: 'Xây tường ngăn và lắp cửa kính để phân chia khu vực hành chính.', location: 'Tầng 5 - Khu hành chính', status: 'in_progress' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-20')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-07-10')), budget: 120000000, spent: 48000000, manager: 'staff-18', progress: 40 },
      { name: 'Cải tạo cầu thang B', description: 'Thay thế đá granite bậc cầu thang B và sơn lại lan can.', location: 'Cầu thang B', status: 'planning' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-07-15')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-08-30')), budget: 95000000, spent: 0, manager: 'staff-07', progress: 0 },
      { name: 'Sửa chữa mái tôn tầng hầm', description: 'Mái tôn tầng hầm bị rỉ sét nghiêm trọng, cần thay mới.', location: 'Tầng hầm - Mái tôn', status: 'in_progress' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-05')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-06-20')), budget: 85000000, spent: 30000000, manager: 'staff-25', progress: 35 },
      { name: 'Lắp đặt biển chỉ dẫn bệnh viện', description: 'Lắp đặt hệ thống biển chỉ dẫn bằng mica và Inox trên toàn tòa nhà.', location: 'Toàn bộ tòa nhà', status: 'completed' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-15')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-15')), budget: 65000000, spent: 62000000, manager: 'staff-18', progress: 100 },
      { name: 'Nâng nền sân bãi', description: 'Nâng nền và lát gạch block khu vực sân bãi phía sau bệnh viện.', location: 'Sân sau bệnh viện', status: 'planning' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-09-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-11-30')), budget: 380000000, spent: 0, manager: 'staff-07', progress: 0 },
      { name: 'Cải tạo phòng nghỉ nhân viên', description: 'Cải tạo phòng nghỉ nhân viên tầng 5 với nội thất mới.', location: 'Tầng 5 - Phòng nghỉ', status: 'completed' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-10')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-10')), budget: 180000000, spent: 175000000, manager: 'staff-25', progress: 100 },
      { name: 'Lắp camera an ninh khu vực ngoài', description: 'Lắp đặt 8 camera IP ngoài trời giám sát khuôn viên bệnh viện.', location: 'Khuôn viên bệnh viện', status: 'completed' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-02-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-31')), budget: 140000000, spent: 138000000, manager: 'staff-18', progress: 100 },
      { name: 'Xây bồn hoa trước cửa bệnh viện', description: 'Xây dựng bồn hoa và cảnh quan trước cửa chính bệnh viện.', location: 'Sân trước bệnh viện', status: 'in_progress' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-25')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-07-15')), budget: 95000000, spent: 35000000, manager: 'staff-07', progress: 38 },
      { name: 'Sửa chữa cửa kính tự động', description: 'Thay thế motor và ray cửa kính tự động lối vào chính.', location: 'Lối vào chính tầng 1', status: 'completed' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-04-01')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-04-30')), budget: 75000000, spent: 72000000, manager: 'staff-25', progress: 100 },
      { name: 'Lắp đặt hệ thống thoát nước mưa', description: 'Lắp đặt ống thoát nước mưa dọc tường tầng 4 và 5.', location: 'Tầng 4-5 - Tường ngoài', status: 'in_progress' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-08')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-06-25')), budget: 110000000, spent: 55000000, manager: 'staff-18', progress: 50 },
      { name: 'Cải tạo sân thượng tầng 5', description: 'Chống thấm và lát gạch chống trượt sân thượng tầng 5.', location: 'Sân thượng tầng 5', status: 'planning' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-08-15')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-10-15')), budget: 280000000, spent: 0, manager: 'staff-07', progress: 0 },
      { name: 'Thay thế cửa nhôm kính phòng mổ', description: 'Thay thế 6 bộ cửa nhôm kính tại khu vực phòng mổ đạt chuẩn.', location: 'Tầng 3 - Khu vực phòng mổ', status: 'planning' as const, startDate: admin.firestore.Timestamp.fromDate(new Date('2026-09-15')), endDate: admin.firestore.Timestamp.fromDate(new Date('2026-11-15')), budget: 320000000, spent: 0, manager: 'staff-25', progress: 0 },
    ]
    for (const cp of civilProjects) {
      batch.set(db.collection('civilProjects').doc(), cp)
    }

    // Mark seed as done
    batch.set(db.doc('meta/seedStatus'), {
      seededAt: admin.firestore.FieldValue.serverTimestamp(),
      seededBy: user.uid,
    })

    await batch.commit()
    console.log('Seed completed successfully')
  })
