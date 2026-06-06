import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, getDocs, Timestamp, addDoc } from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth, db } from '@/firebase/config'
import { updateDoc, doc } from 'firebase/firestore'
import { rolePermissions, MODULES } from '@/config/rolePermissions'
import { AUDIT_ACTION_LABELS } from '@/config/rolePermissions'
import { toast } from '@/components/ui/Toast'
import { ShieldCheck, Activity } from 'lucide-react'
import RoleChangeModal from './RoleChangeModal'

interface AuditEntry {
  id: string
  action: string
  targetUserId: string
  targetUserName: string
  performedByName: string
  before?: { role?: string }
  after?: { role?: string }
  reason?: string | null
  timestamp?: Timestamp
}

interface UserDetailPanelProps {
  open: boolean
  onClose: () => void
  user: {
    uid: string
    displayName: string
    email: string
    phone?: string
    dept?: string
    role: string
    status?: string
    createdAt?: Timestamp
    lastLogin?: Timestamp
  }
  currentUserUid?: string
  onUserUpdated?: () => void
}

const DEPT_LABELS: Record<string, string> = {
  maintenance: 'Bảo trì – Kỹ thuật',
  warehouse: 'Kho VT-TTB',
  admin: 'Ban Giám đốc',
  it: 'Hành chính',
  viewer: 'Khác',
  electrical: 'Điện – Máy',
  medical: 'Thiết bị Y tế',
  civil: 'Xây dựng',
  compliance: 'Kiểm định',
}

function timeAgo(ts?: Timestamp): string {
  if (!ts) return 'Chưa đăng nhập'
  const diff = Date.now() - ts.toMillis()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'Vừa xong'
  if (min < 60) return `${min} phút trước`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} giờ trước`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'Hôm qua'
  return `${day} ngày trước`
}

function formatDate(ts?: Timestamp): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function UserDetailPanel({ open, onClose, user, currentUserUid, onUserUpdated }: UserDetailPanelProps) {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [showRoleModal, setShowRoleModal] = useState(false)

  if (!open || !user) return null

  useEffect(() => {
    if (!open || !user?.uid) return
    const uid = user.uid
    const q = query(
      collection(db, 'auditLog'),
      where('targetUserId', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(5)
    )
    getDocs(q).then((snap) => {
      setAuditLog(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditEntry)))
    }).catch(() => setAuditLog([]))
  }, [open, user?.uid])

  const handleDeactivate = async () => {
    if (!confirm(`Vô hiệu hóa tài khoản "${user.displayName}"?`)) return
    try {
      await updateDoc(doc(db, 'users', user.uid), { status: 'inactive' })
      await addDoc(collection(db, 'auditLog'), {
        action: 'deactivate',
        targetUserId: user.uid,
        targetUserName: user.displayName,
        performedBy: currentUserUid || '',
        performedByName: '',
        timestamp: Timestamp.now(),
      })
      toast.success('Đã vô hiệu hóa tài khoản')
      onUserUpdated?.()
      onClose()
    } catch {
      toast.error('Thao tác thất bại')
    }
  }

  const handleReactivate = async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { status: 'active' })
      await addDoc(collection(db, 'auditLog'), {
        action: 'reactivate',
        targetUserId: user.uid,
        targetUserName: user.displayName,
        performedBy: currentUserUid || '',
        performedByName: '',
        timestamp: Timestamp.now(),
      })
      toast.success('Đã kích hoạt lại tài khoản')
      onUserUpdated?.()
      onClose()
    } catch {
      toast.error('Thao tác thất bại')
    }
  }

  const handleResetPassword = async () => {
    if (!confirm(`Gửi email đặt lại mật khẩu cho "${user.email}"?`)) return
    try {
      await sendPasswordResetEmail(auth, user.email)
      await addDoc(collection(db, 'auditLog'), {
        action: 'reset_password',
        targetUserId: user.uid,
        targetUserName: user.displayName,
        performedBy: currentUserUid || '',
        performedByName: '',
        timestamp: Timestamp.now(),
      })
      toast.success('Đã gửi email đặt lại mật khẩu')
    } catch {
      toast.error('Gửi email thất bại')
    }
  }

  if (!open) return null

  const roleColor: Record<string, string> = {
    admin: 'bg-amber/15 text-amber',
    manager: 'bg-teal-500/15 text-teal-400',
    technician: 'bg-blue-500/15 text-blue-400',
  }

  const perm = rolePermissions[user.role] || {}
  const roleLabel = user.role === 'admin' ? 'Quản trị' : user.role === 'manager' ? 'Quản lý' : 'Kỹ thuật'
  const isActive = user.status !== 'inactive'
  const isOwnAccount = user.uid === currentUserUid

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] max-w-full bg-ink-2 border-l border-white/[0.07] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
          <h3 className="font-semibold text-gray-100 text-base">Chi tiết người dùng</h3>
          <button onClick={onClose} className="p-1.5 text-t3 hover:text-gray-200 hover:bg-white/[0.08] rounded-lg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile header */}
          <div className="px-5 py-5 border-b border-white/[0.07]">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${roleColor[user.role] || 'bg-white/[0.1] text-t2'}`}>
                {getInitials(user.displayName)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-100">{user.displayName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${roleColor[user.role] || 'bg-white/[0.1] text-t2'}`}>{roleLabel}</span>
                  <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${isActive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    {isActive ? 'Hoạt động' : 'Vô hiệu hóa'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm text-t2">
              <div className="flex items-center gap-2">
                <span className="text-t3 w-6">@</span>
                <span>{user.email}</span>
              </div>
              {user.phone && (
                <div className="flex items-center gap-2">
                  <span className="text-t3 w-6">#</span>
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-t3 w-6">#</span>
                <span>{DEPT_LABELS[user.dept || ''] || user.dept || '—'}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/[0.07] flex gap-6 text-xs text-t3">
              <div>
                <p className="text-t3 uppercase tracking-wide mb-0.5">Thành viên từ</p>
                <p className="text-gray-300">{formatDate(user.createdAt)}</p>
              </div>
              <div>
                <p className="text-t3 uppercase tracking-wide mb-0.5">Đăng nhập cuối</p>
                <p className={user.lastLogin ? 'text-gray-300' : 'text-t3 italic'}>{timeAgo(user.lastLogin)}</p>
              </div>
            </div>
          </div>

          {/* Permission matrix */}
          <div className="px-5 py-5 border-b border-white/[0.07]">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-amber" />
              <h4 className="text-sm font-semibold text-gray-100">Quyền truy cập</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-t3 uppercase tracking-wide">
                    <th className="text-left pb-2 pr-3 font-medium">Module</th>
                    <th className="text-center pb-2 px-2 font-medium">Xem</th>
                    <th className="text-center pb-2 px-2 font-medium">Tạo</th>
                    <th className="text-center pb-2 px-2 font-medium">Sửa</th>
                    <th className="text-center pb-2 pl-2 font-medium">Xóa</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((mod) => {
                    const level = perm[mod.key] || 'none'
                    const perms = {
                      full: { view: '✓', create: '✓', edit: '✓', delete: '✓' },
                      readWrite: { view: '✓', create: '✓', edit: '✓', delete: '—' },
                      readOnly: { view: '✓', create: '—', edit: '—', delete: '—' },
                      none: { view: '—', create: '—', edit: '—', delete: '—' },
                    }[level]
                    return (
                      <tr key={mod.key} className="border-t border-white/[0.05]">
                        <td className="py-2 pr-3 text-t2">{mod.label}</td>
                        {Object.values(perms).map((v, i) => (
                          <td key={i} className={`py-2 px-2 text-center ${v === '✓' ? 'text-green-400' : 'text-t3'}`}>{v}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent activity */}
          <div className="px-5 py-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-amber" />
              <h4 className="text-sm font-semibold text-gray-100">Hoạt động gần đây</h4>
            </div>
            {auditLog.length === 0 ? (
              <p className="text-xs text-t3 italic">Chưa có hoạt động nào</p>
            ) : (
              <div className="space-y-3">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber/60 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs text-t2">
                        <span className="text-gray-200">{AUDIT_ACTION_LABELS[entry.action] || entry.action}</span>
                        {entry.action === 'update_role' && entry.before && entry.after && (
                          <span className="ml-1">
                            <span className="text-t3">{entry.before.role === 'admin' ? 'Quản trị' : entry.before.role === 'manager' ? 'Quản lý' : 'Kỹ thuật'}</span>
                            <span className="text-t3 mx-1">→</span>
                            <span className="text-gray-200">{entry.after.role === 'admin' ? 'Quản trị' : entry.after.role === 'manager' ? 'Quản lý' : 'Kỹ thuật'}</span>
                          </span>
                        )}
                      </p>
                      {entry.reason && <p className="text-[11px] text-t3 italic mt-0.5">{entry.reason}</p>}
                      <p className="text-[11px] text-t3 mt-0.5">
                        {entry.performedByName ? `${entry.performedByName} · ` : ''}
                        {formatDate(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-white/[0.07] shrink-0 flex gap-2">
          <button className="btn-outline text-xs flex-1" onClick={() => setShowRoleModal(true)}>
            Đổi vai trò
          </button>
          <button className="btn-outline text-xs flex-1" onClick={handleResetPassword}>
            Reset MK
          </button>
          {!isOwnAccount && (
            isActive
              ? <button className="btn-outline text-xs flex-1 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={handleDeactivate}>Vô hiệu hóa</button>
              : <button className="btn-outline text-xs flex-1 text-green-400 border-green-500/30 hover:bg-green-500/10" onClick={handleReactivate}>Kích hoạt</button>
          )}
        </div>
      </div>

      <RoleChangeModal
        open={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        user={user}
        currentUser={currentUserUid ? { uid: currentUserUid } : null}
        onRoleChanged={() => { onUserUpdated?.(); onClose() }}
      />
    </>
  )
}
