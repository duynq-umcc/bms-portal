import { useState, useEffect, useRef } from 'react'
import {
  listenWorkOrders,
  listenIncidents,
  listenPmWorkOrders,
  addWorkOrder,
  updateWorkOrder,
} from '@/firebase/db'
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority, Incident } from '@/firebase/types'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import { TableSkeleton, EmptyState } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Timestamp } from 'firebase/firestore'
import {
  Plus, Wrench, CheckCircle2, Clock, XCircle, AlertCircle,
  Calendar, ChevronLeft, ChevronRight, GripVertical,
  X, User, MapPin, Tag, AlignLeft, ShieldCheck,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, addMonths, subMonths, differenceInDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import PmWorkOrderList from './PmWorkOrderList'
import PmScheduleManager from './PmScheduleManager'

// ─── types ────────────────────────────────────────────────────────────────────

type TabId = 'list' | 'calendar' | 'timeline' | 'pm' | 'pm-schedules'

const STATUS_OPTIONS: { value: WorkOrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'in_progress', label: 'Đang thực hiện' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
]

const PRIORITY_OPTIONS: { value: WorkOrderPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'Mọi mức' },
  { value: 'critical', label: 'Khẩn cấp' },
  { value: 'high', label: 'Cao' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'low', label: 'Thấp' },
]

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Loại' },
  { value: 'electrical', label: 'Điện' },
  { value: 'plumbing', label: 'Nước' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'structural', label: 'Kết cấu' },
  { value: 'it', label: 'IT' },
  { value: 'medical', label: 'Y tế' },
  { value: 'safety', label: 'An toàn' },
  { value: 'other', label: 'Khác' },
]

const LOCATION_OPTIONS = [
  'Tầng 1', 'Tầng 2', 'Tầng 3', 'Tầng 4', 'Tầng 5', 'Tầng hầm',
  'Khoa Cấp cứu', 'Khoa Tim mạch', 'Khoa Nhi', 'Phòng mổ', 'ICU', 'Khoa Chẩn đoán hình ảnh',
]

const PRIORITY_COLORS: Record<string, string> = {
  low: 'badge-gray',
  medium: 'badge-info',
  high: 'badge-warning',
  critical: 'badge-danger',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-warning',
  in_progress: 'badge-info',
  completed: 'badge-success',
  cancelled: 'badge-gray',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Khẩn cấp',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

// ─── form schema ──────────────────────────────────────────────────────────────

const woSchema = z.object({
  title: z.string().min(3, 'Tiêu đề ít nhất 3 ký tự'),
  location: z.string().min(1, 'Chọn vị trí'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string().optional(),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
})

type WoForm = z.infer<typeof woSchema>

// ─── swipe card (mobile) ───────────────────────────────────────────────────────

function SwipeCard({
  wo, onAssign, onDone,
}: {
  wo: WorkOrder & { id: string }
  onAssign: (id: string, name: string) => void
  onDone: (id: string) => void
}) {
  const [swipeX, setSwipeX] = useState(0)
  const [startX, setStartX] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX)
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - startX
    if (diff > 0) setSwipeX(Math.min(diff, 120))
    else setSwipeX(Math.max(diff, -120))
  }
  const handleTouchEnd = () => {
    if (swipeX > 80) {
      setSwipeX(0)
      const name = prompt('Nhập tên kỹ thuật viên:')
      if (name) onAssign(wo.id, name)
    } else if (swipeX < -80) {
      setSwipeX(0)
      if (navigator.vibrate) navigator.vibrate(10)
      onDone(wo.id)
    } else {
      setSwipeX(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl mb-2">
      {/* Swipe background */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 bg-green-500/20 flex items-center px-4">
          <User className="w-5 h-5 text-green-400" />
          <span className="ml-2 text-sm text-green-400 font-medium">Giao việc</span>
        </div>
        <div className="flex-1 bg-blue-500/20 flex items-center justify-end px-4">
          <span className="mr-2 text-sm text-blue-400 font-medium">Hoàn thành</span>
          <CheckCircle2 className="w-5 h-5 text-blue-400" />
        </div>
      </div>

      {/* Card content */}
      <div
        ref={cardRef}
        className="relative bg-ink-2 rounded-xl border border-white/[0.07] p-3 transition-transform"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <span className={`badge ${PRIORITY_COLORS[wo.priority]} ${wo.priority === 'critical' ? 'animate-pulse' : ''}`}>
              {PRIORITY_LABEL[wo.priority]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 line-clamp-1">{wo.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {wo.location}
            </p>
            {wo.system && (
              <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {wo.system}
              </p>
            )}
          </div>
          <span className={`badge ${STATUS_COLORS[wo.status]} shrink-0`}>
            {STATUS_LABEL[wo.status]}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-600">
          <GripVertical className="w-3 h-3" />
          <span>Vuốt trái/gặp để thao tác nhanh</span>
        </div>
      </div>
    </div>
  )
}

// ─── work order row (desktop table) ────────────────────────────────────────────

function WoRow({
  wo, onDone, onStatusChange,
}: {
  wo: WorkOrder & { id: string }
  onDone: (id: string) => void
  onStatusChange: (id: string, status: WorkOrderStatus) => void
}) {
  const statusIcon = wo.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" />
    : wo.status === 'in_progress' ? <AlertCircle className="w-3.5 h-3.5" />
    : wo.status === 'cancelled' ? <XCircle className="w-3.5 h-3.5" />
    : <Clock className="w-3.5 h-3.5" />

  return (
    <tr className="hover:bg-white/[0.03] transition-colors group">
      <td className="px-3 py-2.5">
        <span className="text-xs font-mono text-gray-500">#{wo.id.slice(0, 8)}</span>
      </td>
      <td className="px-3 py-2.5 min-w-0">
        <p className="text-sm font-medium text-gray-200 line-clamp-1">{wo.title}</p>
        {wo.description && <p className="text-xs text-gray-600 line-clamp-1 mt-0.5">{wo.description}</p>}
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-400 hidden md:table-cell">{wo.location}</td>
      <td className="px-3 py-2.5 hidden lg:table-cell">
        {wo.system ? (
          <span className="badge badge-gray text-xs">{wo.system.split(' ')[0]}</span>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className={`${PRIORITY_COLORS[wo.priority]} ${wo.priority === 'critical' ? 'animate-pulse' : ''}`}>
          {PRIORITY_LABEL[wo.priority]}
        </span>
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-400 hidden md:table-cell">
        {wo.assignedTo || <span className="text-gray-600 text-xs">—</span>}
      </td>
      <td className="px-3 py-2.5">
        <span className={`${STATUS_COLORS[wo.status]} flex items-center gap-1`}>
          {statusIcon}
          {STATUS_LABEL[wo.status]}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-500 hidden lg:table-cell">
        {wo.createdAt ? format(wo.createdAt.toDate(), 'dd/MM/yy') : '—'}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          {wo.status !== 'completed' && wo.status !== 'cancelled' && (
            <select
              value={wo.status}
              onChange={(e) => onStatusChange(wo.id, e.target.value as WorkOrderStatus)}
              className="text-xs border border-white/[0.1] rounded-lg px-1.5 py-1 text-gray-400 bg-transparent hover:bg-white/[0.05] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {STATUS_OPTIONS.filter((s) => s.value !== 'all').map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => onDone(wo.id)}
            className="p-1 text-green-500 hover:bg-green-500/10 rounded transition-colors"
            title="Hoàn thành"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── monthly calendar ───────────────────────────────────────────────────────────

function MonthlyCalendar({
  workOrders,
  selectedDate,
  onSelectDate,
}: {
  workOrders: (WorkOrder & { id: string })[]
  selectedDate: Date | null
  onSelectDate: (d: Date) => void
}) {
  const [month, setMonth] = useState(new Date())

  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const startDow = startOfWeek(start, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: startDow, end })

  const dowLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

  const getCount = (d: Date) =>
    workOrders.filter((wo) => wo.createdAt && isSameDay(wo.createdAt.toDate(), d)).length

  return (
    <div className="card overflow-hidden">
      {/* Month nav */}
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

      {/* Grid */}
      <div className="p-3">
        {/* Day-of-week labels */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dowLabels.map((d) => (
            <div key={d} className="text-center text-xs text-gray-600 font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const inMonth = day.getMonth() === month.getMonth()
            const todayFlag = isToday(day)
            const selectedFlag = selectedDate ? isSameDay(day, selectedDate) : false
            const count = getCount(day)
            const hasWO = count > 0

            return (
              <button
                key={day.toISOString()}
                onClick={() => onSelectDate(day)}
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
                {hasWO && (
                  <div className={`mt-0.5 w-1.5 h-1.5 rounded-full ${count >= 3 ? 'bg-red-500' : count >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── timeline ──────────────────────────────────────────────────────────────────

type TimelineItem =
  | { kind: 'wo'; data: WorkOrder & { id: string } }
  | { kind: 'incident'; data: Incident & { id: string } }

function TimelineItem({ item }: { item: TimelineItem }) {
  const isWo = item.kind === 'wo'
  const title = isWo ? item.data.title : item.data.title
  const time = isWo
    ? (item.data.createdAt ? format(item.data.createdAt.toDate(), 'dd/MM HH:mm') : '')
    : (item.data.createdAt ? format(item.data.createdAt.toDate(), 'dd/MM HH:mm') : '')

  const dotColor = isWo
    ? item.data.status === 'completed' ? 'bg-green-500'
    : item.data.status === 'in_progress' ? 'bg-yellow-500'
    : 'bg-gray-500'
    : item.data.severity === 'critical' ? 'bg-red-500'
    : item.data.severity === 'high' ? 'bg-orange-500'
    : 'bg-blue-500'

  return (
    <li className="relative pl-6 pb-5 border-l border-white/[0.1] last:pb-0">
      <span
        className={`absolute left-0 top-1 w-2.5 h-2.5 rounded-full border-2 border-ink translate-x-[-5px] ${dotColor}`}
      />
      <div className="card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 line-clamp-1">{title}</p>
            <div className="flex items-center gap-2 mt-1">
              {isWo ? (
                <span className={`badge ${STATUS_COLORS[item.data.status]}`}>
                  {STATUS_LABEL[item.data.status]}
                </span>
              ) : (
                <span className={`badge ${
                  item.data.severity === 'critical' ? 'badge-danger'
                    : item.data.severity === 'high' ? 'badge-warning'
                    : 'badge-info'
                }`}>
                  {item.data.severity === 'critical' ? 'Nguy kịch'
                    : item.data.severity === 'high' ? 'Nghiêm trọng'
                    : item.data.severity === 'medium' ? 'TB'
                    : 'Nhẹ'}
                </span>
              )}
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {item.data.location}
              </span>
            </div>
          </div>
          <span className="text-xs text-gray-600 shrink-0">{time}</span>
        </div>
      </div>
    </li>
  )
}

// ─── new work order modal ─────────────────────────────────────────────────────

function NewWorkOrderModal({
  open, onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { user } = useAuth()
  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<WoForm>({ resolver: zodResolver(woSchema) })

  const onSubmit = async (data: WoForm) => {
    try {
      await addWorkOrder({
        title: data.title,
        location: data.location,
        priority: data.priority,
        system: data.category || '',
        description: data.description || '',
        assignedTo: data.assignedTo || '',
        status: 'pending',
        createdBy: user?.uid || '',
      })
      toast.success('Đã tạo Work Order')
      reset()
      onClose()
    } catch {
      toast.error('Tạo thất bại, vui lòng thử lại')
    }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Tạo Work Order" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Tiêu đề <span className="text-red-400">*</span>
          </label>
          <input
            {...register('title')}
            placeholder="Mô tả ngắn gọn sự cố..."
            className="input-field"
          />
          {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Vị trí <span className="text-red-400">*</span>
            </label>
            <select {...register('location')} className="input-field">
              <option value="">Chọn vị trí</option>
              {LOCATION_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Mức độ ưu tiên <span className="text-red-400">*</span>
            </label>
            <select {...register('priority')} className="input-field">
              {['critical', 'high', 'medium', 'low'].map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Loại</label>
            <select {...register('category')} className="input-field">
              <option value="">Chọn loại</option>
              {CATEGORY_OPTIONS.filter((c) => c.value !== 'all').map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Giao cho</label>
            <input
              {...register('assignedTo')}
              placeholder="Tên kỹ thuật viên..."
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Mô tả</label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Mô tả chi tiết (tùy chọn)..."
            className="input-field resize-none"
          />
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Đang tạo...' : 'Tạo Work Order'}
        </button>
      </form>
    </Modal>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const { user } = useAuth()
  const [workOrders, setWorkOrders] = useState<(WorkOrder & { id: string })[]>([])
  const [incidents, setIncidents] = useState<(Incident & { id: string })[]>([])
  const [pmWorkOrders, setPmWorkOrders] = useState<({ id: string } & import('@/types/firestore').PMWorkOrder)[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [tab, setTab] = useState<TabId>('list')
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'incident' | 'pm'>('all')

  useEffect(() => {
    const unsubs = [
      listenWorkOrders(setWorkOrders),
      listenIncidents(setIncidents),
      listenPmWorkOrders(setPmWorkOrders as (docs: ({ id: string } & import('@/types/firestore').PMWorkOrder)[]) => void),
    ]
    const timer = setTimeout(() => setLoading(false), 1200)
    return () => { unsubs.forEach((u) => u()); clearTimeout(timer) }
  }, [])

  const filtered = workOrders.filter((wo) => {
    if (statusFilter !== 'all' && wo.status !== statusFilter) return false
    if (priorityFilter !== 'all' && wo.priority !== priorityFilter) return false
    if (categoryFilter !== 'all' && wo.system?.toLowerCase() !== categoryFilter) return false
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'incident' && !wo.sourceIncident) return false
      if (sourceFilter === 'pm' && !wo.sourcePm) return false
    }
    return true
  })

  // PM stats for badge
  const now = new Date()
  const overduePm = pmWorkOrders.filter((wo) => wo.status === 'overdue').length
  const upcomingPm = pmWorkOrders.filter((wo) => {
    if (!wo.dueDate) return false
    const days = differenceInDays(wo.dueDate.toDate(), now)
    return days >= 0 && days <= 7
  }).length
  const pmBadge = overduePm > 0 ? overduePm : upcomingPm > 0 ? upcomingPm : 0

  // Timeline merged
  const timelineItems: TimelineItem[] = [
    ...workOrders.map((wo) => ({ kind: 'wo' as const, data: wo })),
    ...incidents.map((inc) => ({ kind: 'incident' as const, data: inc })),
  ]
    .sort((a, b) => {
      const ta = (a.kind === 'wo' ? a.data.createdAt : (a.data as Incident).createdAt)
      const tb = (b.kind === 'wo' ? b.data.createdAt : (b.data as Incident).createdAt)
      if (!ta || !tb) return 0
      return tb.toDate().getTime() - ta.toDate().getTime()
    })
    .slice(0, 20)

  // Day orders for calendar panel
  const dayOrders = selectedDate
    ? workOrders.filter((wo) => wo.createdAt && isSameDay(wo.createdAt.toDate(), selectedDate))
    : []

  const handleAssign = async (id: string, name: string) => {
    try {
      await updateWorkOrder(id, { assignedTo: name })
      toast.success(`Đã giao cho: ${name}`)
    } catch {
      toast.error('Giao việc thất bại')
    }
  }

  const handleDone = async (id: string) => {
    try {
      await updateWorkOrder(id, { status: 'completed', completedAt: Timestamp.now() })
      toast.success('Đã hoàn thành Work Order')
    } catch {
      toast.error('Cập nhật thất bại')
    }
  }

  const handleStatusChange = async (id: string, status: WorkOrderStatus) => {
    try {
      const updates: Record<string, unknown> = { status }
      if (status === 'in_progress') {
        updates.startedAt = Timestamp.now()
      }
      await updateWorkOrder(id, updates)
      toast.success(`Trạng thái: ${STATUS_LABEL[status]}`)
    } catch {
      toast.error('Cập nhật thất bại')
    }
  }

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'list', label: 'Danh sách', icon: AlignLeft },
    { id: 'calendar', label: 'Lịch tháng', icon: Calendar },
    { id: 'timeline', label: 'Timeline', icon: Clock },
  ]

  const pmTabs: { id: TabId; label: string; icon: React.ElementType; managerOnly?: boolean }[] = [
    { id: 'pm', label: 'Lịch BT phòng ngừa', icon: ShieldCheck },
    { id: 'pm-schedules', label: 'Quản lý lịch BT', icon: Calendar, managerOnly: true },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48"><div className="card h-full animate-pulse bg-white/[0.06]" /></div>
        <TableSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">Bảo trì</h1>
          <p className="text-sm text-gray-500">
            {tab === 'pm' ? `${pmWorkOrders.length} phiếu BT phòng ngừa`
              : `${workOrders.length} phiếu Work Order`}
          </p>
        </div>
        {tab !== 'pm' && tab !== 'pm-schedules' && (
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Tạo phiếu</span>
        </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-white/[0.04] p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-amber text-ink font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
        {/* Separator */}
        {tabs.length > 0 && <div className="w-px bg-white/[0.1] mx-1 self-stretch" />}
        {pmTabs.map((t) => {
          if (t.managerOnly && !['admin', 'manager'].includes(user?.role ?? '')) return null
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.id
                  ? 'bg-amber text-ink font-semibold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === 'pm' && pmBadge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  overduePm > 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber/20 text-amber'
                }`}>
                  {pmBadge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab 1: Danh sách ── */}
      {tab === 'list' && (
        <>
          {/* PM summary widget */}
          {upcomingPm > 0 && (
            <div className="card p-3 flex items-center justify-between bg-amber/5 border border-amber/10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber" />
                <span className="text-sm text-gray-300">
                  {upcomingPm} lịch BT phòng ngừa sắp đến hạn trong 7 ngày
                </span>
              </div>
              <button
                onClick={() => setTab('pm')}
                className="text-xs text-amber hover:underline"
              >
                Xem tất cả →
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as WorkOrderStatus | 'all')}
              className="text-xs border border-white/[0.1] rounded-lg px-3 py-1.5 bg-white/[0.05] text-gray-300 cursor-pointer"
            >
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as WorkOrderPriority | 'all')}
              className="text-xs border border-white/[0.1] rounded-lg px-3 py-1.5 bg-white/[0.05] text-gray-300 cursor-pointer"
            >
              {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs border border-white/[0.1] rounded-lg px-3 py-1.5 bg-white/[0.05] text-gray-300 cursor-pointer"
            >
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | 'incident' | 'pm')}
              className="text-xs border border-white/[0.1] rounded-lg px-3 py-1.5 bg-white/[0.05] text-gray-300 cursor-pointer"
            >
              <option value="all">Tất cả</option>
              <option value="incident">Sự cố</option>
              <option value="pm">Bảo trì định kỳ</option>
            </select>
            {(statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all' || sourceFilter !== 'all') && (
              <button
                onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); setCategoryFilter('all'); setSourceFilter('all') }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-3 h-3" />
                Xóa lọc
              </button>
            )}
          </div>

          {/* Mobile: swipe cards */}
          <div className="block md:hidden space-y-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Wrench className="w-8 h-8" />}
                title="Không có Work Order"
                description="Tạo phiếu bảo trì đầu tiên"
                action={() => setShowNew(true)}
                actionLabel="Tạo phiếu"
              />
            ) : (
              filtered.map((wo) => (
                <SwipeCard
                  key={wo.id}
                  wo={wo}
                  onAssign={handleAssign}
                  onDone={handleDone}
                />
              ))
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Wrench className="w-8 h-8" />}
                title="Không có Work Order"
                description="Tạo phiếu bảo trì đầu tiên"
                action={() => setShowNew(true)}
                actionLabel="Tạo phiếu"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-desktop">
                  <thead>
                    <tr>
                      <th className="text-left">ID</th>
                      <th className="text-left">Tiêu đề</th>
                      <th className="text-left hidden md:table-cell">Vị trí</th>
                      <th className="text-left hidden lg:table-cell">Loại</th>
                      <th className="text-left">Ưu tiên</th>
                      <th className="text-left hidden md:table-cell">Nhân viên</th>
                      <th className="text-left">Trạng thái</th>
                      <th className="text-left hidden lg:table-cell">Ngày</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.map((wo) => (
                      <WoRow
                        key={wo.id}
                        wo={wo}
                        onDone={handleDone}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Tab 2: Lịch tháng ── */}
      {tab === 'calendar' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MonthlyCalendar
            workOrders={workOrders}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(isSameDay(d, selectedDate || new Date(0)) ? null : d)}
          />

          {/* Day detail panel */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-200">
                {selectedDate
                  ? format(selectedDate, 'dd MMMM yyyy', { locale: vi })
                  : 'Chọn ngày để xem'}
              </h3>
            </div>
            <div className="p-4">
              {!selectedDate ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  Nhấn vào một ngày trong lịch để xem danh sách Work Order
                </p>
              ) : dayOrders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  Không có Work Order nào trong ngày này
                </p>
              ) : (
                <div className="space-y-2">
                  {dayOrders.map((wo) => (
                    <div key={wo.id} className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.07]">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          <span className={`badge ${PRIORITY_COLORS[wo.priority]}`}>
                            {PRIORITY_LABEL[wo.priority]}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-200">{wo.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{wo.location}</p>
                        </div>
                        <span className={`badge ${STATUS_COLORS[wo.status]}`}>
                          {STATUS_LABEL[wo.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PM Tab: Lịch BT phòng ngừa ── */}
      {tab === 'pm' && <PmWorkOrderList />}

      {/* ── PM Tab: Quản lý lịch BT ── */}
      {tab === 'pm-schedules' && <PmScheduleManager />}

      {/* ── Tab 3: Timeline ── */}
      {tab === 'timeline' && (
        <div className="card p-4">
          {timelineItems.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-8 h-8" />}
              title="Không có hoạt động"
              description="Chưa có Work Order hay sự cố nào"
              action={() => setShowNew(true)}
              actionLabel="Tạo Work Order"
            />
          ) : (
            <ul className="tl space-y-0">
              {timelineItems.map((item) => (
                <TimelineItem key={`${item.kind}-${item.data.id}`} item={item} />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* FAB (mobile) */}
      {tab !== 'pm' && tab !== 'pm-schedules' && (
      <button
        onClick={() => setShowNew(true)}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-amber text-ink shadow-lg flex items-center justify-center active:scale-95 transition-transform z-40"
        aria-label="Tạo Work Order"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>
      )}

      {/* New WO modal */}
      <NewWorkOrderModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
