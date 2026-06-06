import { useState } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { DEPARTMENTS } from '@/config/rolePermissions'
import type { DeptValue } from '@/config/rolePermissions'
import type { UserRole } from '@/types/firestore'

interface AddUserModalProps {
  open: boolean
  onClose: () => void
  onAdded?: () => void
}

export default function AddUserModal({ open, onClose, onAdded }: AddUserModalProps) {
  const { user: currentUser } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState<DeptValue>('maintenance')
  const [role, setRole] = useState<UserRole>('technician')
  const [passwordMethod, setPasswordMethod] = useState<'email' | 'temp'>('email')
  const [tempPassword, setTempPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Vui lòng nhập họ tên'
    if (!email.trim()) e.email = 'Vui lòng nhập email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email không hợp lệ'
    if (passwordMethod === 'temp' && tempPassword.length < 8) e.tempPassword = 'Mật khẩu phải có ít nhất 8 ký tự'
    return e
  }

  const reset = () => {
    setName(''); setEmail(''); setPhone(''); setDepartment('maintenance')
    setRole('technician'); setPasswordMethod('email'); setTempPassword('')
    setErrors({})
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmitting(true)
    try {
      const pwd = passwordMethod === 'temp' && tempPassword ? tempPassword : Math.random().toString(36).slice(-8) + 'A1!'

      // 1. Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pwd)

      // 2. Create user profile in Firestore
      await setDoc(doc(db, 'users', cred.user.uid), {
        displayName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        dept: department,
        role,
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid,
      })

      // 3. Send password reset email (invite link)
      await sendPasswordResetEmail(auth, email.trim())

      // 4. Audit log
      await setDoc(doc(db, 'auditLog', cred.user.uid + '_' + Date.now()), {
        action: 'create',
        targetUserId: cred.user.uid,
        targetUserName: name.trim(),
        performedBy: currentUser?.uid,
        performedByName: currentUser?.displayName || '',
        before: {},
        after: { displayName: name.trim(), email: email.trim(), role, dept: department },
        timestamp: Timestamp.now(),
      })

      toast.success('Đã tạo tài khoản — email kích hoạt đã gửi')
      handleClose()
      onAdded?.()
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/email-already-in-use') toast.error('Email này đã được sử dụng')
      else if (code === 'auth/weak-password') toast.error('Mật khẩu phải có ít nhất 8 ký tự')
      else toast.error('Tạo tài khoản thất bại: ' + (err instanceof Error ? err.message : 'Lỗi không xác định'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-ink-2 rounded-2xl shadow-2xl border border-white/[0.1] w-full max-w-lg mx-4 max-h-[90vh] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.1] shrink-0">
          <h3 className="font-semibold text-gray-100 text-base">Thêm người dùng mới</h3>
          <button onClick={handleClose} className="p-1.5 text-t3 hover:text-gray-200 hover:bg-white/[0.08] rounded-lg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs text-t2 mb-1.5">Họ và tên <span className="text-danger">*</span></label>
            <input
              className={`form-input ${errors.name ? 'border-danger' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs text-t2 mb-1.5">Email <span className="text-danger">*</span></label>
            <input
              type="email"
              className={`form-input ${errors.email ? 'border-danger' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nvana@bms.vn"
            />
            {errors.email && <p className="text-xs text-danger mt-1">{errors.email}</p>}
          </div>

          {/* Phone + Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-t2 mb-1.5">Số điện thoại</label>
              <input
                type="tel"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912 345 678"
              />
            </div>
            <div>
              <label className="block text-xs text-t2 mb-1.5">Phòng ban <span className="text-danger">*</span></label>
              <select className="form-input" value={department} onChange={(e) => setDepartment(e.target.value as DeptValue)}>
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs text-t2 mb-2">Vai trò <span className="text-danger">*</span></label>
            <div className="space-y-2">
              {[
                { value: 'admin', label: 'Quản trị', desc: 'Toàn quyền — phù hợp Trưởng/Phó phòng', color: 'bg-amber/10 text-amber' },
                { value: 'manager', label: 'Quản lý', desc: 'Đọc tất cả, tạo/sửa phiếu — phù hợp Tổ trưởng', color: 'bg-teal-500/10 text-teal-400' },
                { value: 'technician', label: 'Kỹ thuật', desc: 'Xem và cập nhật công việc — phù hợp NV kỹ thuật', color: 'bg-blue-500/10 text-blue-400' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    role === opt.value
                      ? 'border-amber/50 bg-amber/5'
                      : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.03]'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={role === opt.value}
                    onChange={() => setRole(opt.value as UserRole)}
                    className="mt-0.5 accent-amber"
                  />
                  <div>
                    <span className={`inline-block text-xs font-semibold mb-0.5 ${role === opt.value ? opt.color : 'text-t2'}`}>
                      {opt.label}
                    </span>
                    <p className="text-[11px] text-t3 leading-relaxed">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Password method */}
          <div>
            <label className="block text-xs text-t2 mb-2">Mật khẩu</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pwdMethod" value="email" checked={passwordMethod === 'email'} onChange={() => setPasswordMethod('email')} className="accent-amber" />
                <span className="text-sm text-t1">Gửi email đặt mật khẩu</span>
                <span className="text-[10px] text-amber/70">(Khuyến nghị)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pwdMethod" value="temp" checked={passwordMethod === 'temp'} onChange={() => setPasswordMethod('temp')} className="accent-amber" />
                <span className="text-sm text-t1">Đặt mật khẩu tạm thời</span>
              </label>
            </div>
            {passwordMethod === 'temp' && (
              <div>
                <input
                  type="password"
                  className={`form-input ${errors.tempPassword ? 'border-danger' : ''}`}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Nhập mật khẩu (tối thiểu 8 ký tự)"
                />
                {errors.tempPassword && <p className="text-xs text-danger mt-1">{errors.tempPassword}</p>}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.1] flex justify-end gap-3 shrink-0">
          <button className="btn-outline text-sm" onClick={handleClose} type="button">Hủy</button>
          <button className="btn-primary text-sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
          </button>
        </div>
      </div>
    </div>
  )
}
