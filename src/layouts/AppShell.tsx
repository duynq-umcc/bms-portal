import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import BottomNav from './BottomNav'
import OfflineBanner from '@/components/OfflineBanner'
// firestoreHealthCheck runs on app mount in dev mode only
if (import.meta.env.DEV) {
  import('@/utils/firestoreHealthCheck').then(({ runHealthCheck }) => runHealthCheck())
}
import { LogOut, User, Bell, X, Menu } from 'lucide-react'
import { useState } from 'react'
import {
  LayoutDashboard, Cpu, Wrench, Flame, HardHat,
  Stethoscope, ShieldCheck, Warehouse, Box, Users,
  Leaf, BarChart3,
} from 'lucide-react'

const SIDEBAR_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/infra', icon: Cpu, label: 'Hạ tầng' },
  { to: '/maintenance', icon: Wrench, label: 'Bảo trì' },
  { to: '/fire-safety', icon: Flame, label: 'PCCC' },
  { to: '/civil', icon: HardHat, label: 'Xây dựng' },
  { to: '/medical-devices', icon: Stethoscope, label: 'Thiết bị Y tế' },
  { to: '/compliance', icon: ShieldCheck, label: 'Compliance' },
  { to: '/warehouse', icon: Warehouse, label: 'Kho' },
  { to: '/assets', icon: Box, label: 'Tài sản' },
  { to: '/vendors', icon: Users, label: 'Nhà cung cấp' },
  { to: '/environment', icon: Leaf, label: 'Môi trường' },
  { to: '/org', icon: Users, label: 'Tổ chức' },
  { to: '/reports', icon: BarChart3, label: 'Báo cáo KPI' },
]

function Sidebar() {
  const location = useLocation()
  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-ink-2 border-r border-white/[0.07] h-screen sticky top-0 shrink-0">
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {SIDEBAR_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} active={isActive(item.to)} />
        ))}
      </nav>
    </aside>
  )
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string
  icon: React.ElementType
  label: string
  active: boolean
}) {
  return (
    <a
      href={`#${to}`}
      onClick={(e) => { e.preventDefault(); window.location.hash = to; window.location.href = `${window.location.pathname}${window.location.search}${to}` }}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5
        ${active
          ? 'bg-amber/10 text-amber'
          : 'text-t2 hover:bg-white/[0.05] hover:text-gray-200'
        }
      `}
    >
      <Icon className={`w-4.5 h-4.5 shrink-0 ${active ? 'text-amber' : ''}`} />
      <span>{label}</span>
    </a>
  )
}

function SidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()
  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  if (!open) return null

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
          {SIDEBAR_ITEMS.map((item) => (
            <a
              key={item.to}
              href={item.to}
              onClick={(e) => { e.preventDefault(); window.location.href = item.to; onClose() }}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5
                ${isActive(item.to)
                  ? 'bg-amber/10 text-amber'
                  : 'text-t2 hover:bg-white/[0.05] hover:text-gray-200'
                }
              `}
            >
              <item.icon className="w-4.5 h-4.5 shrink-0" />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </>
  )
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <header className="bg-ink-2 border-b border-white/[0.07] px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-t2 hover:text-gray-200 hover:bg-white/[0.05] rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-semibold text-gray-100 text-sm">BMS Hospital</h2>
          <p className="text-[11px] text-t3">{user?.displayName || user?.email} · {deptLabel(user?.dept)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button className="relative p-2 text-t2 hover:text-gray-200 hover:bg-white/[0.05] rounded-lg transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-amber rounded-full" />
        </button>
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
  )
}

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-ink">
      <OfflineBanner />
      <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-h-screen flex-1 min-w-0">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <Header onMenuClick={() => setDrawerOpen(true)} />

          <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
            <Outlet />
          </main>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

function deptLabel(dept?: string) {
  const labels: Record<string, string> = {
    admin: 'Quản trị',
    it: 'CNTT',
    electrical: 'Điện',
    medical: 'Y tế',
    warehouse: 'Kho',
    compliance: 'Compliance',
    civil: 'Xây dựng',
    viewer: 'Người xem',
  }
  return labels[dept || ''] || dept || ''
}
