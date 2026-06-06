import { useState, useEffect } from 'react'
import { listenReports, listenWorkOrders, listenIncidents } from '@/firebase/db'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Report, WorkOrder, Incident } from '@/firebase/types'
import type { TechnicianKpi } from '@/types/firestore'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line, ReferenceLine,
} from 'recharts'
import { TableSkeleton } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { KpiDetailPanel } from '@/components/kpi/KpiDetailPanel'
import {
  TrendingUp, Printer, Download, CheckCircle, AlertTriangle,
  Activity, BarChart3, PieChart as PieChartIcon, Users,
} from 'lucide-react'

type Tab = 'month' | 'quarter' | 'year'

const COLORS = ['#f59e0b', '#3b82f6', '#16a34a', '#ef4444', '#8b5cf6', '#06b6d4']

const GRADE_CHART_COLOR: Record<string, string> = {
  A: '#16a34a',
  B: '#0d9488',
  C: '#d97706',
  D: '#ea580c',
  F: '#dc2626',
}

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

function exportKpiToExcel(kpis: TechnicianKpi[]) {
  try {
    const BOM = '﻿'
    const header = [
      'STT', 'Nhân viên', 'Phòng ban', 'Điểm KPI', 'Xếp loại',
      'Xu hướng', 'WO Giao', 'WO Hoàn thành', 'Tỷ lệ WO%',
      'Đúng hạn', 'TG PH (phút)', 'PM Lịch', 'PM Hoàn thành',
      'Tổng sự cố', 'Tái phát', 'Tái phát%',
    ]
    const rows = kpis.map((k, i) => [
      i + 1, k.name, k.department || k.role, k.score, k.grade,
      k.trend, k.woStats.totalAssigned, k.woStats.totalCompleted,
      k.woStats.completionRate, k.woStats.onTimeRate,
      k.responseStats.avgResponseMinutes, k.pmStats.pmScheduled,
      k.pmStats.pmCompleted, k.incidentStats.totalIncidentsReported,
      k.incidentStats.recurringIncidents, k.incidentStats.recurringRate,
    ])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `KPI-nhan-vien-${new Date().toISOString().slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Đã xuất KPI nhân viên')
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
      wo.createdAt ? new Date((wo.createdAt as any).toDate()).toLocaleDateString('vi-VN') : '',
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
  const [tab, setTab] = useState<Tab>('month')
  const [reports, setReports] = useState<Report[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [kpis, setKpis] = useState<TechnicianKpi[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKpi, setSelectedKpi] = useState<TechnicianKpi | null>(null)

  useEffect(() => {
    const unsub1 = listenReports(setReports)
    const unsub2 = listenWorkOrders(setWorkOrders)
    const unsub3 = listenIncidents(setIncidents)
    const timer = setTimeout(() => setLoading(false), 800)
    return () => { unsub1(); unsub2(); unsub3(); clearTimeout(timer) }
  }, [])

  // Subscribe to technician KPIs
  useEffect(() => {
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const unsub = onSnapshot(
      query(collection(db, 'technicianKpi'), where('period', '==', period)),
      (snap) => {
        setKpis(snap.docs.map((d) => d.data() as TechnicianKpi))
      },
    )
    return unsub
  }, [])

  if (loading) return <div className="space-y-4"><TableSkeleton rows={8} /></div>

  const latest = reports[0]
  const today = new Date()
  const year = latest?.year || today.getFullYear()
  const month = latest?.month || `${today.getMonth() + 1}`

  // Aggregate data for charts
  const costCategories = latest ? [
    { name: 'Vật tư', value: latest.costs.maintenance || 0 },
    { name: 'TTBYT', value: latest.costs.medicalDevices || 0 },
    { name: 'Dịch vụ', value: latest.costs.maintenance || 0 },
    { name: 'XD', value: latest.costs.civilWorks || 0 },
    { name: 'Khác', value: latest.costs.other || 0 },
  ].filter((c) => c.value > 0) : []

  const totalCost = latest ? Object.values(latest.costs).reduce((s, v) => s + (v || 0), 0) : 0

  // Work order analytics
  const woByCategory = workOrders.reduce<Record<string, number>>((acc, wo) => {
    acc[wo.system] = (acc[wo.system] || 0) + 1
    return acc
  }, {})
  const pieData = Object.entries(woByCategory).map(([name, value]) => ({ name, value }))

  const woByMonth: Record<string, { open: number; closed: number }> = {}
  workOrders.forEach((wo) => {
    const d = wo.createdAt ? new Date((wo.createdAt as any).toDate()) : new Date()
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

  // System uptime from incidents
  const systems = ['HVAC', 'Điện', 'Nước', 'O2', 'Internet', 'PCCC']
  const uptimeData = systems.map((sys) => {
    const sysIncidents = incidents.filter((i) => i.location?.toLowerCase().includes(sys.toLowerCase()))
    const recentIncidents = sysIncidents.filter((i) => {
      if (!i.createdAt) return false
      const d = (i.createdAt as any).toDate()
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
    })
    const mttr = recentIncidents.length > 0 ? (recentIncidents.reduce((s, i) => {
      if (!i.createdAt || !i.resolvedAt) return s
      return s + ((i.resolvedAt as any).toDate().getTime() - (i.createdAt as any).toDate().getTime()) / 3_600_000
    }, 0) / recentIncidents.length) : 0
    const uptime = recentIncidents.length > 0
      ? Math.max(99, Math.min(100, 100 - recentIncidents.length * 0.1))
      : 100
    return { system: sys, uptime: Number(uptime.toFixed(2)), incidents: recentIncidents.length, mttr: Number(mttr.toFixed(1)) }
  })

  // Team KPI summary
  const avgScore = kpis.length > 0 ? Math.round(kpis.reduce((s, k) => s + k.score, 0) / kpis.length) : 0
  const avgWoComp = kpis.length > 0 ? Math.round(kpis.reduce((s, k) => s + k.woStats.completionRate, 0) / kpis.length) : 0
  const avgResp = kpis.length > 0 ? Math.round(kpis.reduce((s, k) => s + k.responseStats.avgResponseMinutes, 0) / kpis.length) : 0
  const avgPmRate = kpis.length > 0 ? Math.round(kpis.reduce((s, k) => s + k.pmStats.pmCompletionRate, 0) / kpis.length) : 0

  // KPI bar chart data
  const scoreChartData = [...kpis]
    .sort((a, b) => b.score - a.score)
    .map((k) => ({
      name: k.name.split(' ').slice(-1)[0] || k.name,
      score: k.score,
      grade: k.grade,
      color: GRADE_CHART_COLOR[k.grade] ?? '#dc2626',
    }))

  const kpiData = latest ? [
    { label: 'Uptime hệ thống kỹ thuật', actual: latest.kpis.uptime, target: 99 },
    { label: 'TTBYT hoạt động đúng hẹn', actual: latest.kpis.deviceOnTime || 98, target: 98 },
    { label: 'Work orders hoàn thành đúng hạn', actual: latest.kpis.workOrderOnTime || 95, target: 95 },
    { label: 'Độ chính xác tồn kho', actual: latest.kpis.inventoryAccuracy || 99, target: 99 },
    { label: 'PCCC không có sự cố', actual: latest.kpis.fireIncidents || 100, target: 100 },
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
          {kpis.length > 0 && (
            <button
              onClick={() => exportKpiToExcel(kpis)}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" /> Xuất KPI nhân viên
            </button>
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
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 max-w-xs">
        {([
          { key: 'month' as Tab, label: 'Tháng' },
          { key: 'quarter' as Tab, label: 'Quý' },
          { key: 'year' as Tab, label: 'Năm' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-t2 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {latest ? (
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
              <span className="text-t2">Sự cố tháng này</span>
              <span className="font-semibold text-red-400">{incidents.length} sự cố</span>
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
              <h3 className="font-semibold text-gray-100 text-sm mb-4">Xu hướng Work Orders (6 tháng gần nhất)</h3>
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

      {/* ── KPI Staff section ── */}
      {kpis.length > 0 && (
        <>
          {/* Team summary */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-100 text-sm mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber" />
              Hiệu suất nhân viên kỹ thuật
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'TB WO hoàn thành', value: `${avgWoComp}%`, color: 'text-amber' },
                { label: 'TB TG phản hồi', value: avgResp > 0 ? `${avgResp} phút` : '—', color: 'text-blue-400' },
                { label: 'TB PM hoàn thành', value: `${avgPmRate}%`, color: 'text-green-400' },
                { label: 'Điểm trung bình', value: `${avgScore}`, color: 'text-purple-400' },
              ].map((s) => (
                <div key={s.label} className="bg-white/[0.04] rounded-xl p-3 text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-t3 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Score bar chart */}
            {scoreChartData.length > 0 && (
              <div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={scoreChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v) => [`${v} điểm`, 'KPI']}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      labelFormatter={(l) => scoreChartData.find((d) => d.name === l)?.name ?? l}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {scoreChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                    {/* B grade threshold line at 75 */}
                    <ReferenceLine y={75} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" label={{ value: 'B', position: 'right', fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Detailed staff table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <h3 className="font-semibold text-gray-100 text-sm">Bảng điểm chi tiết</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table-desktop text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-white/[0.07]">
                    <th className="text-left">Nhân viên</th>
                    <th className="text-left hidden md:table-cell">Phòng ban</th>
                    <th className="text-right">WO%</th>
                    <th className="text-right hidden sm:table-cell">Đúng hạn%</th>
                    <th className="text-right hidden lg:table-cell">TG PH</th>
                    <th className="text-right hidden lg:table-cell">PM%</th>
                    <th className="text-right hidden xl:table-cell">Tái phát%</th>
                    <th className="text-right">Điểm</th>
                    <th className="text-center">Xếp loại</th>
                    <th className="text-left">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {kpis.map((kpi) => {
                    const gradeColor: Record<string, string> = {
                      A: 'text-green-400', B: 'text-teal-400', C: 'text-amber', D: 'text-orange-500', F: 'text-red-400',
                    }
                    const rowBg = kpi.score >= 90 ? 'bg-green-500/5' : kpi.score < 60 ? 'bg-red-500/5' : ''
                    return (
                      <tr key={kpi.uid} className={`hover:bg-white/[0.03] ${rowBg}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-100">{kpi.name}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{kpi.department || kpi.role}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{kpi.woStats.completionRate}%</td>
                        <td className="px-4 py-3 text-right text-gray-400 hidden sm:table-cell">{kpi.woStats.onTimeRate}%</td>
                        <td className="px-4 py-3 text-right text-gray-400 hidden lg:table-cell">
                          {kpi.responseStats.avgResponseMinutes > 0 ? `${kpi.responseStats.avgResponseMinutes}m` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400 hidden lg:table-cell">{kpi.pmStats.pmCompletionRate}%</td>
                        <td className="px-4 py-3 text-right hidden xl:table-cell">
                          <span className={kpi.incidentStats.recurringRate > 20 ? 'text-red-400' : 'text-gray-400'}>
                            {kpi.incidentStats.recurringRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-100">{kpi.score}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${gradeColor[kpi.grade] ?? 'text-gray-400'}`}>{kpi.grade}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedKpi(kpi)}
                            className="btn-secondary text-xs"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedKpi && (
        <KpiDetailPanel kpi={selectedKpi} onClose={() => setSelectedKpi(null)} />
      )}
    </div>
  )
}
