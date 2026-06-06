import { useState, useEffect } from 'react'
import {
  listenEnergyReadings, addEnergyReading,
  listenWaterReadings, addWaterReading,
  listenWaterAlerts,
  listenWasteLog, addWasteLog,
} from '@/firebase/db'
import type { EnergyReading, WaterReading, WaterAlert, WasteLogEntry } from '@/firebase/types'
import { useForm } from 'react-hook-form'
import Modal from '@/components/ui/Modal'
import { TableSkeleton } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from 'recharts'
import { Zap, Droplets, Trash2, Plus, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

type Tab = 'energy' | 'water' | 'waste'

const WASTE_COLORS = ['#ef4444', '#16a34a', '#3b82f6']

function EnergyTab() {
  const [readings, setReadings] = useState<EnergyReading[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { month: new Date().getMonth() + 1, year: new Date().getFullYear(), kwh: 0, carbonKg: 0 },
  })

  useEffect(() => {
    const unsub = listenEnergyReadings(setReadings)
    return () => unsub()
  }, [])

  const onSubmit = async (data: any) => {
    try {
      await addEnergyReading({ month: Number(data.month), year: Number(data.year), kwh: Number(data.kwh), carbonKg: Number(data.carbonKg) })
      toast.success('Đã ghi nhận')
      setShowAdd(false)
      reset()
    } catch { toast.error('Thất bại') }
  }

  const chartData = readings
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .slice(-12)
    .map((r) => ({
      label: `T${r.month}`,
      kwh: r.kwh,
      target: r.targetKwh || r.kwh * 0.95,
      carbon: r.carbonKg,
    }))

  const totalKwh = readings.reduce((s, r) => s + r.kwh, 0)
  const avgKwh = readings.length > 0 ? totalKwh / readings.length : 0
  const totalCarbon = readings.reduce((s, r) => s + r.carbonKg, 0)

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xs text-t3 mb-1">Tổng tiêu thụ</p>
          <p className="text-lg font-bold text-amber">{totalKwh.toLocaleString('vi-VN')}</p>
          <p className="text-[10px] text-t3">kWh</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-t3 mb-1">TB/tháng</p>
          <p className="text-lg font-bold text-yellow-400">{Math.round(avgKwh).toLocaleString('vi-VN')}</p>
          <p className="text-[10px] text-t3">kWh</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-t3 mb-1">Carbon</p>
          <p className="text-lg font-bold text-green-400">{totalCarbon.toLocaleString('vi-VN')}</p>
          <p className="text-[10px] text-t3">kgCO₂</p>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-100 text-sm">Điện tiêu thụ (12 tháng gần nhất)</h3>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs py-1.5">
            <Plus className="w-3.5 h-3.5" /> Ghi nhận
          </button>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}
                formatter={(v, name) => [`${Number(v).toLocaleString('vi-VN')} ${name === 'kwh' ? 'kWh' : 'kWh'}`, name === 'kwh' ? 'Thực tế' : 'Mục tiêu']}
              />
              <ReferenceLine y={chartData[chartData.length - 1]?.target || 0} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Mục tiêu', fontSize: 9, fill: '#f59e0b' }} />
              <Bar dataKey="target" name="target" fill="rgba(245,158,11,0.2)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="kwh" name="kwh" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center text-t3 text-sm">Chưa có dữ liệu</div>
        )}
      </div>

      {/* Recent readings */}
      <div className="space-y-2">
        {readings.slice(0, 6).map((r) => (
          <div key={r.id} className="card p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-100">Tháng {r.month}/{r.year}</p>
              <p className="text-xs text-t3">{r.carbonKg.toLocaleString('vi-VN')} kgCO₂</p>
            </div>
            <span className="text-lg font-bold text-amber">{r.kwh.toLocaleString('vi-VN')} <span className="text-sm font-normal text-t3">kWh</span></span>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset() }} title="Ghi nhận điện năng" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tháng</label>
              <input type="number" min={1} max={12} {...register('month')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Năm</label>
              <input type="number" {...register('year')} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số kWh</label>
            <input type="number" step="0.01" {...register('kwh')} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Carbon (kgCO₂)</label>
            <input type="number" step="0.01" {...register('carbonKg')} className="input-field" />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang lưu...' : 'Lưu'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function WaterTab() {
  const [readings, setReadings] = useState<WaterReading[]>([])
  const [alerts, setAlerts] = useState<WaterAlert[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { month: new Date().getMonth() + 1, year: new Date().getFullYear(), cubicMeters: 0 },
  })

  useEffect(() => {
    const unsub1 = listenWaterReadings(setReadings)
    const unsub2 = listenWaterAlerts(setAlerts)
    return () => { unsub1(); unsub2() }
  }, [])

  const onSubmit = async (data: any) => {
    try {
      await addWaterReading({ month: Number(data.month), year: Number(data.year), cubicMeters: Number(data.cubicMeters) })
      toast.success('Đã ghi nhận')
      setShowAdd(false)
      reset()
    } catch { toast.error('Thất bại') }
  }

  const chartData = readings
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .slice(-12)
    .map((r) => ({
      label: `T${r.month}`,
      m3: r.cubicMeters,
      target: r.targetCubicMeters || r.cubicMeters * 0.95,
    }))

  const unresolvedAlerts = alerts.filter((a) => !a.resolved)

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {unresolvedAlerts.length > 0 && (
        <div className="space-y-2">
          {unresolvedAlerts.map((a) => (
            <div key={a.id} className="card p-3 border border-yellow-500/20 flex items-start gap-3">
              <AlertTriangle className="w-4.5 h-4.5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100">{a.location} — {a.type === 'leak' ? 'Rò rỉ' : a.type === 'high_consumption' ? 'Tiêu thụ cao' : 'Chất lượng'}</p>
                <p className="text-xs text-t3 mt-0.5">{a.description}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                a.severity === 'high' ? 'bg-red-500/15 text-red-400'
                  : a.severity === 'medium' ? 'bg-yellow-500/15 text-yellow-400'
                  : 'bg-white/5 text-t2'
              }`}>
                {a.severity === 'high' ? 'Cao' : a.severity === 'medium' ? 'TB' : 'Thấp'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xs text-t3 mb-1">Tổng tiêu thụ</p>
          <p className="text-lg font-bold text-blue-400">{readings.reduce((s, r) => s + r.cubicMeters, 0).toLocaleString('vi-VN')}</p>
          <p className="text-[10px] text-t3">m³</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-t3 mb-1">Cảnh báo</p>
          <p className="text-lg font-bold text-yellow-400">{unresolvedAlerts.length}</p>
          <p className="text-[10px] text-t3">chưa xử lý</p>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-100 text-sm">Nước tiêu thụ (12 tháng)</h3>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs py-1.5">
            <Plus className="w-3.5 h-3.5" /> Ghi nhận
          </button>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v, name) => [`${Number(v).toLocaleString('vi-VN')} m³`, name === 'm3' ? 'Thực tế' : 'Mục tiêu']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="m3" name="m3" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center text-t3 text-sm">Chưa có dữ liệu</div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset() }} title="Ghi nhận nước" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tháng</label>
              <input type="number" min={1} max={12} {...register('month')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Năm</label>
              <input type="number" {...register('year')} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số m³</label>
            <input type="number" step="0.01" {...register('cubicMeters')} className="input-field" />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang lưu...' : 'Lưu'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function WasteTab() {
  const [logs, setLogs] = useState<WasteLogEntry[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { category: 'general', weightKg: 0, processor: '', certificate: '', notes: '' },
  })

  useEffect(() => {
    const unsub = listenWasteLog(setLogs)
    return () => unsub()
  }, [])

  const onSubmit = async (data: any) => {
    try {
      await addWasteLog({
        category: data.category,
        weightKg: Number(data.weightKg),
        processor: data.processor,
        certificate: data.certificate,
        notes: data.notes,
      })
      toast.success('Đã ghi nhận')
      setShowAdd(false)
      reset()
    } catch { toast.error('Thất bại') }
  }

  const CATEGORY_LABELS: Record<string, string> = {
    medical_hazardous: 'Y tế nguy hại',
    general: 'Thông thường',
    recyclable: 'Tái chế',
  }

  const byCategory = [
    { name: 'Y tế nguy hại', value: logs.filter((l) => l.category === 'medical_hazardous').reduce((s, l) => s + l.weightKg, 0) },
    { name: 'Thông thường', value: logs.filter((l) => l.category === 'general').reduce((s, l) => s + l.weightKg, 0) },
    { name: 'Tái chế', value: logs.filter((l) => l.category === 'recyclable').reduce((s, l) => s + l.weightKg, 0) },
  ]

  const totalWeight = logs.reduce((s, l) => s + l.weightKg, 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Ghi nhận
        </button>
      </div>

      {/* KPI */}
      <div className="card p-4 text-center">
        <p className="text-xs text-t3 mb-1">Tổng khối lượng</p>
        <p className="text-2xl font-bold text-green-400">{totalWeight.toLocaleString('vi-VN')}</p>
        <p className="text-[10px] text-t3">kg · {logs.length} bản ghi</p>
      </div>

      {/* Pie chart */}
      {byCategory.some((c) => c.value > 0) && (
        <div className="card p-4">
          <h3 className="font-semibold text-gray-100 text-sm mb-4">Phân bổ theo loại chất thải</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={byCategory.filter((c) => c.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                dataKey="value"
                nameKey="name"
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {byCategory.map((_, i) => <Cell key={i} fill={WASTE_COLORS[i % WASTE_COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString('vi-VN')} kg`, '']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="table-desktop">
          <thead>
            <tr>
              <th className="text-left">Ngày</th>
              <th className="text-left">Loại</th>
              <th className="text-right hidden sm:table-cell">Khối lượng</th>
              <th className="text-left hidden md:table-cell">Đơn vị xử lý</th>
              <th className="text-left hidden lg:table-cell">Chứng từ</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 20).map((l) => (
              <tr key={l.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-gray-300 text-xs">{l.date ? format(l.date.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${
                    l.category === 'medical_hazardous' ? 'text-red-400'
                      : l.category === 'recyclable' ? 'text-green-400'
                      : 'text-t2'
                  }`}>
                    {CATEGORY_LABELS[l.category] || l.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-400 hidden sm:table-cell">{l.weightKg.toLocaleString('vi-VN')} kg</td>
                <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-xs">{l.processor || '—'}</td>
                <td className="px-4 py-3 text-gray-400 hidden lg:table-cell text-xs font-mono">{l.certificate || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-t3 text-sm">Chưa có dữ liệu rác thải</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset() }} title="Ghi nhận rác thải" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại chất thải</label>
            <select {...register('category')} className="input-field">
              <option value="general">Thông thường</option>
              <option value="medical_hazardous">Y tế nguy hại</option>
              <option value="recyclable">Tái chế</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Khối lượng (kg)</label>
            <input type="number" step="0.01" {...register('weightKg')} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị xử lý</label>
            <input {...register('processor')} className="input-field" placeholder="VD: Công ty TNHH..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số chứng từ</label>
            <input {...register('certificate')} className="input-field" placeholder="VD: CT-2024-001..." />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang lưu...' : 'Lưu'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

export default function EnvironmentPage() {
  const [tab, setTab] = useState<Tab>('energy')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800)
    return () => { clearTimeout(timer) }
  }, [])

  if (loading) return <div className="space-y-4"><TableSkeleton rows={6} /></div>

  const TABS: { key: Tab; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'energy', label: 'Năng lượng', icon: Zap, color: 'text-yellow-400' },
    { key: 'water', label: 'Nước', icon: Droplets, color: 'text-blue-400' },
    { key: 'waste', label: 'Chất thải', icon: Trash2, color: 'text-green-400' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Môi trường</h1>
        <p className="text-sm text-gray-500">Giám sát năng lượng, nước, chất thải</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-t2 hover:text-gray-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${tab === t.key ? t.color : ''}`} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'energy' && <EnergyTab />}
      {tab === 'water' && <WaterTab />}
      {tab === 'waste' && <WasteTab />}
    </div>
  )
}
