import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useAlertEngine } from '@/hooks/useAlertEngine'
import { useKpiEngine } from '@/hooks/useKpiEngine'
import BottomNav from './BottomNav'
import OfflineBanner from '@/components/OfflineBanner'
import { NotificationPanel } from '@/components/NotificationPanel'
import { useNotifications } from '@/hooks/useNotifications'
import { useFCMToken } from '@/hooks/useFCMToken'
import { PushPermissionBanner } from '@/components/PushPermissionBanner'
// firestoreHealthCheck runs on app mount in dev mode only
if (import.meta.env.DEV) {
  import('@/utils/firestoreHealthCheck').then(({ runHealthCheck }) => runHealthCheck())
}
import { LogOut, User, Bell, X, Menu, Search } from 'lucide-react'
import { useState } from 'react'
import {
  LayoutDashboard, Cpu, Wrench, Flame, HardHat,
  Stethoscope, ShieldCheck, Warehouse, Box, Users,
  Leaf, BarChart3, BellRing,
} from 'lucide-react'

// ─── Section-grouped sidebar items ───────────────────────────────────────────
const SIDEBAR_SECTIONS = [
  {
    label: 'Tổng quan',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Vận hành',
    items: [
      { to: '/infra', icon: Cpu, label: 'Vận hành hệ thống' },
      { to: '/maintenance', icon: Wrench, label: 'Bảo trì – Sửa chữa' },
      { to: '/fire-safety', icon: Flame, label: 'PCCC & An toàn' },
      { to: '/civil', icon: HardHat, label: 'Xây dựng dân dụng' },
    ],
  },
  {
    label: 'Thiết bị & Tài sản',
    items: [
      { to: '/medical-devices', icon: Stethoscope, label: 'Thiết bị Y tế' },
      { to: '/compliance', icon: ShieldCheck, label: 'Kiểm định & Pháp lý' },
      { to: '/warehouse', icon: Warehouse, label: 'Kho VT-TTB' },
      { to: '/assets', icon: Box, label: 'Tài sản cố định' },
    ],
  },
  {
    label: 'Tổ chức',
    items: [
      { to: '/org', icon: Users, label: 'Sơ đồ tổ chức' },
      { to: '/vendors', icon: Users, label: 'Nhà thầu & Dịch vụ' },
    ],
  },
  {
    label: 'Phân tích',
    items: [
      { to: '/environment', icon: Leaf, label: 'Môi trường' },
      { to: '/reports', icon: BarChart3, label: 'Báo cáo & KPI' },
    ],
  },
]

const ADMIN_SECTION = {
  label: 'Quản trị',
  items: [
    { to: '/admin/notifications', icon: BellRing, label: 'Cài đặt thông báo' },
    { to: '/admin/users', icon: Users, label: 'Người dùng' },
  ],
}

function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-ink-2 border-r border-white/[0.07] h-screen sticky top-0 shrink-0 z-30">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-amber rounded-lg flex items-center justify-center shrink-0">
            <span className="text-ink font-extrabold text-sm tracking-tight">BMS</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-100 text-sm leading-none">BMS Hospital</h1>
            <p className="text-[10px] text-t3 mt-0.5">Quản lý Tòa nhà</p>
          </div>
        </div>
      </div>

      {/* Nav — section-grouped */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="sidebar-section-label">{section.label}</p>
            {section.items.map((item) => (
              <NavItem key={item.to} {...item} active={isActive(item.to)} onClick={() => navigate(item.to)} />
            ))}
          </div>
        ))}

        {isAdmin && (
          <div className="mt-2">
            <p className="sidebar-section-label">{ADMIN_SECTION.label}</p>
            {ADMIN_SECTION.items.map((item) => (
              <NavItem key={item.to} {...item} active={isActive(item.to)} onClick={() => navigate(item.to)} />
            ))}
          </div>
        )}
      </nav>
    </aside>
  )
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType
  label: string
  active: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 text-left
        ${active
          ? 'bg-amber/12 text-amber border-l-[3px] border-amber pl-[9px]'
          : 'text-t2 hover:bg-white/[0.04] hover:text-gray-200'
        }
      `}
    >
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber' : ''}`} />
      <span className="text-[13px]">{label}</span>
    </button>
  )
}

function SidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  if (!open) return null

  const handleNavigate = (to: string) => {
    onClose()
    navigate(to)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 w-60 bg-ink-2 border-r border-white/[0.07] z-50 lg:hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-amber rounded-lg flex items-center justify-center">
              <span className="text-ink font-extrabold text-sm tracking-tight">BMS</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-100 text-sm leading-none">BMS Hospital</h1>
              <p className="text-[10px] text-t3 mt-0.5">Quản lý Tòa nhà</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-t2 hover:text-gray-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="sidebar-section-label">{section.label}</p>
              {section.items.map((item) => (
                <button
                  key={item.to}
                  onClick={() => handleNavigate(item.to)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 text-left
                    ${isActive(item.to)
                      ? 'bg-amber/10 text-amber'
                      : 'text-t2 hover:bg-white/[0.05] hover:text-gray-200'
                    }
                  `}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="text-[13px]">{item.label}</span>
                </button>
              ))}
            </div>
          ))}

          {isAdmin && (
            <div className="mt-2">
              <p className="sidebar-section-label">{ADMIN_SECTION.label}</p>
              {ADMIN_SECTION.items.map((item) => (
                <button
                  key={item.to}
                  onClick={() => handleNavigate(item.to)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 text-left
                    ${isActive(item.to)
                      ? 'bg-amber/10 text-amber'
                      : 'text-t2 hover:bg-white/[0.05] hover:text-gray-200'
                    }
                  `}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="text-[13px]">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </nav>
      </div>
    </>
  )
}

// ─── Role color for avatar ──────────────────────────────────────────────────────
const ROLE_AVATAR: Record<string, string> = {
  admin: 'bg-amber/20 text-amber',
  manager: 'bg-teal-500/20 text-teal-400',
  technician: 'bg-blue-500/20 text-blue-400',
  viewer: 'bg-white/[0.08] text-t2',
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const { unreadCount } = useNotifications(user?.uid)

  const role = user?.role || 'viewer'
  const roleColor = ROLE_AVATAR[role] || ROLE_AVATAR.viewer

  const getInitials = (name?: string | null) => {
    if (!name) return '?'
    return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
  }

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <>
    <header className="bg-ink-2 border-b border-white/[0.07] px-4 lg:px-6 py-3 flex items-center justify-between shrink-0 z-20">
      {/* Left: hamburger (mobile) + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-t2 hover:text-gray-200 hover:bg-white/[0.05] rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search — desktop */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/[0.05] border border-white/[0.07] rounded-lg w-64">
          <Search className="w-4 h-4 text-t3 shrink-0" />
          <input
            placeholder="Tìm kiếm..."
            className="bg-transparent text-sm text-gray-200 placeholder-t3 outline-none w-full"
          />
        </div>
      </div>

      {/* Right: notification + user info */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setNotifOpen(true)}
          className="relative p-2 text-t2 hover:text-gray-200 hover:bg-white/[0.05] rounded-lg transition-colors"
        >
          <Bell className="w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full animate-pulse-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User avatar + name on desktop */}
        <div className="hidden lg:flex items-center gap-2 ml-1">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${roleColor}`}>
            {getInitials(user?.displayName)}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gray-100 leading-none">{user?.displayName || user?.email}</p>
            <p className="text-[10px] text-t3 mt-0.5 uppercase tracking-wide">{role}</p>
          </div>
        </div>

        {/* Avatar circle (mobile) */}
        <div className={`lg:hidden w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${roleColor}`}>
          {getInitials(user?.displayName)}
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 p-1.5 hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <div className="w-7 h-7 bg-amber/20 text-amber rounded-full flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-ink-2 rounded-xl shadow-xl border border-white/[0.1] z-20 overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-white/[0.07]">
                  <p className="text-sm font-medium text-gray-100">{user?.displayName || 'User'}</p>
                  <p className="text-[11px] text-t3 mt-0.5">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-t2 hover:bg-white/[0.05] hover:text-gray-200 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
    <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  )
}

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Run alert checks only for manager/admin (hook guards internally)
  useAlertEngine()

  // Compute and cache technician KPIs hourly (admin/manager only)
  useKpiEngine()

  // Register FCM service worker and manage push token for all authenticated users
  useFCMToken()

  return (
    <div className="flex min-h-screen bg-ink">
      <OfflineBanner />
      <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-h-screen flex-1 min-w-0">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <Header onMenuClick={() => setDrawerOpen(true)} />

          <main className="flex-1 p-4 lg:px-8 lg:py-6 pb-20 lg:pb-6">
            <Outlet />
          </main>
        </div>
      </div>

      <BottomNav />

      <PushPermissionBanner />
    </div>
  )
}

