import React, { useState, useEffect, useCallback } from 'react'
import {
  collection,
  collectionGroup,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
  where,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { EmptyState, LoadingSpinner } from '@/components/ui/Table'
import RuleBuilderModal from './RuleBuilderModal'
import { createNotification, type NotifType, type NotifPriority } from '@/utils/createNotification'
import {
  BellRing, Plus, Trash2, Wrench, Package, Activity, FileText, Settings,
  AlertTriangle, Bell, Users, Search, X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertTrigger = 'inventory' | 'devices' | 'documents' | 'workOrders'

interface AlertRule {
  id: string
  name: string
  trigger: AlertTrigger
  threshold: number
  targetRoles: ('admin' | 'manager' | 'technician')[]
  isActive: boolean
}

interface NotificationItem {
  id: string
  title: string
  body: string
  type: NotifType
  link: string
  isRead: boolean
  createdAt?: Timestamp
  priority: NotifPriority
}

interface UserProfile {
  uid: string
  displayName: string
  email: string
  role: string
  status: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_META: Record<AlertTrigger, { color: string; bg: string; label: string }> = {
  inventory: { color: 'text-amber', bg: 'bg-amber/10', label: 'Vật tư' },
  devices: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Thiết bị' },
  documents: { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Chứng từ' },
  workOrders: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Work Order' },
}

const TYPE_META: Record<NotifType, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  workOrder: { color: 'text-amber', bg: 'bg-amber/10', icon: Wrench, label: 'Work Order' },
  inventory: { color: 'text-red-400', bg: 'bg-red-500/10', icon: Package, label: 'Vật tư' },
  device: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Activity, label: 'Thiết bị' },
  document: { color: 'text-purple-400', bg: 'bg-purple-500/10', icon: FileText, label: 'Chứng từ' },
  system: { color: 'text-gray-400', bg: 'bg-white/[0.06]', icon: Settings, label: 'Hệ thống' },
}

const SEED_RULES: Omit<AlertRule, 'id'>[] = [
  { name: 'Vật tư cần đặt', trigger: 'inventory', threshold: 50, targetRoles: ['manager', 'technician'], isActive: true },
  { name: 'Vật tư cận date', trigger: 'inventory', threshold: 90, targetRoles: ['manager'], isActive: true },
  { name: 'Thiết bị quá hạn BT', trigger: 'devices', threshold: 7, targetRoles: ['manager'], isActive: true },
  { name: 'Chứng từ sắp hết hạn', trigger: 'documents', threshold: 30, targetRoles: ['admin'], isActive: true },
  { name: 'Work order chưa xử lý', trigger: 'workOrders', threshold: 48, targetRoles: ['manager'], isActive: true },
]

// ─── Tab 1: Alert Rules ──────────────────────────────────────────────────────

function TabRules() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'alertRules'), orderBy('name'))
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        // Seed defaults
        await Promise.all(
          SEED_RULES.map((r) => addDoc(collection(db, 'alertRules'), { ...r }))
        )
        setLoading(false)
        return
      }
      setRules(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AlertRule)))
      setLoading(false)
    })
    return unsub
  }, [])

  const toggleRule = async (rule: AlertRule) => {
    const prev = rules
    setRules((r) => r.map((x) => (x.id === rule.id ? { ...x, isActive: !x.isActive } : x)))
    try {
      await updateDoc(doc(db, 'alertRules', rule.id), { isActive: !rule.isActive })
    } catch {
      setRules(prev)
      toast.error('Cập nhật thất bại')
    }
  }

  const deleteRule = async (rule: AlertRule) => {
    if (!confirm(`Xóa quy tắc '${rule.name}'?`)) return
    try {
      await deleteDoc(doc(db, 'alertRules', rule.id))
      toast.success(`Đã xóa quy tắc '${rule.name}'`)
    } catch {
      toast.error('Xóa thất bại')
    }
  }

  if (loading) return <LoadingSpinner />
  if (!loading && rules.length === 0) {
    return (
      <EmptyState
        icon={<BellRing className="w-8 h-8" />}
        title="Chưa có quy tắc"
        description="Thêm quy tắc đầu tiên để bắt đầu nhận cảnh báo"
        action={() => setShowModal(true)}
        actionLabel="Thêm quy tắc"
      />
    )
  }

  const active = rules.filter((r) => r.isActive).length
  const inactive = rules.filter((r) => !r.isActive).length

  return (
    <>
      {/* Summary */}
      <div className="flex gap-4 mb-5">
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Tổng quy tắc</p>
          <p className="text-xl font-bold text-gray-100 mt-0.5">{rules.length}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Đang bật</p>
          <p className="text-xl font-bold text-green-400 mt-0.5">{active}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Tắt</p>
          <p className="text-xl font-bold text-t2 mt-0.5">{inactive}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
          <h3 className="font-semibold text-gray-100 text-sm">Danh sách quy tắc</h3>
          <button className="btn-primary text-xs" onClick={() => setShowModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Thêm quy tắc
          </button>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Tên quy tắc</th>
              <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Trigger</th>
              <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Ngưỡng</th>
              <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Gửi cho</th>
              <th className="text-center px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Bật/Tắt</th>
              <th className="text-center px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Xóa</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const meta = TRIGGER_META[rule.trigger]
              return (
                <tr key={rule.id} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-sm text-gray-100 font-medium">{rule.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${meta.color} ${meta.bg}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-t2">{rule.threshold}</td>
                  <td className="px-4 py-3 text-sm text-t2">
                    {rule.targetRoles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleRule(rule)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        rule.isActive ? 'bg-green-500' : 'bg-white/[0.15]'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          rule.isActive ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => deleteRule(rule)}
                      className="p-1.5 text-t2 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <RuleBuilderModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => {}}
      />
    </>
  )
}

// ─── Tab 2: Send History ──────────────────────────────────────────────────────

function TabHistory() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<NotifType | 'all'>('all')
  const [filterDays, setFilterDays] = useState(30)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filterDays)
    const q = query(
      collectionGroup(db, 'items'),
      where('createdAt', '>=', Timestamp.fromDate(cutoff)),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationItem)))
      setLoading(false)
    })
    return unsub
  }, [filterDays])

  const filtered = filterType === 'all' ? items : items.filter((i) => i.type === filterType)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonth = items.filter((i) => {
    if (!i.createdAt) return false
    return i.createdAt.toDate() >= startOfMonth
  }).length
  const readPct = items.length > 0 ? Math.round((items.filter((i) => i.isRead).length / items.length) * 100) : 0
  const urgent = items.filter((i) => i.priority === 'urgent').length
  const typeCounts: Record<string, number> = {}
  items.forEach((i) => { typeCounts[i.type] = (typeCounts[i.type] || 0) + 1 })
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'system'

  if (loading) return <LoadingSpinner />

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Tổng tháng này</p>
          <p className="text-xl font-bold text-gray-100 mt-0.5">{thisMonth}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Đã đọc</p>
          <p className="text-xl font-bold text-green-400 mt-0.5">{readPct}%</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Khẩn cấp</p>
          <p className="text-xl font-bold text-red-400 mt-0.5">{urgent}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide">Loại hay gặp</p>
          <p className="text-xl font-bold text-amber mt-0.5 capitalize">{TYPE_META[topType as NotifType]?.label || topType}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="form-input w-auto text-xs"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as NotifType | 'all')}
        >
          <option value="all">Tất cả loại</option>
          <option value="workOrder">Work Order</option>
          <option value="inventory">Vật tư</option>
          <option value="device">Thiết bị</option>
          <option value="document">Chứng từ</option>
          <option value="system">Hệ thống</option>
        </select>
        <select
          className="form-input w-auto text-xs"
          value={filterDays}
          onChange={(e) => setFilterDays(Number(e.target.value))}
        >
          <option value={7}>7 ngày gần nhất</option>
          <option value={30}>30 ngày gần nhất</option>
          <option value={90}>90 ngày gần nhất</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-8 h-8" />}
          title="Không có thông báo"
          description="Chưa có thông báo nào được gửi trong khoảng thời gian này"
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Thời gian</th>
                <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Loại</th>
                <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Tiêu đề</th>
                <th className="text-left px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Nội dung</th>
                <th className="text-center px-4 py-3 text-[11px] text-t3 uppercase tracking-wide font-medium">Đã đọc</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const meta = TYPE_META[item.type] || TYPE_META.system
                const Icon = meta.icon
                const isExpanded = expandedId === item.id
                const time = item.createdAt?.toDate()
                return (
                  <React.Fragment key={item.id}>
                    <tr
                      className="border-b border-white/[0.05] hover:bg-white/[0.02] cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <td className="px-4 py-3 text-xs text-t2 whitespace-nowrap">
                        {time ? time.toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${meta.color} ${meta.bg}`}>
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-100 max-w-[180px] truncate">{item.title}</td>
                      <td className="px-4 py-3 text-sm text-t2 max-w-[200px] truncate">{item.body}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          item.isRead ? 'bg-green-500/15 text-green-400' : 'bg-amber/15 text-amber'
                        }`}>
                          {item.isRead ? 'Đã đọc' : 'Chưa đọc'}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-white/[0.05] bg-ink">
                        <td colSpan={5} className="px-6 py-4 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[11px] text-t3 uppercase tracking-wide mb-1">Nội dung đầy đủ</p>
                              <p className="text-gray-200">{item.body}</p>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-[11px] text-t3 uppercase tracking-wide mb-1">Link</p>
                                <p className="text-gray-200">{item.link || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-t3 uppercase tracking-wide mb-1">Độ ưu tiên</p>
                                <p className="text-gray-200 capitalize">{item.priority}</p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ─── Tab 3: Send Notification ───────────────────────────────────────────────

function TabSend() {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<NotifType>('system')
  const [link, setLink] = useState('')
  const [priority, setPriority] = useState<NotifPriority>('medium')
  const [targetMode, setTargetMode] = useState<'all' | 'role' | 'specific'>('all')
  const [selectedRoles, setSelectedRoles] = useState<('admin' | 'manager' | 'technician')[]>([])
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserProfile[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    const snap = await getDocs(
      query(collection(db, 'users'), where('displayName', '>=', q), where('displayName', '<=', q + ''), limit(10))
    )
    setSearchResults(snap.docs.map((d) => d.data() as UserProfile & { uid: string }))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchUsers(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery, searchUsers])

  const addUser = (u: UserProfile) => {
    if (!selectedUsers.find((s) => s.uid === u.uid)) {
      setSelectedUsers((prev) => [...prev, u])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  const removeUser = (uid: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.uid !== uid))
  }

  const handleSendTest = async () => {
    if (!user || !title.trim() || !body.trim()) return
    setSending(true)
    try {
      await createNotification(user.uid, {
        title: title.trim(),
        body: body.trim(),
        type,
        link,
        priority,
      })
      toast.success('Test gửi thành công — kiểm tra chuông')
    } catch {
      toast.error('Gửi test thất bại')
    } finally {
      setSending(false)
    }
  }

  const getTargetUsers = async (): Promise<UserProfile[]> => {
    if (targetMode === 'specific') return selectedUsers
    const snap = await getDocs(
      query(collection(db, 'users'), where('status', '==', 'active'))
    )
    const all = snap.docs.map((d) => d.data() as UserProfile & { uid: string })
    if (targetMode === 'all') return all
    return all.filter((u) => selectedRoles.includes(u.role as 'admin' | 'manager' | 'technician'))
  }

  const handleSendReal = async () => {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    setShowConfirm(false)
    try {
      const targets = await getTargetUsers()
      await Promise.all(
        targets.map((u) =>
          createNotification(u.uid, {
            title: title.trim(),
            body: body.trim(),
            type,
            link,
            priority,
          })
        )
      )
      toast.success(`Đã gửi cho ${targets.length} người dùng`)
      setTitle('')
      setBody('')
      setType('system')
      setLink('')
      setPriority('medium')
      setSelectedUsers([])
      setSelectedRoles([])
    } catch {
      toast.error('Gửi thông báo thất bại')
    } finally {
      setSending(false)
    }
  }

  const isValid = title.trim() && body.trim() && (targetMode === 'role' ? selectedRoles.length > 0 : targetMode === 'specific' ? selectedUsers.length > 0 : true)

  const previewItem = {
    id: 'preview',
    title: title || 'Tiêu đề thông báo',
    body: body || 'Nội dung thông báo sẽ hiển thị ở đây...',
    type,
    link,
    isRead: false,
    createdAt: Timestamp.now(),
    priority,
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* LEFT: Form */}
      <div className="lg:col-span-3 space-y-5">
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-100 text-sm">Soạn thông báo</h3>

          <div>
            <label className="form-label">Tiêu đề <span className="text-danger">*</span></label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Thiết bị cần bảo trì" />
          </div>

          <div>
            <label className="form-label">Nội dung <span className="text-danger">*</span></label>
            <textarea className="form-input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mô tả chi tiết..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Loại</label>
              <select className="form-input" value={type} onChange={(e) => setType(e.target.value as NotifType)}>
                <option value="workOrder">Work Order</option>
                <option value="inventory">Vật tư</option>
                <option value="device">Thiết bị</option>
                <option value="document">Chứng từ</option>
                <option value="system">Hệ thống</option>
              </select>
            </div>
            <div>
              <label className="form-label">Độ ưu tiên</label>
              <select className="form-input" value={priority} onChange={(e) => setPriority(e.target.value as NotifPriority)}>
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn cấp</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Link (tùy chọn)</label>
            <input className="form-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/maintenance" />
          </div>
        </div>

        {/* Target */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-100 text-sm">Gửi cho</h3>

          <div className="flex gap-3">
            {[
              { value: 'all', label: 'Tất cả' },
              { value: 'role', label: 'Theo vai trò' },
              { value: 'specific', label: 'Người cụ thể' },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="targetMode"
                  value={opt.value}
                  checked={targetMode === opt.value}
                  onChange={() => { setTargetMode(opt.value as typeof targetMode); setSelectedUsers([]); setSelectedRoles([]) }}
                  className="accent-amber"
                />
                <span className="text-sm text-t1">{opt.label}</span>
              </label>
            ))}
          </div>

          {targetMode === 'role' && (
            <div className="flex gap-3">
              {(['admin', 'manager', 'technician'] as const).map((r) => (
                <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r)}
                    onChange={() => setSelectedRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])}
                    className="accent-amber"
                  />
                  <span className="text-sm text-t1 capitalize">{r}</span>
                </label>
              ))}
            </div>
          )}

          {targetMode === 'specific' && (
            <div className="space-y-3">
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((u) => (
                    <span key={u.uid} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber/10 text-amber text-xs rounded-full">
                      {u.displayName}
                      <button onClick={() => removeUser(u.uid)} className="hover:text-amber/70">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t3" />
                <input
                  className="form-input pl-9"
                  placeholder="Tìm người dùng..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-ink-2 border border-white/[0.1] rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                    {searchResults.map((u) => (
                      <button
                        key={u.uid}
                        onClick={() => addUser(u)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-white/[0.05] text-left"
                      >
                        <Users className="w-4 h-4 text-t3 shrink-0" />
                        <span>{u.displayName}</span>
                        <span className="text-t3 text-xs ml-auto capitalize">{u.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="btn-outline flex-1" onClick={handleSendTest} disabled={!title.trim() || !body.trim() || sending}>
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Gửi test cho tôi
          </button>
          <button
            className="btn-primary flex-1"
            onClick={() => setShowConfirm(true)}
            disabled={!isValid || sending}
          >
            <BellRing className="w-4 h-4 mr-1.5" />
            Gửi thật sự
          </button>
        </div>
      </div>

      {/* RIGHT: Preview */}
      <div className="lg:col-span-2">
        <div className="card p-4">
          <p className="text-[11px] text-t3 uppercase tracking-wide mb-3">Xem trước</p>
          <PreviewCard item={previewItem} />
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-ink-2 rounded-2xl border border-white/[0.1] p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-semibold text-gray-100 mb-2">Xác nhận gửi</h3>
            <p className="text-sm text-t2 mb-5">
              Gửi thông báo cho <span className="font-medium text-gray-100">{targetMode === 'all' ? 'tất cả người dùng' : targetMode === 'role' ? `vai trò ${selectedRoles.join(', ')}` : `${selectedUsers.length} người`}</span>?
            </p>
            <div className="flex gap-3">
              <button className="btn-outline flex-1" onClick={() => setShowConfirm(false)}>Hủy</button>
              <button className="btn-primary flex-1" onClick={handleSendReal}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Preview Card ─────────────────────────────────────────────────────────────

function PreviewCard({ item }: { item: NotificationItem & { id: string } }) {
  const meta = TYPE_META[item.type] || TYPE_META.system
  const Icon = meta.icon
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border-l-[3px] ${item.priority === 'urgent' ? 'border-l-danger bg-red-500/5' : 'border-l-amber/50'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-100 truncate">{item.title}</p>
        <p className="text-[12px] text-t2 mt-0.5 line-clamp-2">{item.body}</p>
        <p className="text-[11px] text-t3 mt-1">Vừa xong</p>
      </div>
      <div className="w-1.5 h-1.5 rounded-full bg-amber shrink-0 mt-2" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'rules', label: 'Quy tắc cảnh báo' },
  { id: 'history', label: 'Lịch sử gửi' },
  { id: 'send', label: 'Gửi thông báo' },
]

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState('rules')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Cài đặt thông báo</h1>
          <p className="text-sm text-t2 mt-0.5">Quản lý quy tắc cảnh báo và lịch sử gửi</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.04] rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-amber text-ink'
                : 'text-t2 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rules' && <TabRules />}
      {tab === 'history' && <TabHistory />}
      {tab === 'send' && <TabSend />}
    </div>
  )
}
