import { create } from 'zustand'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface ToastStore {
  toasts: Toast[]
  add: (type: Toast['type'], message: string) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = Date.now().toString()
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

const icons = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  info: <AlertTriangle className="w-5 h-5 text-blue-500" />,
}

const bgColors = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
}

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${bgColors[toast.type]}`}
        >
          {icons[toast.type]}
          <p className="text-sm text-gray-800 flex-1">{toast.message}</p>
          <button onClick={() => remove(toast.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export const toast = {
  success: (msg: string) => useToastStore.getState().add('success', msg),
  error: (msg: string) => useToastStore.getState().add('error', msg),
  warning: (msg: string) => useToastStore.getState().add('warning', msg),
  info: (msg: string) => useToastStore.getState().add('info', msg),
}
