import { Bell, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Tổng quan',
  '/org': 'Tổ chức',
  '/infra': 'Hạ tầng',
  '/maintenance': 'Bảo trì',
  '/fire-safety': 'PCCC',
  '/civil': 'Xây dựng',
  '/medical-devices': 'Thiết bị Y tế',
  '/compliance': 'Compliance',
  '/warehouse': 'Kho',
  '/assets': 'Tài sản',
  '/vendors': 'Nhà cung cấp',
  '/environment': 'Môi trường',
  '/reports': 'Báo cáo KPI',
}

function getPageTitle(pathname: string) {
  return PAGE_TITLES[pathname] || 'BMS Hospital'
}

export default function Topbar({ pathname }: { pathname: string }) {
  const { user } = useAuth()

  return (
    <div className="bg-ink-2 border-b border-white/[0.07] px-4 py-3 flex items-center justify-between">
      <div>
        <h2 className="font-semibold text-gray-100 text-sm">{getPageTitle(pathname)}</h2>
        <p className="text-[10px] text-t3">{user?.displayName || user?.email}</p>
      </div>
      <div className="flex items-center gap-1">
        <button className="relative p-2 text-t2 hover:text-gray-200 hover:bg-white/[0.05] rounded-lg transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-amber rounded-full" />
        </button>
        <div className="w-8 h-8 bg-amber/20 text-amber rounded-full flex items-center justify-center ml-1">
          <User className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}
