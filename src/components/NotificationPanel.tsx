import { X, Bell, Wrench, Package, Activity, FileText, Settings, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, type Notification } from '@/hooks/useNotifications'
import { useAuth } from '@/contexts/AuthContext'

const TYPE_META: Record<Notification['type'], { icon: React.ElementType; color: string; bg: string }> = {
  workOrder: { icon: Wrench, color: 'text-amber', bg: 'bg-amber/10' },
  inventory: { icon: Package, color: 'text-red-400', bg: 'bg-red-500/10' },
  device: { icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  document: { icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  system: { icon: Settings, color: 'text-gray-400', bg: 'bg-white/[0.06]' },
}

function timeAgo(date: Date | undefined): string {
  if (!date) return ''
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hôm qua'
  return `${days} ngày trước`
}

function getCreatedAt(notification: Notification): Date | undefined {
  if (!notification.createdAt) return undefined
  if (notification.createdAt instanceof Date) return notification.createdAt
  return notification.createdAt.toDate()
}

interface NotificationItemRowProps {
  notification: Notification
  onClick: (n: Notification) => void
}

function NotificationItemRow({ notification, onClick }: NotificationItemRowProps) {
  const meta = TYPE_META[notification.type] || TYPE_META.system
  const Icon = meta.icon
  const isUrgent = notification.priority === 'urgent'
  const createdAt = getCreatedAt(notification)

  return (
    <button
      onClick={() => onClick(notification)}
      className={`
        w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left
        border-l-[3px] border-transparent
        ${isUrgent ? 'border-l-danger bg-red-500/5' : 'hover:border-l-amber/40'}
      `}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.bg}`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-medium leading-snug ${notification.isRead ? 'text-t2' : 'text-t1'}`}>
          {notification.title}
        </p>
        <p className="text-[12px] text-t2 mt-0.5 line-clamp-2 leading-relaxed">
          {notification.body}
        </p>
        <p className="text-[11px] text-t3 mt-1">{timeAgo(createdAt)}</p>
      </div>

      {!notification.isRead && (
        <div className="w-1.5 h-1.5 rounded-full bg-amber shrink-0 mt-2" />
      )}
    </button>
  )
}

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { items, unreadCount, isLoading, markRead, markAllRead } = useNotifications(user?.uid)

  const handleItemClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markRead(notification.id)
    }
    if (notification.link) {
      navigate(notification.link)
    }
    onClose()
  }

  const handleMarkAll = async () => {
    await markAllRead()
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[360px] max-w-full bg-ink-2 border-l border-white/[0.07] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-gray-100">Thông báo</h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber/15 text-amber">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-t2 hover:text-t1 hover:bg-white/[0.05] rounded-lg transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Đánh dấu tất cả đã đọc
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-t2 hover:text-gray-200 hover:bg-white/[0.05] rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 gap-3">
              <div className="w-12 h-12 rounded-full bg-white/[0.05] flex items-center justify-center">
                <Bell className="w-6 h-6 text-t3" />
              </div>
              <p className="text-sm text-t2">Không có thông báo mới</p>
            </div>
          ) : (
            <div className="py-1">
              {items.map((notification) => (
                <NotificationItemRow
                  key={notification.id}
                  notification={notification}
                  onClick={handleItemClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
