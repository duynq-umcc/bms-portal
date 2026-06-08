import { useState, useEffect } from 'react'
import { listenReports, listenWorkOrders, listenIncidents } from '@/firebase/db'
import type { Report, WorkOrder, Incident } from '@/firebase/types'
import type { TechnicianKpi } from '@/types/firestore'
import { Timestamp } from 'firebase/firestore'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { TableSkeleton } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { KpiDetailPanel } from '@/components/kpi/KpiDetailPanel'
import {
  TrendingUp, Printer, Download, CheckCircle, AlertTriangle,
  Activity, BarChart3, PieChart as PieChartIcon,
  Trophy, FilePlus,
} from 'lucide-react'
import {
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
} from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import BGDReportModal from './components/BGDReportModal'
import { useGetTechnicianKpis, useGetMyKpi } from './hooks/useTechnicianKpis'
import MyKpiCard from './components/MyKpiCard'
import KpiLeaderboard from './components/KpiLeaderboard'

type Tab = 'month' | 'quarter' | 'year' | 'kpi'

const COLORS = ['#f59e0b', '#3b82f6', '#16a34a', '#ef4444', '#8b5cf6', '#06b6d4']

function formatVND(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} triệu`
  return n.toLocaleString('vi-VN')
}

function getKPIColor(actual: number, target: number) {
  if (actual >= target) return 'bg-green-500'
  if (actual >= target - 5) return 'bg-amber'
  return 'bg-red-500'
}

function getKPILabel(actual: number, target: number) {
  if (actual >= target) return 'badge-success'
  if (actual >= target - 5) return 'badge-warning'
  return 'badge-danger'
}

function KPIBar({ label, actual, target }: { label: string; actual: number; target: number }) {
  const pct = Math.min(100, (actual / target) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="w-48 shrink-0 hidden sm:block">
        <p className="text-sm text-gray-300 truncate">{label}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 bg-white/5 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${getKPIColor(actual, target)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-100 w-14 text-right shrink-0">{actual.toFixed(1)}%</span>
          <span className={`badge text-[10px] shrink-0 ${getKPILabel(actual, target)}`}>
            {target}%
          </span>
        </div>
      </div>
    </div>
  )
}

function exportToExcel(report: Report, _workOrders: WorkOrder[], _incidents: Incident[]) {
  try {
    const csv = [
      ['BÁO CÁO KPI', '', '', ''],
      ['', '', '', ''],
      ['CHỈ SỐ KPI', 'Thực tế', 'Mục tiêu', 'Trạng thái'],
      ['Uptime hệ thống kỹ thuật', `${report.kpis.uptime}%`, '99%', report.kpis.uptime >= 99 ? 'Đạt' : 'Chưa đạt'],
      ['TTBYT hoạt động đúng hẹn', `${report.kpis.deviceOnTime || 98}%`, '98%', (report.kpis.deviceOnTime || 98) >= 98 ? 'Đạt' : 'Chưa đạt'],
      ['Work orders hoàn thành đúng hạn', `${report.kpis.workOrderOnTime || 95}%`, '95%', (report.kpis.workOrderOnTime || 95) >= 95 ? 'Đạt' : 'Chưa đạt'],
      ['Độ chính xác tồn kho', `${report.kpis.inventoryAccuracy || 99}%`, '99%', (report.kpis.inventoryAccuracy || 99) >= 99 ? 'Đạt' : 'Chưa đạt'],
      ['PCCC không có sự cố', `${report.kpis.fireIncidents || 100}%`, '100%', (report.kpis.fireIncidents || 100) >= 100 ? 'Đạt' : 'Chưa đạt'],
      ['', '', '', ''],
      ['CHI PHÍ', '', '', ''],
      ['Danh mục', 'Số tiền (VNĐ)', '', ''],
      ['Điện', report.costs.electricity],
      ['Y tế / TTBYT', report.costs.medicalDevices],
      ['Bảo trì', report.costs.maintenance],
      ['Xây dựng', report.costs.civilWorks],
      ['Nước', report.costs.water],
      ['Khác', report.costs.other],
      ['', '', '', ''],
      ['TỔNG CHI PHÍ', Object.values(report.costs).reduce((s: number, v) => s + (v || 0), 0), '', ''],
    ]

    const BOM = '﻿'
    const blob = new Blob([BOM + csv.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Bao-cao-KPI-${report.month}-${report.year}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Đã xuất báo cáo Excel')
  } catch {
    toast.error('Xuất thất bại')
  }
}

function exportWorkOrdersToExcel(workOrders: WorkOrder[]) {
  const csv = [
    ['STT', 'Tiêu đề', 'Mô tả', 'Hệ thống', 'Vị trí', 'Ưu tiên', 'Trạng thái', 'Ngày tạo'],
    ...workOrders.map((wo, i) => [
      i + 1,
      wo.title,
      wo.description,
      wo.system,
      wo.location,
      wo.priority,
      wo.status,
      wo.createdAt ? new Date((wo.createdAt as Timestamp).toDate()).toLocaleDateString('vi-VN') : '',
    ]),
  ]
  const BOM = '﻿'
  const blob = new Blob([BOM + csv.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Danh-sach-WorkOrders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('Đã xuất work orders')
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('month')
  const [kpiPeriod, setKpiPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [reports, setReports] = useState<Report[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKpi, setSelectedKpi] = useState<TechnicianKpi | null>(null)
  const [showBgdModal, setShowBgdModal] = useState(false)

  const { kpis, loading: kpiLoading } = useGetTechnicianKpis(kpiPeriod)
  const { kpi: myKpi, loading: myKpiLoading } = useGetMyKpi(kpiPeriod, user?.uid ?? '')

  const kpiMonthLabel = (() => {
    const [y, m] = kpiPeriod.split('-').map(Number)
    return `${m.toString().padStart(2, '0')}/${y}`
  })()

  useEffect(() => {
    const unsub1 = listenReports(setReports)
    const unsub2 = listenWorkOrders(setWorkOrders)
    const unsub3 = listenIncidents(setIncidents)
    const timer = setTimeout(() => setLoading(false), 800)
    return () => { unsub1(); unsub2(); unsub3(); clearTimeout(timer) }
  }, [])


  if (loading) return <div className="space-y-4"><TableSkeleton rows={8} /></div>

  const latest = reports[0]
  const today = new Date()
  const year = latest?.year || today.getFullYear()
  const month = latest?.month || `${today.getMonth() + 1}`

  // Period boundaries based on active tab
  const periodBounds = (() => {
    const now = today
    if (tab === 'month') return { start: startOfMonth(now), end: endOfMonth(now) }
    if (tab === 'quarter') return { start: startOfQuarter(now), end: endOfQuarter(now) }
    return { start: startOfYear(now), end: endOfYear(now) }
  })()

  const inPeriod = (ts: Timestamp | undefined) => {
    if (!ts) return false
    try {
      const d = ts.toDate()
      return d >= periodBounds.start && d <= periodBounds.end
    } catch { return false }
  }

  // Filter reports and work orders to the active period
  const periodReports = reports.filter((r) => r.createdAt && inPeriod(r.createdAt))
  const periodReport = periodReports[0]
  const periodWos = workOrders.filter((wo) => inPeriod(wo.createdAt))
  const periodIncidents = incidents.filter((i) => inPeriod(i.createdAt))


  // Aggregate data for charts
  const costCategories = latest ? [
    { name: 'Vật tư', value: latest.costs.maintenance || 0 },
    { name: 'TTBYT', value: latest.costs.medicalDevices || 0 },
    { name: 'Dịch vụ', value: latest.costs.maintenance || 0 },
    { name: 'XD', value: latest.costs.civilWorks || 0 },
    { name: 'Khác', value: latest.costs.other || 0 },
  ].filter((c) => c.value > 0) : []

  const totalCost = latest ? Object.values(latest.costs).reduce((s, v) => s + (v || 0), 0) : 0

  // Work order analytics — using period-filtered data
  const woByCategory = periodWos.reduce<Record<string, number>>((acc, wo) => {
    acc[wo.system] = (acc[wo.system] || 0) + 1
    return acc
  }, {})
  const pieData = Object.entries(woByCategory).map(([name, value]) => ({ name, value }))

  const woByMonth: Record<string, { open: number; closed: number }> = {}
  periodWos.forEach((wo) => {
    const d = wo.createdAt ? new Date(wo.createdAt.toDate()) : new Date()
    const key = `${d.getMonth() + 1}/${d.getFullYear()}`
    if (!woByMonth[key]) woByMonth[key] = { open: 0, closed: 0 }
    if (wo.status === 'completed') woByMonth[key].closed++
    else woByMonth[key].open++
  })
  const trendData = Object.entries(woByMonth)
    .sort(([a], [b]) => {
      const [am, ay] = a.split('/').map(Number)
      const [bm, by] = b.split('/').map(Number)
      return ay - by || am - bm
    })
    .slice(-6)
    .map(([label, vals]) => ({ label, ...vals }))

  // System uptime from corrective work orders in period (MTTR = real data)
  const systems = ['HVAC', 'Điện', 'Nước', 'O2', 'Internet', 'PCCC']
  const periodStart = periodBounds.start
  const periodEnd = periodBounds.end
  const totalHours = (periodEnd.getTime() - periodStart.getTime()) / 3_600_000

  const uptimeData = systems.map((sys) => {
    const sysWos = periodWos.filter(
      (wo) =>
        wo.type === 'corrective' &&
        wo.location?.toLowerCase().includes(sys.toLowerCase())
    )
    const closedWos = sysWos.filter((wo) => wo.status === 'completed' && wo.closedAt && wo.createdAt)
    const totalDowntime = closedWos.reduce((s, wo) => {
      try {
        return s + ((wo.closedAt as Timestamp).toDate().getTime() - (wo.createdAt as Timestamp).toDate().getTime())
      } catch { return s }
    }, 0) / 3_600_000
    const mttr = closedWos.length > 0 ? totalDowntime / closedWos.length : 0
    const uptime = totalHours > 0
      ? Math.max(0, Math.min(100, (1 - totalDowntime / totalHours) * 100))
      : 100
    return {
      system: sys,
      uptime: Number(uptime.toFixed(2)),
      incidents: sysWos.length,
      mttr: Number(mttr.toFixed(1)),
    }
  })


  const kpiData = periodReport ? [
    { label: 'Uptime hệ thống kỹ thuật', actual: periodReport.kpis.uptime, target: 99 },
    { label: 'TTBYT hoạt động đúng hẹn', actual: periodReport.kpis.deviceOnTime || 98, target: 98 },
    { label: 'Work orders hoàn thành đúng hạn', actual: periodReport.kpis.workOrderOnTime || 95, target: 95 },
    { label: 'Độ chính xác tồn kho', actual: periodReport.kpis.inventoryAccuracy || 99, target: 99 },
    { label: 'PCCC không có sự cố', actual: periodReport.kpis.fireIncidents || 100, target: 100 },
  ] : []

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-100">Báo cáo KPI</h1>
          <p className="text-sm text-gray-500">
            {latest ? `${latest.month}/${latest.year}` : `${month}/${year}`} · {tab === 'month' ? 'Tháng' : tab === 'quarter' ? 'Quý' : 'Năm'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowBgdModal(true)}
            className="btn-primary flex items-center gap-1.5 text-xs"
          >
            <FilePlus className="w-3.5 h-3.5" /> Lập báo cáo BGĐ
          </button>
          {latest && (
            <>
              <button
                onClick={() => exportToExcel(latest, workOrders, incidents)}
                className="btn-secondary flex items-center gap-1.5 text-xs"
              >
                <Download className="w-3.5 h-3.5" /> Xuất Excel
              </button>
              <button
                onClick={() => window.print()}
                className="btn-secondary flex items-center gap-1.5 text-xs"
              >
                <Printer className="w-3.5 h-3.5" /> In báo cáo
              </button>
            </>
          )}
          <button
            onClick={() => exportWorkOrdersToExcel(workOrders)}
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Work Orders
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 max-w-md">
        {([
          { key: 'month' as Tab, label: 'Tháng' },
          { key: 'quarter' as Tab, label: 'Quý' },
          { key: 'year' as Tab, label: 'Năm' },
          { key: 'kpi' as Tab, label: 'KPI KTV', icon: Trophy },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-t2 hover:text-gray-200'
            }`}
          >
            {t.icon && <t.icon className="w-3.5 h-3.5" />}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── KPI KTV tab ── */}
      {tab === 'kpi' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-100">KPI Kỹ thuật viên</h2>
              <p className="text-xs text-t3">
                {kpiMonthLabel} · {kpis.length} nhân viên
              </p>
            </div>
            {/* Month picker */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const [y, m] = kpiPeriod.split('-').map(Number)
                  const d = new Date(y, m - 2, 1)
                  setKpiPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                }}
                className="btn-secondary text-xs px-2 py-1"
              >
                ← Tháng trước
              </button>
              <span className="flex items-center text-xs text-gray-300 font-medium px-2 py-1 bg-white/5 rounded-lg">
                {kpiMonthLabel}
              </span>
              <button
                onClick={() => {
                  const [y, m] = kpiPeriod.split('-').map(Number)
                  const d = new Date(y, m, 1)
                  setKpiPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                }}
                className="btn-secondary text-xs px-2 py-1"
              >
                Tháng sau →
              </button>
            </div>
          </div>

          {/* My KPI card — full width */}
          <MyKpiCard kpi={myKpi} loading={myKpiLoading} monthLabel={kpiMonthLabel} />

          {/* Leaderboard */}
          <KpiLeaderboard
            kpis={kpis}
            loading={kpiLoading}
            month={kpiPeriod}
            currentUserUid={user?.uid}
            onSelectKpi={setSelectedKpi}
          />
        </div>
      )}

      {tab !== 'kpi' && latest ? (
        <>
          {/* Section 1: KPI Progress Bars */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-100 text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber" />
              Chỉ số KPI — {latest.month}/{latest.year}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
              {kpiData.map((k) => (
                <KPIBar key={k.label} label={k.label} actual={k.actual} target={k.target} />
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.07] flex justify-between text-sm">
              <span className="text-t2">Sự cố kỳ này</span>
              <span className="font-semibold text-red-400">{periodIncidents.length} sự cố</span>
            </div>
          </div>

          {/* Section 2 & 3: Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost breakdown */}
            <div className="card p-4">
              <h3 className="font-semibold text-gray-100 text-sm mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber" />
                Chi phí tháng
              </h3>
              {costCategories.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={costCategories} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatVND(v)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
                      <Tooltip formatter={(v) => [formatVND(v as number), 'Chi phí']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {costCategories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="text-center text-sm font-semibold text-gray-100 mt-2">
                    Tổng: {formatVND(totalCost)}
                  </div>
                </>
              ) : (
                <div className="h-52 flex items-center justify-center text-t3 text-sm">Chưa có dữ liệu chi phí</div>
              )}
            </div>

            {/* Work order by category */}
            <div className="card p-4">
              <h3 className="font-semibold text-gray-100 text-sm mb-4 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-amber" />
                Work orders theo danh mục
              </h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-52 flex items-center justify-center text-t3 text-sm">Chưa có work orders</div>
              )}
            </div>
          </div>

          {/* Work order trend */}
          {trendData.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-gray-100 text-sm mb-4">
                Xu hướng Work Orders {tab === 'month' ? 'tháng' : tab === 'quarter' ? 'quý' : 'năm'} này
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="open" name="Đang mở" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="closed" name="Đã đóng" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Section 4: System uptime */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <h3 className="font-semibold text-gray-100 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber" />
                Tình trạng hệ thống
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table-desktop text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Hệ thống</th>
                    <th className="text-right">Uptime %</th>
                    <th className="text-right">Sự cố</th>
                    <th className="text-right hidden sm:table-cell">MTTR (h)</th>
                    <th className="text-left hidden md:table-cell">vs tháng trước</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {uptimeData.map((row) => (
                    <tr key={row.system} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-gray-100">{row.system}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${row.uptime >= 99 ? 'text-green-400' : row.uptime >= 95 ? 'text-amber' : 'text-red-400'}`}>
                          {row.uptime}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{row.incidents}</td>
                      <td className="px-4 py-3 text-right text-gray-400 hidden sm:table-cell">
                        {row.mttr > 0 ? row.mttr.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="flex items-center gap-1 text-xs">
                          {row.uptime >= 99 ? (
                            <><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Đạt</span></>
                          ) : (
                            <><AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /><span className="text-yellow-400">Cần cải thiện</span></>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-t2">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-t3" />
          <p className="text-sm">Chưa có dữ liệu báo cáo KPI</p>
        </div>
      )}

      {selectedKpi && (
        <KpiDetailPanel kpi={selectedKpi} onClose={() => setSelectedKpi(null)} />
      )}

      <BGDReportModal
        open={showBgdModal}
        onClose={() => setShowBgdModal(false)}
        defaultMonth={month}
        defaultYear={year}
      />
    </div>
  )
}
