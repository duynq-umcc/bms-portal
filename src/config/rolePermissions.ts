// Role-based permission matrix for the BMS portal
// Used in the Admin Users → Phân quyền tab

export type PermissionLevel = 'full' | 'readWrite' | 'readOnly' | 'none'

export const rolePermissions: Record<string, Record<string, PermissionLevel>> = {
  admin: {
    dashboard: 'full',
    org: 'full',
    infra: 'full',
    maintenance: 'full',
    fireSafety: 'full',
    civil: 'full',
    medicalDevices: 'full',
    compliance: 'full',
    warehouse: 'full',
    assets: 'full',
    vendors: 'full',
    environment: 'full',
    reports: 'full',
    fiveS: 'full',
    patrol: 'full',
    training: 'full',
    adminUsers: 'full',
    adminNotifications: 'full',
  },
  manager: {
    dashboard: 'readWrite',
    org: 'readOnly',
    infra: 'readWrite',
    maintenance: 'readWrite',
    fireSafety: 'readWrite',
    civil: 'readWrite',
    medicalDevices: 'readWrite',
    compliance: 'readOnly',
    warehouse: 'readWrite',
    assets: 'readOnly',
    vendors: 'readWrite',
    environment: 'readWrite',
    reports: 'readOnly',
    fiveS: 'readWrite',
    patrol: 'readWrite',
    training: 'readWrite',
    adminUsers: 'none',
    adminNotifications: 'none',
  },
  technician: {
    dashboard: 'readOnly',
    org: 'readOnly',
    infra: 'readOnly',
    maintenance: 'readWrite',
    fireSafety: 'readOnly',
    civil: 'readOnly',
    medicalDevices: 'readOnly',
    compliance: 'readOnly',
    warehouse: 'readOnly',
    assets: 'readOnly',
    vendors: 'readOnly',
    environment: 'readOnly',
    reports: 'none',
    fiveS: 'readOnly',
    patrol: 'readOnly',
    training: 'readOnly',
    adminUsers: 'none',
    adminNotifications: 'none',
  },
}

export const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'org', label: 'Sơ đồ tổ chức' },
  { key: 'infra', label: 'Vận hành hệ thống' },
  { key: 'maintenance', label: 'Bảo trì – Sửa chữa' },
  { key: 'fireSafety', label: 'PCCC & An toàn' },
  { key: 'civil', label: 'Xây dựng dân dụng' },
  { key: 'medicalDevices', label: 'Thiết bị Y tế' },
  { key: 'compliance', label: 'Kiểm định & Pháp lý' },
  { key: 'warehouse', label: 'Kho VT-TTB' },
  { key: 'assets', label: 'Tài sản cố định' },
  { key: 'vendors', label: 'Nhà thầu & Dịch vụ' },
  { key: 'environment', label: 'Môi trường' },
  { key: 'reports', label: 'Báo cáo & KPI' },
  { key: 'fiveS', label: 'Kiểm tra 5S' },
  { key: 'patrol', label: 'Tuần tra công trình' },
  { key: 'training', label: 'Đào tạo & Chứng chỉ' },
  { key: 'adminUsers', label: 'Quản trị người dùng' },
  { key: 'adminNotifications', label: 'Cài đặt thông báo' },
]

export const PERMISSION_LABELS: Record<PermissionLevel, { label: string; color: string; bg: string }> = {
  full: { label: 'Toàn quyền', color: 'text-amber', bg: 'bg-amber/15 text-amber' },
  readWrite: { label: 'Đọc + Ghi', color: 'text-teal-400', bg: 'bg-teal-500/15 text-teal-400' },
  readOnly: { label: 'Chỉ đọc', color: 'text-blue-400', bg: 'bg-blue-500/15 text-blue-400' },
  none: { label: 'Không có', color: 'text-t3', bg: 'bg-white/[0.06] text-t3' },
}

export const ROLE_META: Record<string, { label: string; desc: string }> = {
  admin: {
    label: 'Quản trị',
    desc: 'Dành cho Trưởng phòng, Phó phòng — toàn quyền quản trị hệ thống',
  },
  manager: {
    label: 'Quản lý',
    desc: 'Dành cho Tổ trưởng — điều phối và giao việc',
  },
  technician: {
    label: 'Kỹ thuật',
    desc: 'Dành cho NV kỹ thuật — thực hiện và cập nhật công việc',
  },
}

export const DEPARTMENTS = [
  { value: 'maintenance', label: 'Bảo trì – Kỹ thuật' },
  { value: 'warehouse', label: 'Kho VT-TTB' },
  { value: 'admin', label: 'Ban Giám đốc' },
  { value: 'it', label: 'Hành chính' },
  { value: 'viewer', label: 'Khác' },
] as const

export type DeptValue = (typeof DEPARTMENTS)[number]['value']

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: 'tạo tài khoản',
  update_role: 'đổi vai trò',
  deactivate: 'vô hiệu hóa',
  reactivate: 'kích hoạt lại',
  reset_password: 'đặt lại mật khẩu',
}

export const AUDIT_ACTION_DOTS: Record<string, string> = {
  create: 'bg-green-500',
  update_role: 'bg-amber',
  deactivate: 'bg-red-500',
  reactivate: 'bg-teal-500',
  reset_password: 'bg-blue-500',
}
