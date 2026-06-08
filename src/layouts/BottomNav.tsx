import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Cpu, Wrench, Menu, BarChart3, X,
  Flame, HardHat, Stethoscope, ShieldCheck, Warehouse,
  Box, Users, Leaf, ClipboardCheck, Search, GraduationCap,
} from 'lucide-react'
import { listenInventory } from '@/firebase/db'
import { rolePermissions } from '@/config/rolePermissions'
import { useAuth } from '@/contexts/AuthContext'

const MAIN_TABS = [
  { to: '/', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/maintenance', icon: Wrench, label: 'Bảo trì' },
  { to: '/medical-devices', icon: Stethoscope, label: 'Thiết bị' },
]

const MORE_ITEMS = [
  { to: '/org', icon: Users, label: 'Tổ chức', module: 'org' },
  { to: '/infra', icon: Cpu, label: 'Hạ tầng', module: 'infra' },
  { to: '/fire-safety', icon: Flame, label: 'PCCC', module: 'fireSafety' },
  { to: '/civil', icon: HardHat, label: 'Xây dựng', module: 'civil' },
  { to: '/five-s', icon: ClipboardCheck, label: '5S', module: 'fiveS' },
  { to: '/patrol', icon: Search, label: 'Tuần tra', module: 'patrol' },
  { to: '/compliance', icon: ShieldCheck, label: 'Compliance', module: 'compliance' },
  { to: '/warehouse', icon: Warehouse, label: 'Kho', module: 'warehouse', badge: true },
  { to: '/assets', icon: Box, label: 'Tài sản', module: 'assets' },
  { to: '/vendors', icon: Users, label: 'Nhà cung cấp', module: 'vendors' },
  { to: '/environment', icon: Leaf, label: 'Môi trường', module: 'environment' },
  { to: '/reports', icon: BarChart3, label: 'Báo cáo', module: 'reports' },
  { to: '/training', icon: GraduationCap, label: 'Đào tạo', module: 'training' },
]

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [lowStockCount, setLowStockCount] = useState(0)

  // P2.3: Filter nav items by role permission
  const visibleMoreItems = MORE_ITEMS.filter((item) => {
    const perm = (rolePermissions[user?.role ?? '']?.[item.module as keyof typeof rolePermissions[string]] as string | undefined) ?? 'none'
    return perm !== 'none'
  })
  const canSeeReports = (rolePermissions[user?.role ?? '']?.reports as string | undefined) !== 'none'

  useEffect(() => {
    const unsub = listenInventory((items) => {
      setLowStockCount(items.filter((i) => i.quantity < i.minQuantity).length)
    })
    return () => unsub()
  }, [])

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  const moreActiveMobile = visibleMoreItems.some((m) => location.pathname.startsWith(m.to))

  return (
    <>
      {/* Mobile bottom nav — visible only on < lg */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-bottom"
        style={{
          background: '#111827',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          height: '64px',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-stretch h-full">
          {/* 3 main tabs */}
          {MAIN_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive(tab.to) ? 'text-amber' : 'text-t3'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${isActive(tab.to) ? '' : ''}`} />
              <span>{tab.label}</span>
            </NavLink>
          ))}

          {/* More tab */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              moreActiveMobile ? 'text-amber' : 'text-t3'
            }`}
          >
            {moreOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
            <span>{moreOpen ? 'Đóng' : 'Khác'}</span>
          </button>

          {/* Reports tab */}
          {canSeeReports && (
            <NavLink
              to="/reports"
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive('/reports') ? 'text-amber' : 'text-t3'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Báo cáo</span>
            </NavLink>
          )}
        </div>
      </nav>

      {/* Mobile "More" bottom sheet */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            style={{ top: 0, bottom: 0 }}
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div
            className="lg:hidden fixed left-0 right-0 z-50 rounded-t-2xl shadow-2xl"
            style={{
              bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
              background: '#111827',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-9 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <h3 className="font-semibold text-gray-100 text-sm">Modules</h3>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 text-t3 hover:text-gray-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-4 gap-2 p-3">
              {visibleMoreItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive: a }) =>
                    `relative flex flex-col items-center gap-1.5 p-3 rounded-xl text-[10px] font-medium transition-colors min-h-[72px] justify-center ${
                      a ? 'bg-amber/10 text-amber' : 'text-t2 hover:bg-white/[0.05]'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-center leading-tight">{item.label}</span>
                  {item.badge && lowStockCount > 0 && (
                    <span className="absolute top-2 right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
                      {lowStockCount > 99 ? '99+' : lowStockCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Bottom padding for safe area */}
            <div style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
          </div>
        </>
      )}
    </>
  )
}
