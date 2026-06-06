import { useState, useEffect, useMemo, useCallback } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, addDoc, limit } from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth, db } from '@/firebase/config'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { rolePermissions, MODULES, PERMISSION_LABELS, ROLE_META, AUDIT_ACTION_LABELS, AUDIT_ACTION_DOTS } from '@/config/rolePermissions'
import type { FirestoreUser } from '@/types/firestore'
import AddUserModal from './AddUserModal'
import UserDetailPanel from './UserDetailPanel'

type UserDoc = FirestoreUser & { uid: string }

interface AuditLogEntry {
  id: string
  action: string
  targetUserId: string
  targetUserName: string
  performedBy: string
  performedByName: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  reason?: string | null
  timestamp?: Timestamp
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
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

function formatDateTime(ts?: Timestamp): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const ROLE_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  admin: { ring: 'ring-amber/20', text: 'text-amber', bg: 'bg-amber/15' },
  manager: { ring: 'ring-teal-500/20', text: 'text-teal-400', bg: 'bg-teal-500/15' },
  technician: { ring: 'ring-blue-500/20', text: 'text-blue-400', bg: 'bg-blue-500/15' },
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

// ─── Tab 1: User List ───────────────────────────────────────────────────────

function TabUsers({ onRefresh }: { onRefresh: () => void }) {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [detailUser, setDetailUser] = useState<UserDoc | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserDoc)))
        setLoading(false)
      },
      (error) => {
        console.error('[AdminUsers] users onSnapshot error:', error.code, error.message)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter((u) => {
      if (filterRole !== 'all' && u.role !== filterRole) return false
      if (filterStatus === 'active' && u.status === 'inactive') return false
      if (filterStatus === 'inactive' && u.status !== 'inactive') return false
      if (q && !u.displayName?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, search, filterRole, filterStatus])

  const total = users.length
  const activeCount = users.filter((u) => u.status !== 'inactive').length
  const inactiveCount = users.filter((u) => u.status === 'inactive').length
  const todayLoginCount = users.filter((u) => {
    if (!u.updatedAt) return false
    const diff = Date.now() - u.updatedAt.toMillis()
    return diff < 86_400_000
  }).length

  const handleDeactivate = async (u: UserDoc) => {
    setOpenActionId(null)
    if (u.uid === currentUser?.uid) { toast.error('Không thể tự vô hiệu hóa'); return }
    if (!confirm(`Vô hiệu hóa "${u.displayName}"?`)) return
    try {
      await updateDoc(doc(db, 'users', u.uid), { status: 'inactive' })
      await addDoc(collection(db, 'auditLog'), {
        action: 'deactivate',
        targetUserId: u.uid, targetUserName: u.displayName,
        performedBy: currentUser?.uid || '', performedByName: currentUser?.displayName || '',
        timestamp: Timestamp.now(),
      })
      toast.success('Đã vô hiệu hóa')
    } catch { toast.error('Thao tác thất bại') }
  }

  const handleReactivate = async (u: UserDoc) => {
    setOpenActionId(null)
    try {
      await updateDoc(doc(db, 'users', u.uid), { status: 'active' })
      await addDoc(collection(db, 'auditLog'), {
        action: 'reactivate',
        targetUserId: u.uid, targetUserName: u.displayName,
        performedBy: currentUser?.uid || '', performedByName: currentUser?.displayName || '',
        timestamp: Timestamp.now(),
      })
      toast.success('Đã kích hoạt lại')
    } catch { toast.error('Thao tác thất bại') }
  }

  const handleResetPassword = async (u: UserDoc) => {
    setOpenActionId(null)
    if (!confirm(`Gửi email đặt lại mật khẩu cho "${u.email}"?`)) return
    try {
      await sendPasswordResetEmail(auth, u.email)
      await addDoc(collection(db, 'auditLog'), {
        action: 'reset_password',
        targetUserId: u.uid, targetUserName: u.displayName,
        performedBy: currentUser?.uid || '', performedByName: currentUser?.displayName || '',
        timestamp: Timestamp.now(),
      })
      toast.success('Đã gửi email đặt lại mật khẩu')
    } catch { toast.error('Gửi email thất bại') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Tổng người dùng</p>
          <p className="text-xl font-bold text-gray-100 mt-0.5">{total}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Đang hoạt động</p>
          <p className="text-xl font-bold text-green-400 mt-0.5">{activeCount}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Vô hiệu hóa</p>
          <p className="text-xl font-bold text-red-400 mt-0.5">{inactiveCount}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Đăng nhập hôm nay</p>
          <p className="text-xl font-bold text-blue-400 mt-0.5">{todayLoginCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            className="form-input pl-9"
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="form-input w-auto text-xs" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="all">Tất cả vai trò</option>
          <option value="admin">Quản trị</option>
          <option value="manager">Quản lý</option>
          <option value="technician">Kỹ thuật</option>
        </select>
        <select className="form-input w-auto text-xs" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Vô hiệu hóa</option>
        </select>
        <button className="btn-primary text-xs ml-auto" onClick={() => setShowAddModal(true)}>
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          Thêm người dùng
        </button>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Người dùng</th>
              <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Phòng ban</th>
              <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Vai trò</th>
              <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Trạng thái</th>
              <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Lần login</th>
              <th className="text-right px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const colors = ROLE_COLORS[u.role] || ROLE_COLORS.technician
              const isOwn = u.uid === currentUser?.uid
              const roleLabel = u.role === 'admin' ? 'Quản trị' : u.role === 'manager' ? 'Quản lý' : 'Kỹ thuật'
              const isInactive = u.status === 'inactive'
              return (
                <tr key={u.uid} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colors.bg} ${colors.text}`}>
                        {getInitials(u.displayName || '?')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-100">{u.displayName || '—'}</p>
                        <p className="text-[11px] text-t3">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-t2">{DEPT_LABELS[u.dept] || u.dept || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${colors.bg} ${colors.text}`}>{roleLabel}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${isInactive ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                      {isInactive ? 'Vô hiệu hóa' : 'Hoạt động'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-t2 whitespace-nowrap">{timeAgo(u.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        className="p-1.5 text-t2 hover:text-gray-200 hover:bg-white/[0.05] rounded-lg transition-colors"
                        onClick={() => setOpenActionId(openActionId === u.uid ? null : u.uid)}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                      </button>
                      {openActionId === u.uid && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenActionId(null)} />
                          <div className="absolute right-0 top-full mt-1 w-44 bg-ink-2 border border-white/[0.1] rounded-xl shadow-xl z-20 overflow-hidden py-1">
                            <button className="w-full text-left px-3 py-2 text-sm text-t2 hover:bg-white/[0.05] hover:text-gray-200" onClick={() => { setDetailUser(u); setOpenActionId(null) }}>Xem chi tiết</button>
                            <button className="w-full text-left px-3 py-2 text-sm text-t2 hover:bg-white/[0.05] hover:text-gray-200" onClick={() => { setDetailUser(u); setOpenActionId(null) }}>Đổi vai trò</button>
                            <button className="w-full text-left px-3 py-2 text-sm text-t2 hover:bg-white/[0.05] hover:text-gray-200" onClick={() => handleResetPassword(u)}>Reset mật khẩu</button>
                            {!isOwn && (
                              isInactive
                                ? <button className="w-full text-left px-3 py-2 text-sm text-green-400 hover:bg-green-500/10" onClick={() => handleReactivate(u)}>Kích hoạt lại</button>
                                : <button className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10" onClick={() => handleDeactivate(u)}>Vô hiệu hóa</button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg className="w-12 h-12 text-t3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            <p className="text-sm text-t2">Không tìm thấy người dùng</p>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((u) => {
          const colors = ROLE_COLORS[u.role] || ROLE_COLORS.technician
          const roleLabel = u.role === 'admin' ? 'Quản trị' : u.role === 'manager' ? 'Quản lý' : 'Kỹ thuật'
          return (
            <div key={u.uid} className="card p-4" onClick={() => setDetailUser(u)}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${colors.bg} ${colors.text}`}>{getInitials(u.displayName || '?')}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">{u.displayName || '—'}</p>
                  <p className="text-[11px] text-t3 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${colors.bg} ${colors.text}`}>{roleLabel}</span>
                  <span className={`w-2 h-2 rounded-full ${u.status === 'inactive' ? 'bg-red-400' : 'bg-green-400'}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <AddUserModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdded={onRefresh} />
      <UserDetailPanel
        open={!!detailUser}
        onClose={() => setDetailUser(null)}
        user={detailUser!}
        currentUserUid={currentUser?.uid}
        onUserUpdated={onRefresh}
      />
    </>
  )
}

// ─── Tab 2: Permission Matrix ────────────────────────────────────────────────

function TabPermissions() {
  const roles = ['admin', 'manager', 'technician']

  const cellMeta = (level: string) => {
    const m = PERMISSION_LABELS[level as keyof typeof PERMISSION_LABELS]
    return m || { label: '—', color: 'text-t3', bg: 'bg-white/[0.06]' }
  }

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.07]">
          <h3 className="font-semibold text-gray-100 text-sm">Ma trận quyền truy cập</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium w-48">Module</th>
                {roles.map((r) => (
                  <th key={r} className="text-center px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium min-w-[120px]">
                    {r === 'admin' ? 'Quản trị' : r === 'manager' ? 'Quản lý' : 'Kỹ thuật'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod) => (
                <tr key={mod.key} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-sm text-t2">{mod.label}</td>
                  {roles.map((r) => {
                    const level = rolePermissions[r]?.[mod.key] || 'none'
                    const meta = cellMeta(level)
                    return (
                      <td key={r} className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${meta.bg}`}>{meta.label}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role description cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map((r) => {
          const meta = ROLE_META[r]
          const colors = ROLE_COLORS[r]
          return (
            <div key={r} className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${colors.bg} ${colors.text}`}>
                  {meta.label}
                </span>
              </div>
              <p className="text-sm text-t2 leading-relaxed">{meta.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab 3: Audit Log ───────────────────────────────────────────────────────

function TabAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('all')
  const [filterDays, setFilterDays] = useState(30)

  useEffect(() => {
    const q = query(collection(db, 'auditLog'), orderBy('timestamp', 'desc'), limit(100))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogEntry)))
        setLoading(false)
      },
      (error) => {
        console.error('[AdminUsers] auditLog onSnapshot error:', error.code, error.message)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  const filtered = useMemo(() => {
    const cutoff = Date.now() - filterDays * 86_400_000
    return entries.filter((e) => {
      if (filterAction !== 'all' && e.action !== filterAction) return false
      if (e.timestamp && e.timestamp.toMillis() < cutoff) return false
      return true
    })
  }, [entries, filterAction, filterDays])

  const handleExportExcel = () => {
    // Minimal CSV export (SheetJS would need to be installed as dep)
    const headers = ['Thời gian', 'Hành động', 'Đối tượng', 'Thực hiện bởi', 'Chi tiết']
    const rows = filtered.map((e) => [
      formatDateTime(e.timestamp),
      AUDIT_ACTION_LABELS[e.action] || e.action,
      e.targetUserName || '',
      e.performedByName || '',
      e.action === 'update_role' && e.before && e.after
        ? `${(e.before.role as string)} → ${(e.after.role as string)}${e.reason ? ` | ${e.reason}` : ''}`
        : (e.reason || ''),
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="form-input w-auto text-xs" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="all">Tất cả hành động</option>
          <option value="create">Tạo TK</option>
          <option value="update_role">Đổi vai trò</option>
          <option value="deactivate">Vô hiệu hóa</option>
          <option value="reactivate">Kích hoạt</option>
          <option value="reset_password">Reset MK</option>
        </select>
        <select className="form-input w-auto text-xs" value={filterDays} onChange={(e) => setFilterDays(Number(e.target.value))}>
          <option value={7}>7 ngày gần nhất</option>
          <option value={30}>30 ngày gần nhất</option>
          <option value={90}>90 ngày gần nhất</option>
        </select>
        <button className="btn-outline text-xs ml-auto" onClick={handleExportExcel}>
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Xuất Excel
        </button>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-3">
          <svg className="w-12 h-12 text-t3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <p className="text-sm text-t2">Không có nhật ký hoạt động</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((entry) => {
            const dotColor = AUDIT_ACTION_DOTS[entry.action] || 'bg-t3'
            const actionLabel = AUDIT_ACTION_LABELS[entry.action] || entry.action
            return (
              <div key={entry.id} className="flex gap-4 py-3 px-4 hover:bg-white/[0.02] rounded-lg">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                  <div className="flex-1 w-px bg-white/[0.07] my-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-t2">
                    <span className="text-gray-200">{entry.performedByName || 'Hệ thống'}</span>
                    {' đã '}
                    <span className="font-medium text-gray-100">{actionLabel}</span>
                    {' tài khoản '}
                    <span className="text-gray-200">{entry.targetUserName}</span>
                    {entry.action === 'update_role' && entry.before && entry.after && (
                      <span className="text-xs ml-1">
                        <span className="text-t3">({(entry.before.role as string) === 'admin' ? 'Quản trị' : (entry.before.role as string) === 'manager' ? 'Quản lý' : 'Kỹ thuật'}</span>
                        <span className="text-t3"> → </span>
                        <span className="text-gray-300">{(entry.after.role as string) === 'admin' ? 'Quản trị' : (entry.after.role as string) === 'manager' ? 'Quản lý' : 'Kỹ thuật'}</span>)
                      </span>
                    )}
                  </p>
                  {entry.reason && <p className="text-[11px] text-t3 italic mt-0.5">{entry.reason}</p>}
                  <p className="text-[11px] text-t3 mt-0.5">{formatDateTime(entry.timestamp)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'users', label: 'Danh sách' },
  { id: 'permissions', label: 'Phân quyền' },
  { id: 'audit', label: 'Nhật ký' },
]

export default function AdminUsersPage() {
  const [tab, setTab] = useState('users')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Quản trị người dùng</h1>
          <p className="text-sm text-t2 mt-0.5">Quản lý tài khoản, phân quyền và nhật ký hoạt động</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.04] rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-amber text-ink' : 'text-t2 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <TabUsers key={refreshKey} onRefresh={handleRefresh} />}
      {tab === 'permissions' && <TabPermissions />}
      {tab === 'audit' && <TabAuditLog />}
    </div>
  )
}
