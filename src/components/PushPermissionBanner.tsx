import { useState, useEffect } from 'react'
import { BellRing, X } from 'lucide-react'

export function PushPermissionBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      localStorage.setItem('push-permission', 'granted')
      return
    }
    if (Notification.permission === 'denied') {
      localStorage.setItem('push-permission', 'denied')
      return
    }
    if (sessionStorage.getItem('push-banner-dismissed')) return
    if (localStorage.getItem('push-permission') === 'granted') return
    if (localStorage.getItem('push-permission') === 'denied') return

    const timer = setTimeout(() => {
      setShowBanner(true)
    }, 30_000)

    return () => clearTimeout(timer)
  }, [])

  const handleEnable = async () => {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      localStorage.setItem('push-permission', 'granted')
    } else {
      localStorage.setItem('push-permission', 'denied')
    }
    setShowBanner(false)
  }

  const handleDismiss = () => {
    sessionStorage.setItem('push-banner-dismissed', '1')
    setShowBanner(false)
  }

  if (!mounted || !showBanner) return null

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:block fixed bottom-20 right-6 z-50 max-w-[360px] w-full animate-slide-up">
        <div className="bg-ink-2 border border-white/[0.1] rounded-xl shadow-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-amber" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-100 leading-tight">
              Bật thông báo đẩy
            </p>
            <p className="text-[12px] text-t2 mt-0.5 leading-snug">
              Nhận cảnh báo kịp thời khi có sự cố
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-1">
            <button
              onClick={handleEnable}
              className="px-3 py-1.5 bg-amber text-ink text-[12px] font-semibold rounded-lg hover:bg-amber/90 transition-colors"
            >
              Bật
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-t2 hover:text-t1 hover:bg-white/[0.05] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="sm:hidden fixed bottom-[72px] left-3 right-3 z-50">
        <div className="bg-ink-2 border border-white/[0.1] rounded-xl shadow-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-amber" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-100 leading-tight">
              Bật thông báo đẩy
            </p>
            <p className="text-[12px] text-t2 mt-0.5 leading-snug">
              Nhận cảnh báo kịp thời khi có sự cố
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-1">
            <button
              onClick={handleEnable}
              className="px-3 py-1.5 bg-amber text-ink text-[12px] font-semibold rounded-lg hover:bg-amber/90 transition-colors"
            >
              Bật
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-t2 hover:text-t1 hover:bg-white/[0.05] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
