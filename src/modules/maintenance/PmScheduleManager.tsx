import { useState, useEffect } from 'react'
import { listenPmSchedules, updatePmSchedule, addPmWorkOrder, listenPmWorkOrdersBySchedule, listenPmExecutions } from '@/firebase/db'
import { checkAndCreatePmWorkOrders } from '@/utils/pmEngine'
import { toast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import PmScheduleFormModal from './PmScheduleFormModal'
import { format, differenceInDays } from 'date-fns'
import { Timestamp } from 'firebase/firestore'
import {
  Calendar, Plus, Play, CheckCircle2,
  MoreVertical, History, Edit3, Zap, ToggleLeft, ToggleRight, X, CheckCircle,
} from 'lucide-react'
import type { PMSchedule, PMFrequencyType, PMWorkOrder, PMWorkOrderTask, PMExecutionLog } from '@/types/firestore'

// ─── Helpers ──────────────────────────────────────────────────────────────

const FREQ_LABELS: Record<PMFrequencyType, string> = {
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  biannual: 'Nửa năm',
  annual: 'Hàng năm',
}

function getDueDateInfo(nextDueDate: Date) {
  const now = new Date()
  const days = differenceInDays(nextDueDate, now)
  const isOverdue = days < 0
  const absDays = Math.abs(days)
  return { days, absDays, isOverdue }
}

function DueDateBadge({ ts }: { ts: { toDate: () => Date } | undefined }) {
  if (!ts) return <span className="text-gray-500 text-xs">—</span>
  const date = ts.toDate()
  const { days, absDays, isOverdue } = getDueDateInfo(date)

  if (isOverdue) {
    return (
      <div className="flex items-center gap-1">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-red-400 font-semibold text-xs">
          Quá hạn {absDays} ngày
        </span>
      </div>
    )
  }
  if (days < 7) {
    return (
      <div className="flex items-center gap-1">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber" />
        </span>
        <span className="text-amber font-medium text-xs">
          {format(date, 'dd/MM')} — {absDays} ngày nữa
        </span>
      </div>
    )
  }
  if (days <= 14) {
    return (
      <span className="text-yellow-400 text-xs">
        {format(date, 'dd/MM')} — {absDays} ngày nữa
      </span>
    )
  }
  return (
    <span className="text-gray-500 text-xs">{format(date, 'dd/MM/yyyy')}</span>
  )
}

// ─── Stats bar ─────────────────────────────────────────────────────────

function StatsBar({ schedules }: { schedules: (PMSchedule & { id: string })[] }) {
  const now = new Date()
  const active = schedules.filter((s) => s.isActive).length
  const due7 = schedules.filter((s) => {
    if (!s.isActive || !s.nextDueDate) return false
    const days = differenceInDays(s.nextDueDate.toDate(), now)
    return days >= 0 && days <= 7
  }).length
  const overdue = schedules.filter((s) => {
    if (!s.isActive || !s.nextDueDate) return false
    return s.nextDueDate.toDate() < now
  }).length

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: 'Lịch đang hoạt động', value: active, color: 'text-blue-400' },
        { label: 'Sắp đến hạn (7 ngày)', value: due7, color: due7 > 0 ? 'text-amber' : 'text-gray-400' },
        { label: 'Quá hạn', value: overdue, color: overdue > 0 ? 'text-red-400' : 'text-gray-400' },
        { label: 'Tổng lịch BT', value: schedules.length, color: 'text-gray-400' },
      ].map((stat) => (
        <div key={stat.label} className="card p-3">
          <p className="text-xs text-gray-500">{stat.label}</p>
          <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Schedule table row ─────────────────────────────────────────────────

function ScheduleRow({
  sched,
  onEdit,
  onViewHistory,
  onCreateWO,
  onToggle,
  onToggleAuto,
}: {
  sched: PMSchedule & { id: string }
  onEdit: () => void
  onViewHistory: () => void
  onCreateWO: () => void
  onToggle: () => void
  onToggleAuto: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const now = new Date()
  const isOverdue = sched.nextDueDate ? sched.nextDueDate.toDate() < now : false

  return (
    <tr className={`hover:bg-white/[0.03] transition-colors ${isOverdue ? 'bg-red-500/5' : ''}`}>
      <td className="px-3 py-3 min-w-0">
        <p className="text-sm font-medium text-gray-200 line-clamp-1">{sched.name}</p>
        <p className="text-xs text-gray-600 mt-0.5">{sched.assetName}</p>
      </td>
      <td className="px-3 py-3 text-sm text-gray-400 hidden md:table-cell">{sched.assetCode || '—'}</td>
      <td className="px-3 py-3 text-sm text-gray-400 hidden lg:table-cell">{sched.location}</td>
      <td className="px-3 py-3">
        <span className="badge badge-gray text-xs">{FREQ_LABELS[sched.frequency.type]}</span>
      </td>
      <td className="px-3 py-3">
        <DueDateBadge ts={sched.nextDueDate} />
      </td>
      <td className="px-3 py-3 text-sm text-gray-400 hidden md:table-cell">
        {sched.assignedToName || <span className="text-gray-600">—</span>}
      </td>
      <td className="px-3 py-3">
        <button
          onClick={onToggle}
          className={`flex items-center gap-1 text-xs font-medium transition-opacity ${
            sched.autoCreateWO ? 'text-green-400' : 'text-gray-600'
          }`}
        >
          {sched.autoCreateWO
            ? <ToggleRight className="w-5 h-5" />
            : <ToggleLeft className="w-5 h-5" />}
          <span>{sched.autoCreateWO ? `Tự động (${sched.autoCreateDaysBefore}d)` : 'Tắt'}</span>
        </button>
      </td>
      <td className="px-3 py-3">
        <span className={`badge ${sched.isActive ? 'badge-success' : 'badge-gray'}`}>
          {sched.isActive ? 'Đang BT' : 'Tạm dừng'}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 bg-ink-2 border border-white/[0.12] rounded-xl shadow-xl py-1 min-w-[160px]">
                <button
                  onClick={() => { onViewHistory(); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06] transition-colors"
                >
                  <History className="w-3.5 h-3.5" /> Xem lịch sử BT
                </button>
                <button
                  onClick={() => { onEdit(); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06] transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Sửa lịch
                </button>
                <button
                  onClick={() => { onCreateWO(); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06] transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" /> Tạo WO ngay
                </button>
                <button
                  onClick={() => { onToggle(); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06] transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {sched.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                </button>
                <button
                  onClick={() => { onToggleAuto(); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06] transition-colors"
                >
                  <ToggleLeft className="w-3.5 h-3.5" />
                  {sched.autoCreateWO ? 'Tắt Auto WO' : 'Bật Auto WO'}
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Main component ────────────────────────────────────────────────────

// ─── Schedule history modal (P1.2) ────────────────────────────────────────────

function PmHistoryModal({
  sched,
  workOrders,
  executions,
  onClose,
}: {
  sched: (PMSchedule & { id: string }) | null
  workOrders: (PMWorkOrder & { id: string })[]
  executions: (PMExecutionLog & { id: string })[]
  onClose: () => void
}) {
  if (!sched) return null

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      scheduled: 'badge-blue',
      inProgress: 'badge-warning',
      completed: 'badge-success',
      overdue: 'badge-danger',
      cancelled: 'badge-gray',
    }
    return <span className={`badge ${map[status] ?? 'badge-gray'} text-xs`}>{status}</span>
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-ink-2 border-l border-white/[0.08] flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div>
            <h2 className="font-semibold text-gray-200 text-sm">Lịch sử bảo trì</h2>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{sched.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/[0.08] rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Work Orders */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Work Orders ({workOrders.length})
            </h3>
            {workOrders.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">Chưa có Work Order nào</p>
            ) : (
              <div className="space-y-2">
                {workOrders.map((wo) => (
                  <div key={wo.id} className="bg-white/[0.04] rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-medium text-gray-300 truncate">
                        {wo.scheduleName}
                      </span>
                      {statusBadge(wo.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Hạn: {wo.dueDate ? format(wo.dueDate.toDate(), 'dd/MM/yyyy') : '—'}</span>
                      <span>Người: {wo.assignedToName || '—'}</span>
                    </div>
                    {wo.completedAt && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        Hoàn thành {format(wo.completedAt.toDate(), 'dd/MM/yyyy')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Execution log */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Nhật ký engine ({executions.length})
            </h3>
            {executions.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">Chưa có nhật ký</p>
            ) : (
              <div className="space-y-2">
                {executions.map((exec) => (
                  <div key={exec.id} className="bg-white/[0.04] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-400">
                        {exec.runAt ? format(exec.runAt.toDate(), 'dd/MM/yyyy HH:mm') : '—'}
                      </span>
                      <span className="text-xs text-amber">
                        {exec.woCreated} WO tạo · {exec.schedulesChecked} lịch checked
                      </span>
                    </div>
                    {exec.details && exec.details.length > 0 && (
                      <ul className="text-xs text-gray-500 space-y-0.5 mt-1">
                        {exec.details.slice(0, 3).map((d, i) => (
                          <li key={i} className="truncate">{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

export default function PmScheduleManager() {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState<(PMSchedule & { id: string })[]>([])
  const loading = schedules.length === 0
  const [freqFilter, setFreqFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [deptFilter, setDeptFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PMSchedule & { id: string } | undefined>()
  const [running, setRunning] = useState(false)
  const [historySched, setHistorySched] = useState<PMSchedule & { id: string } | null>(null)
  const [historyWos, setHistoryWos] = useState<(PMWorkOrder & { id: string })[]>([])
  const [historyExecs, setHistoryExecs] = useState<(PMExecutionLog & { id: string })[]>([])

  const isManager = user?.role === 'admin' || user?.role === 'manager'

  useEffect(() => {
    const unsub = listenPmSchedules(setSchedules as (docs: (PMSchedule & { id: string })[]) => void)
    return () => { unsub() }
  }, [])

  // P1.2: Load PM work orders and execution logs when a schedule is selected
  useEffect(() => {
    if (!historySched) return
    const unsubWos = listenPmWorkOrdersBySchedule(historySched.id, setHistoryWos)
    const unsubExecs = listenPmExecutions(setHistoryExecs)
    return () => { unsubWos(); unsubExecs() }
  }, [historySched])

  const filtered = schedules.filter((s) => {
    if (freqFilter !== 'all' && s.frequency.type !== freqFilter) return false
    if (statusFilter === 'active' && !s.isActive) return false
    if (statusFilter === 'paused' && s.isActive) return false
    if (deptFilter !== 'all' && s.department !== deptFilter) return false
    return true
  })

  const handleToggleActive = async (sched: PMSchedule & { id: string }) => {
    try {
      await updatePmSchedule(sched.id, { isActive: !sched.isActive })
      toast.success(sched.isActive ? 'Đã tạm dừng lịch' : 'Đã kích hoạt lịch')
    } catch {
      toast.error('Cập nhật thất bại')
    }
  }

  const handleToggleAuto = async (sched: PMSchedule & { id: string }) => {
    try {
      await updatePmSchedule(sched.id, { autoCreateWO: !sched.autoCreateWO })
    } catch {
      toast.error('Cập nhật thất bại')
    }
  }

  // P1.2: Opens history sidebar for a specific schedule
  const handleViewHistory = (sched: PMSchedule & { id: string }) => {
    setHistorySched(sched)
  }

  // P1.2: Creates a PM work order directly for this schedule
  const handleCreateWO = async (sched: PMSchedule & { id: string }) => {
    const tasks: PMWorkOrderTask[] = sched.tasks.map((t) => ({
      ...t,
      completed: false,
      completedAt: null,
      completedBy: null,
      note: '',
    }))
    try {
      await addPmWorkOrder({
        pmScheduleId: sched.id,
        scheduleName: sched.name,
        assetId: sched.assetId ?? '',
        assetName: sched.assetName,
        assetCode: sched.assetCode ?? '',
        location: sched.location,
        department: sched.department ?? '',
        dueDate: sched.nextDueDate ?? Timestamp.now(),
        scheduledDate: sched.nextDueDate ?? Timestamp.now(),
        startedAt: null,
        completedAt: null,
        status: 'scheduled',
        assignedTo: sched.assignedTo ?? '',
        assignedToName: sched.assignedToName ?? 'Chưa phân công',
        requiresContractor: sched.requiresContractor ?? false,
        contractorId: sched.contractorId ?? null,
        tasks,
        completionPhotos: [],
        technicianNotes: '',
        actualDuration: null,
        partsUsed: [],
        signedOffBy: null,
        signedOffAt: null,
        signedOffNote: null,
        generatedAt: Timestamp.now(),
        generatedBy: 'manual',
      })
      toast.success(`Đã tạo Work Order cho "${sched.name}"`)
    } catch {
      toast.error('Tạo Work Order thất bại')
    }
  }

  const handleRunEngine = async () => {
    setRunning(true)
    try {
      const result = await checkAndCreatePmWorkOrders()
      toast.success(`Đã tạo ${result.created} Work Order, ${result.overdue} quá hạn${result.skipped > 0 ? ` (${result.skipped} đã bỏ qua — chạy gần đây)` : ''}`)
    } catch {
      toast.error('Chạy engine thất bại')
    } finally {
      setRunning(false)
    }
  }

  const departments = [...new Set(schedules.map((s) => s.department))].filter(Boolean)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-3 animate-pulse">
              <div className="skeleton-line h-3 w-28 mb-2" />
              <div className="skeleton-line h-8 w-10" />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-line h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <StatsBar schedules={schedules} />

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select
            value={freqFilter}
            onChange={(e) => setFreqFilter(e.target.value)}
            className="input-field text-xs w-auto"
          >
            <option value="all">Tất cả chu kỳ</option>
            <option value="monthly">Hàng tháng</option>
            <option value="quarterly">Hàng quý</option>
            <option value="biannual">Nửa năm</option>
            <option value="annual">Hàng năm</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field text-xs w-auto"
          >
            <option value="active">Đang hoạt động</option>
            <option value="paused">Tạm dừng</option>
            <option value="all">Tất cả</option>
          </select>
          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="input-field text-xs w-auto"
            >
              <option value="all">Tất cả phòng ban</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        <div className="flex gap-2">
          {isManager && (
            <button
              onClick={handleRunEngine}
              disabled={running}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <Play className="w-3.5 h-3.5" />
              {running ? 'Đang chạy...' : 'Chạy engine ngay'}
            </button>
          )}
          <button
            onClick={() => { setEditing(undefined); setShowForm(true) }}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm lịch BT
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-10 h-10 mx-auto text-gray-600 mb-3" />
            <p className="text-gray-500 text-sm">Chưa có lịch bảo trì phòng ngừa</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm mt-3">
              Thêm lịch BT đầu tiên
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-desktop">
              <thead>
                <tr>
                  <th className="text-left">Tên lịch BT</th>
                  <th className="text-left hidden md:table-cell">Mã TS</th>
                  <th className="text-left hidden lg:table-cell">Vị trí</th>
                  <th className="text-left">Chu kỳ</th>
                  <th className="text-left">Hạn tiếp theo</th>
                  <th className="text-left hidden md:table-cell">Nhân viên</th>
                  <th className="text-left">Auto WO</th>
                  <th className="text-left">Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((sched) => (
                  <ScheduleRow
                    key={sched.id}
                    sched={sched}
                    onEdit={() => { setEditing(sched); setShowForm(true) }}
                    onViewHistory={() => handleViewHistory(sched)}
                    onCreateWO={() => handleCreateWO(sched)}
                    onToggle={() => handleToggleActive(sched)}
                    onToggleAuto={() => handleToggleAuto(sched)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* P1.2: Schedule history sidebar */}
      <PmHistoryModal
        sched={historySched}
        workOrders={historyWos}
        executions={historyExecs}
        onClose={() => setHistorySched(null)}
      />

      <PmScheduleFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(undefined) }}
        existingSchedule={editing}
      />
    </div>
  )
}
