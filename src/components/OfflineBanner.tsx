import { useState, useEffect } from 'react'
import { WifiOff, X } from 'lucide-react'

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handleOffline = () => { setIsOffline(true); setDismissed(false) }
    const handleOnline = () => { setIsOffline(false) }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline || dismissed) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-3 py-2 text-sm font-medium"
      style={{
        background: '#d97706',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>Đang offline — dữ liệu có thể chưa cập nhật</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Đóng thông báo"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
