import { useState } from 'react'
import { doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { toast } from '@/components/ui/Toast'
import type { UserRole } from '@/types/firestore'

interface RoleChangeModalProps {
  open: boolean
  onClose: () => void
  user: {
    uid: string
    displayName: string
    email: string
    role: string
  }
  currentUser?: { uid?: string; displayName?: string | null } | null
  onRoleChanged?: () => void
}

export default function RoleChangeModal({ open, onClose, user, currentUser, onRoleChanged }: RoleChangeModalProps) {
  const [newRole, setNewRole] = useState<UserRole>(user.role as UserRole)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newRole === user.role) { onClose(); return }
    setSubmitting(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole })

      // Audit log
      await import('firebase/firestore').then(({ addDoc, collection }) =>
        addDoc(collection(db, 'auditLog'), {
          action: 'update_role',
          targetUserId: user.uid,
          targetUserName: user.displayName,
          performedBy: currentUser?.uid || '',
          performedByName: currentUser?.displayName || '',
          before: { role: user.role },
          after: { role: newRole },
          reason: reason.trim() || null,
          timestamp: Timestamp.now(),
        })
      )

      const roleLabels: Record<string, string> = { admin: 'Quản trị', manager: 'Quản lý', technician: 'Kỹ thuật' }
      toast.success(`Đã cập nhật vai trò thành ${roleLabels[newRole] || newRole}`)
      onRoleChanged?.()
      onClose()
    } catch {
      toast.error('Cập nhật vai trò thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const roleColor: Record<string, string> = {
    admin: 'bg-amber/15 text-amber',
    manager: 'bg-teal-500/15 text-teal-400',
    technician: 'bg-blue-500/15 text-blue-400',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-ink-2 rounded-2xl shadow-2xl border border-white/[0.1] w-full max-w-md mx-4 max-h-[90vh] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.1]">
          <h3 className="font-semibold text-gray-100 text-base">Đổi vai trò người dùng</h3>
          <button onClick={onClose} className="p-1.5 text-t3 hover:text-gray-200 hover:bg-white/[0.08] rounded-lg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-sm text-t2">
            Thay đổi vai trò của <span className="font-medium text-gray-100">{user.displayName}</span>
          </p>

          {/* Current role */}
          <div>
            <label className="block text-xs text-t3 mb-1.5">Vai trò hiện tại</label>
            <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${roleColor[user.role] || 'bg-white/[0.1] text-t2'}`}>
              {user.role === 'admin' ? 'Quản trị' : user.role === 'manager' ? 'Quản lý' : 'Kỹ thuật'}
            </span>
          </div>

          {/* New role */}
          <div>
            <label className="block text-xs text-t2 mb-2">Vai trò mới</label>
            <div className="space-y-2">
              {[
                { value: 'admin', label: 'Quản trị', desc: 'Toàn quyền — phù hợp Trưởng/Phó phòng', color: 'bg-amber/10 text-amber' },
                { value: 'manager', label: 'Quản lý', desc: 'Đọc tất cả, tạo/sửa phiếu — phù hợp Tổ trưởng', color: 'bg-teal-500/10 text-teal-400' },
                { value: 'technician', label: 'Kỹ thuật', desc: 'Xem và cập nhật công việc — phù hợp NV kỹ thuật', color: 'bg-blue-500/10 text-blue-400' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    newRole === opt.value ? 'border-amber/50 bg-amber/5' : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.03]'
                  }`}
                >
                  <input
                    type="radio"
                    name="newRole"
                    value={opt.value}
                    checked={newRole === opt.value}
                    onChange={() => setNewRole(opt.value as UserRole)}
                    className="mt-0.5 accent-amber"
                  />
                  <div>
                    <span className={`inline-block text-xs font-semibold mb-0.5 ${newRole === opt.value ? opt.color : 'text-t2'}`}>{opt.label}</span>
                    <p className="text-[11px] text-t3 leading-relaxed">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs text-t2 mb-1.5">Lý do thay đổi (tùy chọn)</label>
            <textarea
              className="form-input resize-none"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Thay đổi vị trí công tác..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.1] flex justify-end gap-3">
          <button className="btn-outline text-sm" onClick={onClose} type="button">Hủy</button>
          <button
            className="btn-primary text-sm"
            onClick={handleSubmit}
            disabled={submitting || newRole === user.role}
          >
            {submitting ? 'Đang cập nhật...' : 'Xác nhận đổi vai trò'}
          </button>
        </div>
      </div>
    </div>
  )
}
