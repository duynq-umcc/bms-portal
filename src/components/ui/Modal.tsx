import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
}

const sizeClasses = {
  sm: 'max-w-[500px]',
  md: 'max-w-[680px]',
  lg: 'max-w-[800px]',
  xl: 'max-w-[900px]',
}

export default function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-ink-2 rounded-2xl shadow-2xl border border-white/[0.1] w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col animate-slide-in`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.1]">
          <h3 className="font-semibold text-gray-100 text-base">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-t3 hover:text-gray-200 hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-white/[0.1] flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
