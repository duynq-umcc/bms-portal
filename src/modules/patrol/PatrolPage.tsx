import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import { listenPatrolLogs, addPatrolLog, listenStaff } from '@/firebase/db'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import type { PatrolLog, PatrolFinding, PatrolFindingSeverity } from '@/types/firestore'
import type { StaffMember } from '@/firebase/types'
import {
  Search, Plus, AlertTriangle, AlertCircle, Info, ChevronRight,
  Calendar, ClipboardList,
} from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { PATROL_CATEGORIES } from '@/types/firestore'

const SEVERITY_CONFIG: Record<PatrolFindingSeverity, { label: string; color: string; badge: string; icon: React.ElementType }> = {
  info: { label: 'Thông tin', color: 'text-blue-400', badge: 'badge-info', icon: Info },
  warning: { label: 'Cảnh báo', color: 'text-amber', badge: 'badge-warning', icon: AlertCircle },
  critical: { label: 'Nghiêm trọng', color: 'text-red-400', badge: 'badge-danger', icon: AlertTriangle },
}

const PATROL_TYPE_LABELS: Record<string, string> = {
  routine: 'Tuần tra thường quy',
  incident_followup: 'Theo dõi sự cố',
  post_incident: 'Sau sự cố',
  special: 'Kiểm tra đặc biệt',
}

const CATEGORY_ICONS: Record<string, string> = {
  structural: '🏗️',
  safety: '🦺',
  electrical: '⚡',
  plumbing: '💧',
  fire: '🔥',
  other: '📋',
}

function FindingModal({
  finding,
  onClose,
}: {
  finding: PatrolFinding
  onClose: () => void
}) {
  const cfg = SEVERITY_CONFIG[finding.severity]
  const Icon = cfg.icon
  return (
    <Modal open onClose={onClose} title="Chi tiết phát hiện" size="md">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Icon className={`w-6 h-6 ${cfg.color}`} />
          <div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.badge}`}>
              {cfg.label}
            </span>
            <p className="text-xs text-t3 mt-1">{finding.location}</p>
          </div>
        </div>
        <div className="card p-3">
          <p className="text-xs text-t3 mb-1">Mô tả phát hiện</p>
          <p className="text-sm text-gray-200">{finding.description}</p>
        </div>
        {finding.actionRequired && (
          <div className="card p-3">
            <p className="text-xs text-t3 mb-1">Hành động yêu cầu</p>
            <p className="text-sm text-gray-200">{finding.actionRequired}</p>
          </div>
        )}
        <div className="flex gap-1 flex-wrap">
          <span className="badge-gray">{CATEGORY_ICONS[finding.category] ?? ''} {PATROL_CATEGORIES.find((c) => c.value === finding.category)?.label ?? finding.category}</span>
        </div>
      </div>
    </Modal>
  )
}

function AddPatrolModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [staff, setStaff] = useState<(StaffMember & { uid: string; id: string })[]>([])
  const [patrolArea, setPatrolArea] = useState('')
  const [patrolType, setPatrolType] = useState<'routine' | 'incident_followup' | 'post_incident' | 'special'>('routine')
  const [inspectorName, setInspectorName] = useState(user?.displayName ?? '')
  const [notes, setNotes] = useState('')
  const [findings, setFindings] = useState<PatrolFinding[]>([])
  const [showFindingForm, setShowFindingForm] = useState(false)
  const [newFinding, setNewFinding] = useState<Omit<PatrolFinding, 'id'>>({
    category: 'structural',
    location: '',
    description: '',
    severity: 'info',
    actionRequired: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsub = listenStaff(setStaff)
    return () => unsub()
  }, [])

  const addFinding = () => {
    if (!newFinding.description.trim()) { toast.error('Mô tả phát hiện là bắt buộc'); return }
    if (!newFinding.location.trim()) { toast.error('Vị trí là bắt buộc'); return }
    setFindings((prev) => [...prev, { ...newFinding, id: `f-${Date.now()}` }])
    setNewFinding({ category: 'structural', location: '', description: '', severity: 'info', actionRequired: '' })
    setShowFindingForm(false)
  }

  const removeFinding = (id: string) => setFindings((prev) => prev.filter((f) => f.id !== id))

  const criticalCount = findings.filter((f) => f.severity === 'critical').length

  const handleSubmit = async () => {
    if (!patrolArea.trim()) { toast.error('Khu vực tuần tra là bắt buộc'); return }
    setSaving(true)
    try {
      await addPatrolLog({
        patrolDate: Timestamp.now(),
        patrolArea: patrolArea.trim(),
        patrolType,
        inspectorId: user!.uid,
        inspectorName: inspectorName.trim(),
        findings,
        findingCount: findings.length,
        criticalFindings: criticalCount,
        resolvedFindings: 0,
        notes: notes.trim(),
      })
      toast.success('Đã lưu biên bản tuần tra')
      onSuccess()
      onClose()
      setPatrolArea('')
      setNotes('')
      setFindings([])
    } catch {
      toast.error('Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Biên bản tuần tra công trình" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Khu vực tuần tra *</label>
            <input
              value={patrolArea}
              onChange={(e) => setPatrolArea(e.target.value)}
              className="input-field"
              placeholder="VD: Tầng 1-5, Khu hành chính..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Người tuần tra *</label>
            <input
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="input-field"
              list="patrol-inspectors"
            />
            <datalist id="patrol-inspectors">
              {staff.map((s) => <option key={s.uid} value={s.displayName} />)}
            </datalist>
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Loại tuần tra</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(PATROL_TYPE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPatrolType(key as typeof patrolType)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    patrolType === key
                      ? 'bg-amber/15 text-amber border border-amber/30'
                      : 'bg-white/5 text-t3 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Findings */}
        <div className="card p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber" />
              Phát hiện ({findings.length})
              {criticalCount > 0 && (
                <span className="badge-danger flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />{criticalCount} nghiêm trọng
                </span>
              )}
            </h3>
            <button
              onClick={() => setShowFindingForm((v) => !v)}
              className="btn-secondary text-xs flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Thêm phát hiện
            </button>
          </div>

          {showFindingForm && (
            <div className="card p-3 mb-3 bg-white/[0.03]">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-t3 mb-1">Loại</label>
                    <select
                      value={newFinding.category}
                      onChange={(e) => setNewFinding((f) => ({ ...f, category: e.target.value }))}
                      className="input-field text-sm"
                    >
                      {PATROL_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-t3 mb-1">Mức độ</label>
                    <select
                      value={newFinding.severity}
                      onChange={(e) => setNewFinding((f) => ({ ...f, severity: e.target.value as PatrolFindingSeverity }))}
                      className="input-field text-sm"
                    >
                      <option value="info">Thông tin</option>
                      <option value="warning">Cảnh báo</option>
                      <option value="critical">Nghiêm trọng</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-t3 mb-1">Vị trí *</label>
                  <input
                    value={newFinding.location}
                    onChange={(e) => setNewFinding((f) => ({ ...f, location: e.target.value }))}
                    className="input-field text-sm"
                    placeholder="VD: Tầng 2, phòng 204..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-t3 mb-1">Mô tả phát hiện *</label>
                  <textarea
                    value={newFinding.description}
                    onChange={(e) => setNewFinding((f) => ({ ...f, description: e.target.value }))}
                    className="input-field text-sm"
                    rows={2}
                    placeholder="Mô tả chi tiết phát hiện..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-t3 mb-1">Hành động yêu cầu</label>
                  <input
                    value={newFinding.actionRequired}
                    onChange={(e) => setNewFinding((f) => ({ ...f, actionRequired: e.target.value }))}
                    className="input-field text-sm"
                    placeholder="VD: Cần sửa chữa trong 24h..."
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={addFinding} className="btn-primary text-xs">Thêm</button>
                  <button onClick={() => setShowFindingForm(false)} className="btn-secondary text-xs">Hủy</button>
                </div>
              </div>
            </div>
          )}

          {findings.length === 0 ? (
            <p className="text-xs text-t3 text-center py-3">Không có phát hiện nào</p>
          ) : (
            <div className="space-y-2">
              {findings.map((f) => {
                const cfg = SEVERITY_CONFIG[f.severity]
                const Icon = cfg.icon
                return (
                  <div key={f.id} className="flex items-start gap-2 p-2 bg-white/[0.03] rounded-lg">
                    <Icon className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-t3">{CATEGORY_ICONS[f.category] ?? ''} {f.location}</span>
                        <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-xs text-gray-300">{f.description}</p>
                    </div>
                    <button onClick={() => removeFinding(f.id)} className="text-t3 hover:text-red-400 shrink-0">
                      <span className="text-xs">×</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Ghi chú chung</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field w-full"
            rows={3}
            placeholder="Nhận xét tổng quan, điều kiện thời tiết, ..."
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4 pt-3 border-t border-white/[0.07]">
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
          {saving ? 'Đang lưu...' : 'Lưu biên bản tuần tra'}
        </button>
        <button onClick={onClose} className="btn-secondary">Đóng</button>
      </div>
    </Modal>
  )
}

export default function PatrolPage() {
  const [logs, setLogs] = useState<PatrolLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedFinding, setSelectedFinding] = useState<PatrolFinding | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    const unsub = listenPatrolLogs(setLogs as (docs: any[]) => void)
    setLoading(false)
    return () => unsub()
  }, [])

  const filtered = filterType === 'all' ? logs : logs.filter((l) => l.patrolType === filterType)

  if (loading) return <div className="p-4 text-t3">Đang tải...</div>

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Search className="w-6 h-6 text-amber" />
            Tuần tra công trình
          </h1>
          <p className="text-xs text-t3 mt-0.5">Biên bản tuần tra, kiểm tra công trình dân dụng</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Tuần tra mới
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xs text-t3">Tổng lần tuần tra</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{logs.length}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-t3">Phát hiện</p>
          <p className="text-2xl font-bold text-amber mt-1">
            {logs.reduce((s, l) => s + l.findingCount, 0)}
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-t3">Nghiêm trọng</p>
          <p className="text-2xl font-bold text-red-400 mt-1">
            {logs.reduce((s, l) => s + l.criticalFindings, 0)}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filterType === 'all' ? 'bg-amber/15 text-amber' : 'bg-white/5 text-t3'}`}
        >
          Tất cả
        </button>
        {Object.entries(PATROL_TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterType(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filterType === key ? 'bg-amber/15 text-amber' : 'bg-white/5 text-t3'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="Chưa có biên bản tuần tra"
          description="Bắt đầu ghi nhận bằng cách tạo biên bản tuần tra đầu tiên."
          action={() => setShowAdd(true)}
          actionLabel="Tạo biên bản tuần tra"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <div key={log.id} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.05]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-100">{log.patrolArea}</p>
                    <p className="text-xs text-t3 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(log.patrolDate.toDate(), "dd/MM/yyyy 'lúc' HH:mm", { locale: vi })}
                      <span className="mx-1">·</span>
                      {log.inspectorName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.findingCount > 0 && (
                      <span className={`badge-sm ${log.criticalFindings > 0 ? 'badge-danger' : 'badge-warning'}`}>
                        {log.criticalFindings > 0 && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                        {log.findingCount} phát hiện
                      </span>
                    )}
                    <span className="badge-gray">{PATROL_TYPE_LABELS[log.patrolType] ?? log.patrolType}</span>
                  </div>
                </div>
              </div>
              {log.findings.length > 0 && (
                <div className="divide-y divide-white/[0.04]">
                  {log.findings.map((f) => {
                    const cfg = SEVERITY_CONFIG[f.severity]
                    const Icon = cfg.icon
                    return (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFinding(f)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors text-left"
                      >
                        <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate">{f.description}</p>
                          <p className="text-xs text-t3">{f.location} · {cfg.label}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-t3 shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}
              {log.notes && (
                <div className="px-4 py-2 bg-white/[0.02]">
                  <p className="text-xs text-t3 italic">{log.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddPatrolModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => setLogs((prev) => prev)}
      />
      {selectedFinding && (
        <FindingModal finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
      )}
    </div>
  )
}
