import { useState, useEffect } from 'react'
import {
  listenSystemReadings,
  listenWorkOrders,
  listenIncidents,
  listenInventory,
  listenDevices,
  listenPmWorkOrders,
  listenDisposalRequests,
} from '@/firebase/db'
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Timestamp } from 'firebase/firestore'
import type { InfraSystem, WorkOrder, Incident, WarehouseItem, MedicalDevice } from '@/firebase/types'
import type { PMWorkOrder, DisposalRequest, TechnicianKpi } from '@/types/firestore'
import {
  Zap,
  Droplets,
  Wrench,
  Activity,
  Package,
  AlertOctagon,
  Server,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  TrendingDown,
  Users,
  AlertTriangle as AlertTriangleIcon,
  ArrowUpFromLine,
  Gauge,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/ui/Table'
import { startOfMonth, endOfMonth } from 'date-fns'
import { KpiDetailPanel } from '@/components/kpi/KpiDetailPanel'

// ─── helpers ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="skeleton-line h-3 w-24" />
          <div className="skeleton-line h-8 w-16" />
          <div className="skeleton-line h-2.5 w-32" />
        </div>
        <div className="skeleton-line w-10 h-10 rounded-xl" />
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  colorClass,
  iconBgClass,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  colorClass: string
  iconBgClass: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBgClass}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: InfraSystem['status'] }) {
  const map: Record<string, string> = {
    ok: 'bg-green-500',
    online: 'bg-green-500',
    warn: 'bg-yellow-500',
    warning: 'bg-yellow-500',
    crit: 'bg-red-500',
    critical: 'bg-red-500',
    offline: 'bg-gray-500',
  }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${map[status] || 'bg-gray-400'}`} />
}

const SEVERITY_DOT: Record<string, string> = {
  low: 'bg-blue-400',
  medium: 'bg-yellow-400',
  high: 'bg-orange-400',
  critical: 'bg-red-500',
}

const INCIDENT_STATUS_LABEL: Record<string, string> = {
  open: 'Mở',
  investigating: 'Đang xử lý',
  closed: 'Đã đóng',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp',
  medium: 'TB',
  high: 'Cao',
  critical: 'Khẩn cấp',
}

const PRIORITY_BADGE: Record<string, string> = {
  low: 'badge-gray',
  medium: 'badge-info',
  high: 'badge-warning',
  critical: 'badge-danger',
}

const WO_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

function WoStatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
  if (status === 'in_progress') return <Clock className="w-4 h-4 text-blue-400 shrink-0" />
  if (status === 'cancelled') return <XCircle className="w-4 h-4 text-gray-500 shrink-0" />
  return <Clock className="w-4 h-4 text-gray-400 shrink-0" />
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const [systemReadings, setSystemReadings] = useState<(InfraSystem & { id: string })[]>([])
  const [workOrders, setWorkOrders] = useState<(WorkOrder & { id: string })[]>([])
  const [incidents, setIncidents] = useState<(Incident & { id: string })[]>([])
  const [inventory, setInventory] = useState<(WarehouseItem & { id: string })[]>([])
  const [devices, setDevices] = useState<(MedicalDevice & { id: string })[]>([])
  const [pmWorkOrders, setPmWorkOrders] = useState<(PMWorkOrder & { id: string })[]>([])
  const [disposalRequests, setDisposalRequests] = useState<(DisposalRequest & { id: string })[]>([])

  const [hasFirstLoad, setHasFirstLoad] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [complianceValue, setComplianceValue] = useState<number>(0)
  const [teamKpis, setTeamKpis] = useState<TechnicianKpi[]>([])
  const [selectedKpi, setSelectedKpi] = useState<TechnicianKpi | null>(null)

  useEffect(() => {
    let errMsg: string | null = null
    const unsubs = [
      listenSystemReadings(setSystemReadings),
      listenWorkOrders(setWorkOrders),
      listenIncidents(setIncidents),
      listenInventory(setInventory),
      listenDevices(setDevices),
      listenPmWorkOrders(setPmWorkOrders as (docs: (PMWorkOrder & { id: string })[]) => void),
      listenDisposalRequests(setDisposalRequests as (docs: (DisposalRequest & { id: string })[]) => void),
    ]

    const timer = setTimeout(() => {
      setHasFirstLoad(true)
      if (errMsg) setError(errMsg)
    }, 300)

    return () => {
      unsubs.forEach((u) => u())
      clearTimeout(timer)
    }
  }, [])

  // Subscribe to team KPIs
  useEffect(() => {
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const unsub = onSnapshot(
      query(
        collection(db, 'technicianKpi'),
        where('period', '==', period),
        orderBy('score', 'desc'),
        limit(10),
      ),
      (snap) => {
        setTeamKpis(snap.docs.map((d) => d.data() as TechnicianKpi))
      },
    )
    return unsub
  }, [])

  useEffect(() => {
    const fetchCompliance = async () => {
      try {
        const devicesSnap = await getDocs(
          query(collection(db, 'devices'), where('status', '==', 'operational'))
        )
        const total = devicesSnap.size
        if (total === 0) { setComplianceValue(100); return }

        const now = Timestamp.now()
        const overdueSnap = await getDocs(
          query(collection(db, 'devices'),
            where('status', '==', 'operational'),
            where('nextService', '<', now))
        )
        const overdue = overdueSnap.size
        const compliance = Math.round(((total - overdue) / total) * 100)
        setComplianceValue(compliance)
      } catch {
        const complianceSnap = await getDocs(collection(db, 'compliance'))
        const total = complianceSnap.size
        if (total === 0) { setComplianceValue(100); return }
        const compliant = complianceSnap.docs.filter((d) => d.data().status === 'compliant').length
        setComplianceValue(Math.round((compliant / total) * 100))
      }
    }
    fetchCompliance()
  }, [])

  // Aggregate metrics
  const powerReading = systemReadings.find((r) => r.type === 'electrical')
  const waterReading = systemReadings.find((r) => r.type === 'water')
  const openWorkOrders = workOrders.filter((w) => w.status !== 'completed' && w.status !== 'cancelled').length
  const activeDevices = devices.filter((d) => d.status === 'operational').length
  const totalDevices = devices.length
  const deviceUptime = totalDevices > 0 ? Math.round((activeDevices / totalDevices) * 100) : 0
  const lowStockItems = inventory.filter((i) => i.quantity < i.minQuantity).length
  const criticalIncidents = incidents.filter((i) => (i.severity === 'high' || i.severity === 'critical') && i.status === 'open').length

  const latestIncidents = incidents.slice(0, 5)
  const recentWorkOrders = workOrders.slice(0, 5)

  // PM metrics
  const overduePmWos = pmWorkOrders.filter((wo) => wo.status === 'overdue').length
  const now = new Date()
  const upcomingPmWos = pmWorkOrders.filter((wo) => {
    if (!wo.dueDate || wo.status === 'completed' || wo.status === 'cancelled') return false
    const days = Math.floor((wo.dueDate.toDate().getTime() - now.getTime()) / 86_400_000)
    return days >= 0 && days <= 7
  }).length

  // Disposal metrics (P2.2)
  const approvedDisposals = disposalRequests.filter((r) => r.status === 'approved').length
  const pendingReview = disposalRequests.filter((r) => r.status === 'pending_review').length

  // PM compliance for current month
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const thisMonthPmWos = pmWorkOrders.filter((wo) => {
    if (!wo.dueDate) return false
    const d = wo.dueDate.toDate()
    return d >= monthStart && d <= monthEnd
  })
  const completedPm = thisMonthPmWos.filter((wo) => wo.status === 'completed').length
  const overduePm = thisMonthPmWos.filter((wo) => wo.status === 'overdue').length
  const pmCompliance = thisMonthPmWos.length > 0
    ? Math.round((completedPm / (completedPm + overduePm || 1)) * 100)
    : 100

  // KPI aggregate values derived from live data
  const uptimeValue = deviceUptime
  const woCompletionValue = workOrders.length > 0
    ? Math.round((workOrders.filter((w) => w.status === 'completed').length / workOrders.length) * 100)
    : 0
  const safetyValue = incidents.length > 0
    ? Math.max(0, Math.round(((incidents.length - criticalIncidents) / incidents.length) * 100))
    : 100

  const isLoading = !hasFirstLoad

  const handleRetry = () => {
    setError(null)
    window.location.reload()
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* page header skeleton */}
        <div className="space-y-1">
          <div className="skeleton-line h-5 w-32" />
          <div className="skeleton-line h-3 w-48 mt-2" />
        </div>
        {/* row 1: 6 stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        {/* row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="card-header"><div className="skeleton-line h-4 w-36" /></div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton-line h-20 rounded-xl" />)}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="skeleton-line h-4 w-36" /></div>
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton-line w-3 h-3 rounded-full shrink-0" />
                  <div className="skeleton-line h-3 flex-1" />
                  <div className="skeleton-line h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* row 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="card-header"><div className="skeleton-line h-4 w-40" /></div>
            <div className="divide-y divide-white/[0.05]">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="skeleton-line w-4 h-4 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton-line h-3 w-48" />
                    <div className="skeleton-line h-2.5 w-24" />
                  </div>
                  <div className="skeleton-line h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="skeleton-line h-4 w-32" /></div>
            <div className="p-4 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="skeleton-line h-3 w-32" />
                    <div className="skeleton-line h-3 w-12" />
                  </div>
                  <div className="skeleton-line h-2.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertOctagon className="w-8 h-8" />}
        title="Không thể tải dữ liệu"
        description={error}
        action={handleRetry}
        actionLabel="Thử lại"
      />
    )
  }

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* page header */}
      <div>
        <h1 className="text-lg font-bold text-gray-100">Tổng quan</h1>
        <p className="text-sm text-gray-500">Bệnh viện BMS — {today}</p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigate('/maintenance?new=true')}
          className="btn btn-am flex items-center gap-1.5 text-xs"
        >
          <Wrench className="w-3.5 h-3.5" />
          Tạo Work Order
        </button>
        <button
          onClick={() => navigate('/incidents?new=true')}
          className="btn btn-ghost flex items-center gap-1.5 text-xs"
        >
          <AlertTriangleIcon className="w-3.5 h-3.5" />
          Báo sự cố
        </button>
        <button
          onClick={() => navigate('/warehouse?export=true')}
          className="btn btn-ghost flex items-center gap-1.5 text-xs"
        >
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          Xuất vật tư
        </button>
        <button
          onClick={() => navigate('/infrastructure?log=true')}
          className="btn btn-ghost flex items-center gap-1.5 text-xs"
        >
          <Gauge className="w-3.5 h-3.5" />
          Ghi chỉ số
        </button>
      </div>

      {/* ─── ROW 1: 8 stat cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard
          icon={Zap}
          label="Điện hôm nay"
          value={powerReading ? `${powerReading.lastReading} ${powerReading.unit}` : '—'}
          sub={powerReading ? powerReading.location : 'Chưa có dữ liệu'}
          colorClass="text-yellow-400"
          iconBgClass="bg-yellow-500"
        />
        <StatCard
          icon={Droplets}
          label="Nước hôm nay"
          value={waterReading ? `${waterReading.lastReading} ${waterReading.unit}` : '—'}
          sub={waterReading ? waterReading.location : 'Chưa có dữ liệu'}
          colorClass="text-blue-400"
          iconBgClass="bg-blue-500"
        />
        <StatCard
          icon={Wrench}
          label="Work Orders mở"
          value={openWorkOrders}
          sub={`${workOrders.length} tổng số phiếu`}
          colorClass="text-blue-400"
          iconBgClass="bg-blue-600"
        />
        <StatCard
          icon={Activity}
          label="TTBYT Uptime"
          value={totalDevices > 0 ? `${deviceUptime}%` : '—'}
          sub={totalDevices > 0 ? `${activeDevices}/${totalDevices} thiết bị` : 'Chưa có thiết bị'}
          colorClass="text-green-400"
          iconBgClass="bg-green-600"
        />
        <StatCard
          icon={Package}
          label="Cần đặt hàng"
          value={lowStockItems}
          sub={`${inventory.length} mặt hàng trong kho`}
          colorClass={lowStockItems > 0 ? 'text-orange-400' : 'text-gray-400'}
          iconBgClass={lowStockItems > 0 ? 'bg-orange-500' : 'bg-gray-600'}
        />
        <StatCard
          icon={AlertOctagon}
          label="Sự cố nghiêm trọng"
          value={criticalIncidents}
          sub={`${incidents.length} sự cố đang mở`}
          colorClass={criticalIncidents > 0 ? 'text-red-400' : 'text-gray-400'}
          iconBgClass={criticalIncidents > 0 ? 'bg-red-500' : 'bg-gray-600'}
        />
        <StatCard
          icon={ShieldCheck}
          label="BT phòng ngừa"
          value={overduePmWos}
          sub={`${upcomingPmWos} sắp đến hạn`}
          colorClass={overduePmWos > 0 ? 'text-red-400' : upcomingPmWos > 0 ? 'text-amber' : 'text-green-400'}
          iconBgClass={overduePmWos > 0 ? 'bg-red-500' : upcomingPmWos > 0 ? 'bg-amber-500' : 'bg-green-600'}
        />
        <StatCard
          icon={TrendingDown}
          label="Chờ thanh lý"
          value={approvedDisposals}
          sub={`${pendingReview} chờ xem xét`}
          colorClass={approvedDisposals > 0 ? 'text-amber' : 'text-gray-400'}
          iconBgClass={approvedDisposals > 0 ? 'bg-amber-500' : 'bg-gray-600'}
        />
      </div>

      {/* ─── ROW 2 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: System status grid */}
        <div className="lg:col-span-2">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-yellow-400" />
              Trạng thái Hệ thống
            </h3>
            <span className="text-xs text-gray-500">
              {systemReadings.length} cảm biến
            </span>
          </div>
          <div className="p-4">
            {systemReadings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">Chưa có dữ liệu cảm biến</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {systemReadings.map((sys) => (
                  <div
                    key={sys.id}
                    className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.07]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={sys.status} />
                        <span className="text-xs font-medium text-gray-400 capitalize">
                          {(sys.status as string) === 'ok' ? 'Bình thường'
                            : (sys.status as string) === 'warn' ? 'Cảnh báo'
                            : (sys.status as string) === 'crit' ? 'Nguy hiểm'
                            : sys.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-200 line-clamp-1">{sys.name}</p>
                    <p className="text-lg font-bold text-yellow-400 mt-1">
                      {sys.lastReading}
                      <span className="text-xs font-normal text-gray-500 ml-1">{sys.unit}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{sys.location}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>

        {/* RIGHT: Incidents timeline */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              Sự cố gần đây
            </h3>
            <span className="text-xs text-gray-500">5 sự cố mới nhất</span>
          </div>
          <div className="p-4 space-y-3">
            {latestIncidents.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Không có sự cố nào</p>
              </div>
            ) : (
              latestIncidents.map((inc) => (
                <div key={inc.id} className="flex items-start gap-3">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[inc.severity] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 line-clamp-1">{inc.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${
                        inc.severity === 'critical' ? 'badge-danger'
                          : inc.severity === 'high' ? 'badge-warning'
                          : inc.severity === 'medium' ? 'badge-info'
                          : 'badge-gray'
                      }`}>
                        {inc.severity === 'critical' ? 'Nguy kịch'
                          : inc.severity === 'high' ? 'Nghiêm trọng'
                          : inc.severity === 'medium' ? 'Trung bình'
                          : 'Nhẹ'}
                      </span>
                      <span className="text-xs text-gray-500">{INCIDENT_STATUS_LABEL[inc.status]}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{inc.location}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── ROW 3 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: Today's work orders */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-400" />
              Phiếu Bảo trì gần đây
            </h3>
            <span className="text-xs text-gray-500">{workOrders.length} phiếu</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {recentWorkOrders.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500">Không có phiếu bảo trì nào</p>
              </div>
            ) : (
              recentWorkOrders.map((wo) => (
                <div key={wo.id} className="px-4 py-3 flex items-start gap-3">
                  <WoStatusIcon status={wo.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 line-clamp-1">{wo.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${PRIORITY_BADGE[wo.priority]}`}>
                        {PRIORITY_LABEL[wo.priority]}
                      </span>
                      <span className="text-xs text-gray-500">{WO_STATUS_LABEL[wo.status]}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 truncate max-w-[80px]">{wo.location}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: KPI bars */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              KPI Tháng này
            </h3>
            <span className="text-xs text-gray-500">Mục tiêu vs Thực tế</span>
          </div>
          <div className="p-4 space-y-5">
            {[
              { label: 'Uptime', actual: uptimeValue, target: 99, color: 'bg-green-500', trackClass: 'bg-green-500/10' },
              { label: 'Hoàn thành đúng hạn', actual: woCompletionValue, target: 90, color: 'bg-blue-500', trackClass: 'bg-blue-500/10' },
              { label: 'Tuân thủ', actual: complianceValue, target: 95, color: 'bg-purple-500', trackClass: 'bg-purple-500/10' },
              { label: 'An toàn', actual: safetyValue, target: 100, color: 'bg-yellow-500', trackClass: 'bg-yellow-500/10' },
              { label: 'Hoàn thành PM tháng', actual: pmCompliance, target: 90, color: 'bg-cyan-500', trackClass: 'bg-cyan-500/10' },
            ].map((kpi) => {
              const pct = Math.min(100, kpi.actual)
              const onTrack = kpi.actual >= kpi.target * 0.9
              return (
                <div key={kpi.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{kpi.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${onTrack ? 'text-green-400' : 'text-red-400'}`}>
                        {kpi.actual}%
                      </span>
                      <span className="text-xs text-gray-500">/ {kpi.target}%</span>
                    </div>
                  </div>
                  <div className={`h-2.5 rounded-full overflow-hidden ${kpi.trackClass}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${kpi.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── ROW 4: Team KPI widget ─── */}
      {teamKpis.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber" />
              Hiệu suất nhân viên tháng này
            </h3>
            <a href="/org?tab=kpi" className="text-xs text-amber hover:underline">
              Xem tất cả →
            </a>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {teamKpis.slice(0, 4).map((kpi, i) => {
                const gradeColor: Record<string, string> = {
                  A: 'text-green-400', B: 'text-teal-400', C: 'text-amber', D: 'text-orange-500', F: 'text-red-400',
                }
                const medals = ['🥇', '🥈', '🥉', '']
                return (
                  <button
                    key={kpi.uid}
                    onClick={() => setSelectedKpi(kpi)}
                    className="w-full flex items-center gap-3 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all text-left"
                  >
                    <span className="text-base shrink-0 w-6 text-center">{medals[i]}</span>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        backgroundColor: `${gradeColor[kpi.grade]?.replace('text-', '')}20`,
                        color: gradeColor[kpi.grade],
                      }}
                    >
                      {(kpi.name.split(' ').slice(0, 2).map((w) => w[0]).join(''))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{kpi.name}</p>
                      <p className="text-xs text-t3">{kpi.department || kpi.role}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className={`text-lg font-bold ${gradeColor[kpi.grade] ?? 'text-gray-400'}`}>
                          {kpi.score}
                        </p>
                        <p className="text-[10px] text-t3">điểm</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${gradeColor[kpi.grade] ?? 'text-gray-400'}`}
                        style={{ backgroundColor: `${gradeColor[kpi.grade]?.replace('text-', '')}15` }}>
                        {kpi.grade}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            {teamKpis.some((k) => k.score < 60) && (
              <div className="mt-3 px-3 py-2 bg-amber/10 border border-amber/20 rounded-lg">
                <p className="text-xs text-amber">
                  {teamKpis.filter((k) => k.score < 60).length} nhân viên cần hỗ trợ cải thiện
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedKpi && (
        <KpiDetailPanel kpi={selectedKpi} onClose={() => setSelectedKpi(null)} />
      )}
    </div>
  )
}
