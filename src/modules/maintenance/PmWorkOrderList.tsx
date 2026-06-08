import { useState, useEffect } from 'react'
import { listenPmWorkOrders } from '@/firebase/db'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, addMonths, subMonths } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Calendar, List, CheckCircle2, Clock, AlertTriangle,
  ChevronLeft, ChevronRight, Play, Eye, MapPin,
} from 'lucide-react'
import type { PMWorkOrder, PMWorkOrderStatus } from '@/types/firestore'
import PmExecutionModal from './PmExecutionModal'

// ─── Status config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PMWorkOrderStatus, { label: string; badge: string; icon: React.ElementType }> = {
  scheduled: { label: 'Đã lên lịch', badge: 'badge-info', icon: Clock },
  inProgress: { label: 'Đang thực hiện', badge: 'badge-warning', icon: Play },
  completed: { label: 'Hoàn thành', badge: 'badge-success', icon: CheckCircle2 },
  overdue: { label: 'Quá hạn', badge: 'badge-danger', icon: AlertTriangle },
  cancelled: { label: 'Đã hủy', badge: 'badge-gray', icon: Clock },
}

type StatusFilter = 'all' | PMWorkOrderStatus

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'scheduled', label: 'Đã lên lịch' },
  { value: 'inProgress', label: 'Đang thực hiện' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'completed', label: 'Hoàn thành' },
]

// ─── Progress bar ───────────────────────────────────────────────────────

function TaskProgress({ tasks }: { tasks: PMWorkOrder['tasks'] }) {
  const done = tasks.filter((t) => t.completed).length
  const total = tasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-amber'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 shrink-0">{done}/{total}</span>
    </div>
  )
}

// ─── WO Card (mobile) ──────────────────────────────────────────────────

function WoCard({
  wo,
  onStart,
  onView,
}: {
  wo: PMWorkOrder & { id: string }
  onStart: () => void
  onView: () => void
}) {
  const cfg = STATUS_CONFIG[wo.status]

  return (
    <div className="card p-3 mb-2">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          <span className={`badge ${cfg.badge} ${wo.status === 'overdue' ? 'animate-pulse' : ''}`}>
            {cfg.label}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 line-clamp-1">{wo.scheduleName}</p>
          <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" />{wo.assetName}
          </p>
          {wo.dueDate && (
            <p className="text-xs text-gray-600 mt-0.5">
              Hạn: {format(wo.dueDate.toDate(), 'dd/MM/yyyy')}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2">
        <TaskProgress tasks={wo.tasks} />
      </div>

      <div className="mt-2 flex gap-2">
        {(wo.status === 'scheduled' || wo.status === 'overdue') && (
          <button onClick={onStart} className="btn-primary text-xs flex-1">
            <Play className="w-3.5 h-3.5 mr-1" /> Bắt đầu BT
          </button>
        )}
        {wo.status === 'inProgress' && (
          <button onClick={onStart} className="btn-primary text-xs flex-1">
            Tiếp tục
          </button>
        )}
        {(wo.status === 'completed') && (
          <button onClick={onView} className="btn-secondary text-xs flex-1">
            <Eye className="w-3.5 h-3.5 mr-1" /> Xem
          </button>
        )}
      </div>
    </div>
  )
}

// ─── WO Table Row (desktop) ─────────────────────────────────────────────

function WoRow({
  wo,
  onStart,
  onView,
}: {
  wo: PMWorkOrder & { id: string }
  onStart: () => void
  onView: () => void
}) {
  const cfg = STATUS_CONFIG[wo.status]

  return (
    <tr className={`hover:bg-white/[0.03] transition-colors ${wo.status === 'overdue' ? 'bg-red-500/5' : ''}`}>
      <td className="px-3 py-3 min-w-0">
        <p className="text-sm font-medium text-gray-200 line-clamp-1">{wo.scheduleName}</p>
        <p className="text-xs text-gray-600 mt-0.5">{wo.assetName}</p>
      </td>
      <td className="px-3 py-3 text-sm text-gray-400 hidden md:table-cell">{wo.assetCode || '—'}</td>
      <td className="px-3 py-3 text-sm text-gray-400 hidden lg:table-cell">{wo.location}</td>
      <td className="px-3 py-3">
        {wo.dueDate ? (
          <span className={`text-xs ${wo.status === 'overdue' ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
            {format(wo.dueDate.toDate(), 'dd/MM/yyyy')}
          </span>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-gray-400 hidden lg:table-cell">
        {wo.assignedToName || '—'}
      </td>
      <td className="px-3 py-3 text-sm text-gray-400 hidden lg:table-cell">
        {wo.requiresContractor ? (
          <span className="badge badge-gray text-xs">Có nhà thầu</span>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
      <td className="px-3 py-3 min-w-[100px]">
        <TaskProgress tasks={wo.tasks} />
      </td>
      <td className="px-3 py-3">
        <span className={`badge ${cfg.badge} ${wo.status === 'overdue' ? 'animate-pulse' : ''}`}>
          {cfg.label}
        </span>
      </td>
      <td className="px-3 py-3">
        {(wo.status === 'scheduled' || wo.status === 'overdue') && (
          <button onClick={onStart} className="btn-primary text-xs py-1.5">
            Bắt đầu BT
          </button>
        )}
        {wo.status === 'inProgress' && (
          <button onClick={onStart} className="btn-secondary text-xs py-1.5">
            Tiếp tục
          </button>
        )}
        {wo.status === 'completed' && (
          <button onClick={onView} className="btn-secondary text-xs py-1.5">
            Xem
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Calendar View ─────────────────────────────────────────────────────

function CalendarView({
  workOrders,
  onSelectDate,
  selectedDate,
  onStartWO,
}: {
  workOrders: (PMWorkOrder & { id: string })[]
  onSelectDate: (d: Date | null) => void
  selectedDate: Date | null
  onStartWO: (wo: PMWorkOrder & { id: string }) => void
}) {
  const [month, setMonth] = useState(new Date())
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const startDow = startOfWeek(start, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: startDow, end })
  const dowLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

  const getWosForDay = (d: Date) =>
    workOrders.filter((wo) => wo.dueDate && isSameDay(wo.dueDate.toDate(), d))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
          <button onClick={() => setMonth(subMonths(month, 1))} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </button>
          <h3 className="text-sm font-semibold text-gray-200">
            {format(month, 'MMMM yyyy', { locale: vi })}
          </h3>
          <button onClick={() => setMonth(addMonths(month, 1))} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dowLabels.map((d) => (
              <div key={d} className="text-center text-xs text-gray-600 font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const inMonth = day.getMonth() === month.getMonth()
              const todayFlag = isToday(day)
              const selectedFlag = selectedDate ? isSameDay(day, selectedDate) : false
              const wos = getWosForDay(day)
              const hasOverdue = wos.some((wo) => wo.status === 'overdue')
              const hasScheduled = wos.some((wo) => wo.status === 'scheduled' || wo.status === 'inProgress')
              const hasDone = wos.some((wo) => wo.status === 'completed')

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onSelectDate(isSameDay(day, selectedDate || new Date(0)) ? null : day)}
                  className={`
                    relative aspect-square rounded-lg flex flex-col items-center justify-center
                    transition-all text-xs
                    ${!inMonth ? 'text-gray-700' : 'text-gray-300 hover:bg-white/[0.06]'}
                    ${todayFlag && !selectedFlag ? 'border border-amber/40' : ''}
                    ${selectedFlag ? 'bg-amber/20 border border-amber/50' : ''}
                  `}
                >
                  <span className={`font-medium ${todayFlag && !selectedFlag ? 'text-amber' : ''} ${selectedFlag ? 'text-amber font-bold' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  {wos.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {hasOverdue && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      {hasScheduled && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                      {hasDone && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-3 justify-center">
            {[
              { color: 'bg-blue-500', label: 'Lên lịch' },
              { color: 'bg-red-500', label: 'Quá hạn' },
              { color: 'bg-green-500', label: 'Hoàn thành' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${l.color}`} />
                <span className="text-xs text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day detail */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-200">
            {selectedDate
              ? format(selectedDate, 'dd MMMM yyyy', { locale: vi })
              : 'Chọn ngày để xem'}
          </h3>
        </div>
        <div className="p-4 space-y-2">
          {!selectedDate ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Nhấn vào một ngày để xem Work Order
            </p>
          ) : (
            getWosForDay(selectedDate).map((wo) => {
              const cfg = STATUS_CONFIG[wo.status]
              return (
                <div key={wo.id} className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.07]">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-200">{wo.scheduleName}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{wo.assetName} · {wo.location}</p>
                    </div>
                    <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                  </div>
                  {(wo.status === 'scheduled' || wo.status === 'overdue' || wo.status === 'inProgress') && (
                    <button
                      onClick={() => onStartWO(wo)}
                      className="btn-primary text-xs w-full mt-2"
                    >
                      {wo.status === 'inProgress' ? 'Tiếp tục' : 'Bắt đầu BT'}
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────

export default function PmWorkOrderList() {
  const [workOrders, setWorkOrders] = useState<(PMWorkOrder & { id: string })[]>([])
  const loading = workOrders.length === 0
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [activeWO, setActiveWO] = useState<(PMWorkOrder & { id: string }) | null>(null)

  useEffect(() => {
    const unsub = listenPmWorkOrders(setWorkOrders as (docs: (PMWorkOrder & { id: string })[]) => void)
    return () => { unsub() }
  }, [])

  // Count badges for tabs
  const counts: Record<StatusFilter, number> = { all: workOrders.length, scheduled: 0, inProgress: 0, overdue: 0, completed: 0, cancelled: 0 }
  for (const wo of workOrders) {
    if (wo.status in counts) counts[wo.status as PMWorkOrderStatus]++
  }

  const filtered = workOrders.filter((wo) => {
    if (statusFilter !== 'all' && wo.status !== statusFilter) return false
    return true
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card p-4 animate-pulse"><div className="skeleton-line h-8 w-48" /></div>
        <div className="card p-4 animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton-line h-12 w-full rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] p-1 rounded-xl w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === tab.value
                ? 'bg-amber text-ink font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              statusFilter === tab.value ? 'bg-ink/30' : 'bg-white/[0.08]'
            }`}>
              {counts[tab.value]}
            </span>
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-white/[0.04] p-1 rounded-lg">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === 'list' ? 'bg-amber text-ink' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <List className="w-3.5 h-3.5" /> Danh sách
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === 'calendar' ? 'bg-amber text-ink' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Lịch tháng
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'calendar' ? (
        <CalendarView
          workOrders={filtered}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onStartWO={setActiveWO}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="block md:hidden space-y-0">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-10 h-10 mx-auto text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">Không có Work Order nào</p>
              </div>
            ) : (
              filtered.map((wo) => (
                <WoCard
                  key={wo.id}
                  wo={wo}
                  onStart={() => setActiveWO(wo)}
                  onView={() => setActiveWO(wo)}
                />
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-10 h-10 mx-auto text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">Không có Work Order nào</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-desktop">
                  <thead>
                    <tr>
                      <th className="text-left">Lịch BT</th>
                      <th className="text-left hidden md:table-cell">Mã TS</th>
                      <th className="text-left hidden lg:table-cell">Vị trí</th>
                      <th className="text-left">Hạn</th>
                      <th className="text-left hidden lg:table-cell">Phụ trách</th>
                      <th className="text-left hidden lg:table-cell">Nhà thầu</th>
                      <th className="text-left">Tiến độ</th>
                      <th className="text-left">Trạng thái</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.map((wo) => (
                      <WoRow
                        key={wo.id}
                        wo={wo}
                        onStart={() => setActiveWO(wo)}
                        onView={() => setActiveWO(wo)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Execution Modal */}
      {activeWO && (
        <PmExecutionModal
          woId={activeWO.id}
          pmWorkOrder={activeWO}
          onClose={() => setActiveWO(null)}
        />
      )}
    </div>
  )
}
