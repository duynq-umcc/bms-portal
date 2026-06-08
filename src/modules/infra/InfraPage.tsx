import { useState, useEffect } from 'react'
import { listenSystemReadings, listenPmWorkOrdersByAsset } from '@/firebase/db'
import type { InfraSystem, OperationLogShift } from '@/firebase/types'
import Modal from '@/components/ui/Modal'
import { CardSkeleton } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import {
  Zap, Droplets, Wind, Wind as O2Icon, Power, Flame,
  Thermometer, Gauge, ArrowUpDown, AlertTriangle, CheckCircle2,
  Clock, MapPin, User, FileText, BookMarked,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  collection, query, where, getDocs,
  onSnapshot, orderBy, limit,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import type { PMWorkOrder } from '@/types/firestore'
import OperationLogModal from './OperationLogModal'
import OperationLogList from './OperationLogList'

// ─── types ────────────────────────────────────────────────────────────────────

type ReadingStatus = 'ok' | 'warn' | 'crit'

interface SystemTileData {
  key: string
  name: string
  label: string
  icon: React.ElementType
  color: string
  status: ReadingStatus
  value: number
  unit: string
}

interface HvacUnit {
  id: string
  name: string
  location: string
  status: ReadingStatus
  temp: number
  capacity: number
}

interface LiftUnit {
  id: string
  name: string
  floors: string
  trips: number
  status: ReadingStatus
}

const SYSTEM_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  electrical: { label: 'Điện hạ thế', icon: Zap, color: 'text-yellow-400' },
  water: { label: 'Cấp nước', icon: Droplets, color: 'text-blue-400' },
  hvac: { label: 'HVAC T1-2', icon: Wind, color: 'text-cyan-400' },
  o2: { label: 'Khí Oxy', icon: O2Icon, color: 'text-sky-400' },
  generator: { label: 'Máy phát', icon: Power, color: 'text-orange-400' },
}

const STATUS_DOT: Record<ReadingStatus, { bg: string; ring?: string; pulse?: string }> = {
  ok: { bg: 'bg-green-500' },
  warn: { bg: 'bg-yellow-500', pulse: 'animate-pulse' },
  crit: { bg: 'bg-red-500', pulse: 'animate-pulse' },
}

const STATUS_LABEL: Record<ReadingStatus, string> = {
  ok: 'Hoạt động tốt',
  warn: 'Cảnh báo',
  crit: 'Nguy hiểm',
}

// ─── HVAC card ────────────────────────────────────────────────────────────────

function HvacCard({ unit, onClick }: { unit: HvacUnit; onClick: () => void }) {
  const borderColor = unit.status === 'ok' ? 'border-t-green-500'
    : unit.status === 'warn' ? 'border-t-yellow-500' : 'border-t-red-500'

  return (
    <button
      onClick={onClick}
      className={`card border-t-2 ${borderColor} p-4 text-left w-full hover:bg-white/[0.06] transition-colors`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-gray-200">{unit.name}</span>
        </div>
        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[unit.status].bg} ${STATUS_DOT[unit.status].pulse || ''}`} />
      </div>
      <p className="text-xs text-gray-500 mb-3">{unit.location}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Công suất</span>
          <span className="text-gray-300 font-medium">{unit.capacity}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              unit.capacity > 80 ? 'bg-red-500' : unit.capacity > 60 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${unit.capacity}%` }}
          />
        </div>
        <div className="flex items-center gap-1 mt-1">
          <Thermometer className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-300">{unit.temp}°C</span>
        </div>
      </div>
    </button>
  )
}

// ─── lift card ─────────────────────────────────────────────────────────────────

function LiftCard({ lift, onClick }: { lift: LiftUnit; onClick: () => void }) {
  const badgeClass = lift.status === 'ok' ? 'badge-success'
    : lift.status === 'warn' ? 'badge-warning' : 'badge-danger'

  return (
    <button
      onClick={onClick}
      className="card p-4 text-left w-full hover:bg-white/[0.06] transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-200">{lift.name}</span>
        </div>
        <span className={`badge ${badgeClass} ${STATUS_DOT[lift.status].pulse || ''}`}>
          {STATUS_LABEL[lift.status]}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Tầng: {lift.floors}</span>
        <span>{lift.trips} chuyến hôm nay</span>
      </div>
    </button>
  )
}

// ─── energy chart ──────────────────────────────────────────────────────────────

function EnergyChart({ data }: { data: { day: string; value: number }[] }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-1">Điện — 7 ngày</h3>
      <p className="text-xs text-gray-500 mb-3">kWh tiêu thụ</p>
      {data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
          Chưa có dữ liệu điện
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
          <Tooltip
            contentStyle={{ background: '#1c2a3f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12, color: '#9baec8' }}
            labelStyle={{ color: '#9baec8' }}
            itemStyle={{ color: '#facc15' }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 ? '#f59e0b' : '#f59e0b55'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── water chart ──────────────────────────────────────────────────────────────

function WaterChart({ data }: { data: { day: string; value: number }[] }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-1">Nước — 7 ngày</h3>
      <p className="text-xs text-gray-500 mb-3">m³ tiêu thụ</p>
      {data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
          Chưa có dữ liệu nước
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
          <Tooltip
            contentStyle={{ background: '#1c2a3f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12, color: '#9baec8' }}
            labelStyle={{ color: '#9baec8' }}
            itemStyle={{ color: '#60a5fa' }}
          />
          <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── HVAC detail modal ────────────────────────────────────────────────────────

function HvacDetailModal({ unit, open, onClose }: { unit: HvacUnit | null; open: boolean; onClose: () => void }) {
  if (!unit) return null
  const [serviceHistory, setServiceHistory] = useState<(PMWorkOrder & { id: string })[]>([])

  useEffect(() => {
    if (!unit?.id) return
    const unsub = listenPmWorkOrdersByAsset(unit.id, setServiceHistory)
    return unsub
  }, [unit?.id])

  return (
    <Modal open={open} onClose={onClose} title={`HVAC — ${unit.name}`} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Wind className="w-6 h-6 text-cyan-400" />
          <div>
            <h3 className="font-semibold text-gray-200">{unit.name}</h3>
            <p className="text-xs text-gray-500">{unit.location}</p>
          </div>
          <span className={`ml-auto badge ${
            unit.status === 'ok' ? 'badge-success' : unit.status === 'warn' ? 'badge-warning' : 'badge-danger'
          }`}>
            {STATUS_LABEL[unit.status]}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Nhiệt độ', value: `${unit.temp}°C`, icon: Thermometer },
            { label: 'Công suất', value: `${unit.capacity}%`, icon: Gauge },
            { label: 'Trạng thái', value: STATUS_LABEL[unit.status], icon: CheckCircle2 },
          ].map((item) => (
            <div key={item.label} className="bg-white/[0.05] rounded-xl p-3 text-center">
              <item.icon className="w-4 h-4 text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-sm font-bold text-gray-200">{item.value}</p>
            </div>
          ))}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Lịch sử bảo dưỡng</h4>
          <div className="space-y-2">
            {serviceHistory.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">Chưa có lịch sử bảo trì</p>
            ) : (
              serviceHistory.map((h) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <Clock className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-gray-300">{h.scheduleName}</p>
                    <p className="text-xs text-gray-500">
                      {h.completedAt
                        ? format(h.completedAt.toDate(), 'dd/MM/yyyy')
                        : h.dueDate
                        ? format(h.dueDate.toDate(), 'dd/MM/yyyy')
                        : '—'}
                      {' · '}
                      {h.assignedToName || '—'}
                    </p>
                  </div>
                  <span className={`badge ${h.status === 'completed' ? 'badge-success' : h.status === 'overdue' ? 'badge-danger' : 'badge-warning'} text-xs shrink-0`}>
                    {h.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── lift detail modal ────────────────────────────────────────────────────────

function LiftDetailModal({ lift, open, onClose }: { lift: LiftUnit | null; open: boolean; onClose: () => void }) {
  if (!lift) return null
  const [serviceHistory, setServiceHistory] = useState<(PMWorkOrder & { id: string })[]>([])

  useEffect(() => {
    if (!lift?.id) return
    const unsub = listenPmWorkOrdersByAsset(lift.id, setServiceHistory)
    return unsub
  }, [lift?.id])

  return (
    <Modal open={open} onClose={onClose} title={`Thang máy — ${lift.name}`} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ArrowUpDown className="w-6 h-6 text-gray-400" />
          <div>
            <h3 className="font-semibold text-gray-200">{lift.name}</h3>
            <p className="text-xs text-gray-500">Tầng {lift.floors}</p>
          </div>
          <span className={`ml-auto badge ${
            lift.status === 'ok' ? 'badge-success' : lift.status === 'warn' ? 'badge-warning' : 'badge-danger'
          }`}>
            {STATUS_LABEL[lift.status]}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Phạm vi tầng', value: lift.floors, icon: MapPin },
            { label: 'Chuyến hôm nay', value: `${lift.trips}`, icon: ArrowUpDown },
            { label: 'Trạng thái', value: STATUS_LABEL[lift.status], icon: CheckCircle2 },
          ].map((item) => (
            <div key={item.label} className="bg-white/[0.05] rounded-xl p-3 text-center">
              <item.icon className="w-4 h-4 text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-sm font-bold text-gray-200">{item.value}</p>
            </div>
          ))}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Lịch sử bảo trì</h4>
          <div className="space-y-2">
            {serviceHistory.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">Chưa có lịch sử bảo trì</p>
            ) : (
              serviceHistory.map((h) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <Clock className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-gray-300">{h.scheduleName}</p>
                    <p className="text-xs text-gray-500">
                      {h.completedAt
                        ? format(h.completedAt.toDate(), 'dd/MM/yyyy')
                        : h.dueDate
                        ? format(h.dueDate.toDate(), 'dd/MM/yyyy')
                        : '—'}
                      {' · '}
                      {h.assignedToName || '—'}
                    </p>
                  </div>
                  <span className={`badge ${h.status === 'completed' ? 'badge-success' : h.status === 'overdue' ? 'badge-danger' : 'badge-warning'} text-xs shrink-0`}>
                    {h.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── system detail modal ──────────────────────────────────────────────────────

function SystemDetailModal({
  system, open, onClose,
}: {
  system: SystemTileData | null; open: boolean; onClose: () => void
}) {
  const [assignName, setAssignName] = useState('')
  const [assigning, setAssigning] = useState(false)

  const handleAssign = () => {
    if (!assignName.trim()) return
    setAssigning(true)
    setTimeout(() => {
      toast.success(`Đã giao cho kỹ thuật viên: ${assignName}`)
      setAssignName('')
      setAssigning(false)
      onClose()
    }, 600)
  }

  if (!system) return null

  return (
    <Modal open={open} onClose={onClose} title="Chi tiết hệ thống" size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <system.icon className={`w-6 h-6 ${system.color}`} />
          <div>
            <h3 className="font-semibold text-gray-200">{system.name}</h3>
            <p className="text-xs text-gray-500">{system.label}</p>
          </div>
          <div className={`ml-auto w-3 h-3 rounded-full ${STATUS_DOT[system.status].bg} ${STATUS_DOT[system.status].pulse || ''}`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.05] rounded-xl p-3">
            <p className="text-xs text-gray-500">Giá trị hiện tại</p>
            <p className="text-xl font-bold text-gray-100">
              {system.value} <span className="text-xs font-normal text-gray-500">{system.unit}</span>
            </p>
          </div>
          <div className="bg-white/[0.05] rounded-xl p-3">
            <p className="text-xs text-gray-500">Trạng thái</p>
            <p className="text-sm font-semibold text-gray-100">{STATUS_LABEL[system.status]}</p>
          </div>
        </div>
        <div className="bg-white/[0.05] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <p className="text-xs text-gray-500">Cập nhật lần cuối</p>
          </div>
          <p className="text-sm text-gray-300">
            {new Date().toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            <User className="w-4 h-4 inline mr-1" />
            Giao kỹ thuật viên
          </label>
          <div className="flex gap-2">
            <input
              value={assignName}
              onChange={(e) => setAssignName(e.target.value)}
              placeholder="Nhập tên kỹ thuật viên..."
              className="input-field flex-1"
            />
            <button
              onClick={handleAssign}
              disabled={!assignName.trim() || assigning}
              className="btn-primary shrink-0"
            >
              {assigning ? '...' : 'Giao'}
            </button>
          </div>
        </div>
        <button
          onClick={() => { onClose(); }}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Báo cáo sự cố
        </button>
      </div>
    </Modal>
  )
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default function InfraPage() {
  const [systems, setSystems] = useState<(InfraSystem & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHvac, setSelectedHvac] = useState<HvacUnit | null>(null)
  const [selectedLift, setSelectedLift] = useState<LiftUnit | null>(null)
  const [selectedTile, setSelectedTile] = useState<SystemTileData | null>(null)

  const [hvacReadings, setHvacReadings] = useState<Record<string, number>>({})
  const [liftData, setLiftData] = useState<LiftUnit[]>([])
  const [energyData, setEnergyData] = useState<{ day: string; value: number }[]>([])
  const [waterData, setWaterData] = useState<{ day: string; value: number }[]>([])

  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview')
  const [showLogModal, setShowLogModal] = useState(false)
  const [logRefreshKey, setLogRefreshKey] = useState(0)
  const [todayShiftLogged, setTodayShiftLogged] = useState<{ shift: OperationLogShift } | null>(null)

  // Track whether today's current shift has been logged
  useEffect(() => {
    const getShift = (): OperationLogShift => {
      const h = new Date().getHours()
      if (h >= 6 && h < 14) return 'morning'
      if (h >= 14 && h < 22) return 'afternoon'
      return 'night'
    }
    const today = new Date().toISOString().split('T')[0]
    const currentShift = getShift()
    const q = query(
      collection(db, 'operationLogs'),
      where('date', '==', today),
      where('shift', '==', currentShift),
      limit(1),
    )
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setTodayShiftLogged({ shift: currentShift })
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = listenSystemReadings(setSystems)
    const timer = setTimeout(() => setLoading(false), 1200)
    return () => { unsub(); clearTimeout(timer) }
  }, [])

  // HVAC capacity readings from Firestore
  useEffect(() => {
    const q = query(collection(db, 'systemReadings'), where('type', '==', 'hvac'))
    const unsub = onSnapshot(q, (snap) => {
      const readings: Record<string, number> = {}
      snap.docs.forEach((doc) => {
        const d = doc.data()
        readings[doc.id] = d.value ?? 0
      })
      setHvacReadings(readings)
    })
    return () => unsub()
  }, [])

  // Lift data from Firestore
  useEffect(() => {
    const liftQ = query(collection(db, 'systemReadings'), where('type', '==', 'lift'))
    const unsub = onSnapshot(liftQ, (snap) => {
      if (snap.empty) {
        setLiftData([])
      } else {
        setLiftData(snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: data.name ?? d.id,
            floors: data.floors ?? '—',
            trips: data.trips ?? 0,
            status: (data.status as ReadingStatus) ?? 'ok',
          }
        }))
      }
    })
    return () => unsub()
  }, [])

  // 7-day energy and water chart data from Firestore
  useEffect(() => {
    const fetchChartData = async () => {
      const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

      const energySnap = await getDocs(
        query(
          collection(db, 'systemReadings'),
          where('systemId', '==', 'power'),
          where('timestamp', '>=', sevenDaysAgo),
          orderBy('timestamp', 'asc'),
          limit(7),
        )
      )
      if (energySnap.empty) {
        setEnergyData([])
      } else {
        setEnergyData(energySnap.docs.map((d, i) => ({
          day: days[i] ?? `D${i + 1}`,
          value: d.data().value ?? 0,
        })))
      }

      const waterSnap = await getDocs(
        query(
          collection(db, 'systemReadings'),
          where('systemId', '==', 'water'),
          where('timestamp', '>=', sevenDaysAgo),
          orderBy('timestamp', 'asc'),
          limit(7),
        )
      )
      if (waterSnap.empty) {
        setWaterData([])
      } else {
        setWaterData(waterSnap.docs.map((d, i) => ({
          day: days[i] ?? `D${i + 1}`,
          value: d.data().value ?? 0,
        })))
      }
    }
    fetchChartData()
  }, [])

  // Build tile data from Firestore
  const toReadingStatus = (s: InfraSystem): ReadingStatus =>
    s.status === 'online' ? 'ok'
      : s.status === 'warning' ? 'warn'
      : 'crit'

  const tiles: SystemTileData[] = systems
    .filter((s) => ['electrical', 'water', 'o2', 'generator'].includes(s.type))
    .map((s) => {
      const map = SYSTEM_MAP[s.type] || SYSTEM_MAP.electrical
      return {
        key: s.id,
        name: s.name,
        label: map.label,
        icon: map.icon,
        color: map.color,
        status: toReadingStatus(s),
        value: s.lastReading,
        unit: s.unit,
      }
    })

  // HVAC units
  const hvacSystems = systems.filter((s) => s.type === 'hvac')
  const hvacUnits: HvacUnit[] = hvacSystems.map((s) => ({
    id: s.id,
    name: s.name,
    location: s.location,
    status: toReadingStatus(s),
    temp: s.lastReading,
    capacity: hvacReadings[s.id] ?? s.lastReading,
  }))

  // Ensure we have 8 tile slots
  const SYSTEM_DEFS = [
    { key: 'electrical', label: 'Điện hạ thế', icon: Zap, color: 'text-yellow-400' },
    { key: 'water-supply', label: 'Cấp nước', icon: Droplets, color: 'text-blue-400' },
    { key: 'generator', label: 'Máy phát', icon: Power, color: 'text-orange-400' },
    { key: 'hvac-t12', label: 'HVAC T1-2', icon: Wind, color: 'text-cyan-400' },
    { key: 'hvac-t3icu', label: 'HVAC T3-ICU', icon: Wind, color: 'text-cyan-400' },
    { key: 'o2', label: 'Khí Oxy', icon: O2Icon, color: 'text-sky-400' },
    { key: 'wastewater', label: 'Nước thải', icon: Droplets, color: 'text-gray-400' },
    { key: 'fire', label: 'PCCC', icon: Flame, color: 'text-red-400' },
  ]

  // Map system defs to tile data (from Firestore or defaults)
  const tileSlots: SystemTileData[] = SYSTEM_DEFS.map((def) => {
    const found = tiles.find((t) => def.label.toLowerCase().includes(t.label.toLowerCase())
      || t.name.toLowerCase().includes(def.key.replace('-', ' ')))
    if (found) return found
    // Fallback: show def with placeholder data
    return {
      key: def.key,
      name: def.label,
      label: def.label,
      icon: def.icon,
      color: def.color,
      status: 'ok' as ReadingStatus,
      value: 0,
      unit: '',
    }
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48"><div className="card h-full animate-pulse bg-white/[0.06]" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  const critCount = tiles.filter((t) => t.status === 'crit').length
  const warnCount = tiles.filter((t) => t.status === 'warn').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-100">Hạ tầng kỹ thuật</h1>
            <p className="text-sm text-gray-500">Giám sát trạng thái các hệ thống — Cập nhật theo thời gian thực</p>
          </div>
          <div className="flex items-center gap-2">
            {todayShiftLogged ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/15 text-green-400 text-xs font-medium rounded-full border border-green-500/20">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                Ca {todayShiftLogged.shift === 'morning' ? 'sáng' : todayShiftLogged.shift === 'afternoon' ? 'chiều' : 'đêm'} đã ghi
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber/15 text-amber text-xs font-medium rounded-full border border-amber/20 animate-pulse">
                <span className="w-1.5 h-1.5 bg-amber rounded-full" />
                Chưa ghi nhật ký ca này
              </span>
            )}
            <button
              onClick={() => setShowLogModal(true)}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <BookMarked className="w-4 h-4" />
              Ghi nhật ký
            </button>
          </div>
        </div>
      </div>

      {/* Tab group */}
      <div className="flex gap-1 border-b border-white/[0.08]">
        {[
          { key: 'overview', label: 'Tổng quan' },
          { key: 'logs', label: 'Nhật ký vận hành' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'overview' | 'logs')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-amber text-amber'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'logs' ? (
        <OperationLogList refreshKey={logRefreshKey} />
      ) : (
        <>

      {/* Alerts */}
      {(critCount > 0 || warnCount > 0) && (
        <div className="flex gap-2 flex-wrap">
          {critCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-xs font-medium text-red-400">{critCount} nguy hiểm</span>
            </div>
          )}
          {warnCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">{warnCount} cảnh báo</span>
            </div>
          )}
        </div>
      )}

      {/* ROW 1 — System status grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {tileSlots.map((tile) => (
          <button
            key={tile.key}
            onClick={() => setSelectedTile(tile)}
            className="card p-3 border-l-2 text-left hover:bg-white/[0.06] transition-all active:scale-95"
            style={{
              borderLeftColor: tile.status === 'ok' ? '#22c55e' : tile.status === 'warn' ? '#eab308' : '#ef4444',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <tile.icon className={`w-4 h-4 ${tile.color}`} />
              <span className="text-xs text-gray-500 font-medium truncate">{tile.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-lg font-bold text-gray-200 leading-none">
                {tile.value || '—'}
                <span className="text-[10px] font-normal text-gray-600 ml-0.5">{tile.unit}</span>
              </p>
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[tile.status].bg} ${STATUS_DOT[tile.status].pulse || ''}`} />
            </div>
          </button>
        ))}
      </div>

      {/* ROW 2 — HVAC + Lifts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* HVAC */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <Wind className="w-4 h-4 text-cyan-400" />
              HVAC
            </h3>
            <span className="text-xs text-gray-500">{hvacUnits.length} thiết bị</span>
          </div>
          <div className="p-3">
            {hvacUnits.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Không có dữ liệu HVAC</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {hvacUnits.map((u) => (
                  <HvacCard key={u.id} unit={u} onClick={() => setSelectedHvac(u)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lifts */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-400" />
              Thang máy
            </h3>
            <span className="text-xs text-gray-500">{liftData.length} thang</span>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-2 gap-3">
              {liftData.length > 0 ? liftData.map((l) => (
                <LiftCard key={l.id} lift={l} onClick={() => setSelectedLift(l)} />
              )) : (
                <div className="col-span-2 text-center py-6 text-gray-500 text-sm">
                  Chưa có dữ liệu thang máy
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3 — Energy + Water charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EnergyChart data={energyData} />
        <WaterChart data={waterData} />
      </div>
        </>
      )}

      {/* Modals */}
      <HvacDetailModal unit={selectedHvac} open={!!selectedHvac} onClose={() => setSelectedHvac(null)} />
      <LiftDetailModal lift={selectedLift} open={!!selectedLift} onClose={() => setSelectedLift(null)} />
      <SystemDetailModal system={selectedTile} open={!!selectedTile} onClose={() => setSelectedTile(null)} />
      <OperationLogModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSaved={() => setLogRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
