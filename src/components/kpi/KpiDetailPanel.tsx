import { useState, useEffect } from 'react'
import type { TechnicianKpi, WorkOrder, Incident } from '@/types/firestore'
import { KpiScoreCard } from './KpiScoreCard'
import { getScoreBreakdown } from '@/utils/kpiEngine'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import {
  X,
  Wrench,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

type Tab = 'summary' | 'workOrders' | 'incidents' | 'history'

interface KpiDetailPanelProps {
  kpi: TechnicianKpi
  onClose: () => void
}

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'summary', label: 'Tổng quan', icon: TrendingUp },
  { key: 'workOrders', label: 'Work Orders', icon: Wrench },
  { key: 'incidents', label: 'Sự cố', icon: AlertTriangle },
  { key: 'history', label: 'Lịch sử', icon: TrendingUp },
]

// ─── Score breakdown ────────────────────────────────────────────────────────────

function ScoreBreakdownTable({ kpi }: { kpi: TechnicianKpi }) {
  const rows = getScoreBreakdown(kpi)
  const total = rows[rows.length - 1]

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Chi tiết điểm KPI
      </h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-white/[0.07]">
            <th className="text-left pb-2 font-medium">Hạng mục</th>
            <th className="text-right pb-2 font-medium">Tối đa</th>
            <th className="text-right pb-2 font-medium">Đạt được</th>
            <th className="text-right pb-2 font-medium">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {rows.slice(0, -1).map((row) => {
            const color =
              row.pct >= 75 ? 'text-green-400' : row.pct >= 50 ? 'text-amber' : 'text-red-400'
            return (
              <tr key={row.label}>
                <td className="py-2 pr-4 text-gray-300">{row.label}</td>
                <td className="py-2 text-right text-gray-500">{row.max}</td>
                <td className={`py-2 text-right font-semibold ${color}`}>{row.points}</td>
                <td className={`py-2 text-right ${color}`}>{row.pct}%</td>
              </tr>
            )
          })}
          <tr className="font-bold">
            <td className="py-2 pr-4 text-gray-100">{total.label}</td>
            <td className="py-2 text-right text-gray-400">{total.max}</td>
            <td className="py-2 text-right text-gray-100">{total.points}</td>
            <td className="py-2 text-right text-gray-100">{total.pct}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Suggestions ────────────────────────────────────────────────────────────────

function ImprovementSuggestions({ kpi }: { kpi: TechnicianKpi }) {
  const suggestions: string[] = []
  if (kpi.woStats.completionRate < 80)
    suggestions.push(
      '💡 Tỷ lệ hoàn thành WO còn thấp. Kiểm tra WO tồn đọng và phân bổ thời gian.',
    )
  if (kpi.responseStats.avgResponseMinutes > 120)
    suggestions.push(
      '💡 Thời gian phản hồi trung bình cao. Cân nhắc bật thông báo push cho WO mới.',
    )
  if (kpi.incidentStats.recurringRate > 20)
    suggestions.push(
      '💡 Tỷ lệ sự cố tái phát cao. Xem xét nguyên nhân gốc rễ (root cause analysis).',
    )
  if (kpi.pmStats.pmCompletionRate < 80 && kpi.pmStats.pmScheduled > 0)
    suggestions.push(
      '💡 Tỷ lệ hoàn thành BT phòng ngừa thấp. Ưu tiên lịch bảo trì định kỳ.',
    )

  if (suggestions.length === 0) return null

  return (
    <div className="space-y-2 mt-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Gợi ý cải thiện
      </h4>
      {suggestions.map((s, i) => (
        <div key={i} className="bg-amber/8 border border-amber/20 rounded-lg p-3">
          <p className="text-xs text-amber/90 leading-relaxed">{s}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Work Orders tab ──────────────────────────────────────────────────────────

function WorkOrdersTab({ kpi }: { kpi: TechnicianKpi }) {
  const [wos, setWos] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const [year, month] = kpi.period.split('-').map(Number)
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)
    const startTs = Timestamp.fromDate(start)
    const endTs = Timestamp.fromDate(end)

    setLoading(true)
    getDocs(
      query(
        collection(db, 'workOrders'),
        where('assignedTo', '==', kpi.uid),
        where('createdAt', '>=', startTs),
        where('createdAt', '<=', endTs),
        orderBy('createdAt', 'desc'),
      ),
    ).then((snap) => {
      setWos(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt as Timestamp | undefined,
            completedAt: data.completedAt as Timestamp | undefined,
            dueDate: data.dueDate as Timestamp | undefined,
            startedAt: data.startedAt as Timestamp | undefined,
          } as unknown as WorkOrder
        }),
      )
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [kpi.uid, kpi.period])

  // Mini stats
  const total = wos.length
  const completed = wos.filter((wo) => wo.status === 'completed').length
  const inProgress = wos.filter((wo) => wo.status === 'in_progress').length
  const overdue = wos.filter(
    (wo) =>
      wo.status !== 'completed' &&
      wo.status !== 'cancelled' &&
      wo.dueDate &&
      (wo.dueDate as Timestamp).toMillis() < Date.now(),
  ).length

  // Response time chart data
  const responseData = wos
    .filter((wo) => wo.startedAt && wo.createdAt)
    .map((wo) => {
      const mins = ((wo.startedAt as Timestamp).toMillis() - (wo.createdAt as Timestamp).toMillis()) / 60_000
      return {
        id: wo.id.slice(-6),
        minutes: Math.round(mins),
        label: wo.title.slice(0, 20),
      }
    })
    .slice(0, 15)

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'badge-warning',
      in_progress: 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-gray',
    }
    return map[s] ?? 'badge-gray'
  }

  const statusLabel: Record<string, string> = {
    pending: 'Chờ',
    in_progress: 'Đang làm',
    completed: 'Hoàn thành',
    cancelled: 'Hủy',
  }

  return (
    <div className="space-y-4">
      {/* Mini stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Tổng giao', value: total },
          { label: 'Hoàn thành', value: completed, color: 'text-green-400' },
          { label: 'Đang làm', value: inProgress, color: 'text-blue-400' },
          { label: 'Quá hạn', value: overdue, color: overdue > 0 ? 'text-red-400' : 'text-gray-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.04] rounded-lg p-2 text-center">
            <p className={`text-lg font-bold ${stat.color ?? 'text-gray-100'}`}>{stat.value}</p>
            <p className="text-[10px] text-t3">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Response time chart */}
      {responseData.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Thời gian phản hồi WO
          </h4>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {responseData.map((item) => {
              const barPct = Math.min(100, (item.minutes / 240) * 100)
              const color = item.minutes <= 60 ? '#16a34a' : item.minutes <= 120 ? '#d97706' : '#dc2626'
              return (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-t3 w-16 shrink-0 truncate">{item.label}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${barPct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 w-14 text-right shrink-0">
                    {item.minutes}m
                  </span>
                </div>
              )
            })}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-t3 w-16" />
              <div className="flex-1 h-px bg-dashed border-t border-white/10 relative">
                <span className="absolute right-0 top-[-8px] text-[9px] text-gray-500">60m</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WO list */}
      {loading ? (
        <div className="text-center py-8 text-t3 text-sm">Đang tải...</div>
      ) : wos.length === 0 ? (
        <div className="text-center py-8 text-t3 text-sm">Không có work orders</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-white/[0.07]">
                <th className="text-left pb-2 font-medium">ID</th>
                <th className="text-left pb-2 font-medium">Tiêu đề</th>
                <th className="text-left pb-2 font-medium hidden sm:table-cell">Hạn</th>
                <th className="text-left pb-2 font-medium hidden md:table-cell">Hoàn thành</th>
                <th className="text-center pb-2 font-medium">Đúng hạn</th>
                <th className="text-right pb-2 font-medium hidden lg:table-cell">TG xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {wos.map((wo) => {
                const isOnTime =
                  wo.status === 'completed' &&
                  wo.completedAt &&
                  wo.dueDate &&
                  (wo.completedAt as Timestamp).toMillis() <= (wo.dueDate as Timestamp).toMillis()
                const handleHours =
                  wo.completedAt && wo.createdAt
                    ? Math.round(
                        ((wo.completedAt as Timestamp).toMillis() -
                          (wo.createdAt as Timestamp).toMillis()) /
                          3_600_000,
                      )
                    : null
                return (
                  <tr key={wo.id} className="hover:bg-white/[0.03]">
                    <td className="py-2 text-t3 font-mono">{wo.id.slice(-6)}</td>
                    <td className="py-2">
                      <span className="text-gray-200 truncate max-w-[140px] block">{wo.title}</span>
                      <span className={`badge mt-0.5 ${statusBadge(wo.status)}`}>
                        {statusLabel[wo.status] ?? wo.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400 hidden sm:table-cell">
                      {wo.dueDate
                        ? (wo.dueDate as Timestamp).toDate().toLocaleDateString('vi-VN')
                        : '—'}
                    </td>
                    <td className="py-2 text-gray-400 hidden md:table-cell">
                      {wo.completedAt
                        ? (wo.completedAt as Timestamp).toDate().toLocaleDateString('vi-VN')
                        : '—'}
                    </td>
                    <td className="py-2 text-center">
                      {wo.status === 'completed' ? (
                        isOnTime ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 text-right text-gray-400 hidden lg:table-cell">
                      {handleHours !== null ? `${handleHours}h` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Incidents tab ─────────────────────────────────────────────────────────────

function IncidentsTab({ kpi }: { kpi: TechnicianKpi }) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const [year, month] = kpi.period.split('-').map(Number)
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)

    setLoading(true)
    getDocs(
      query(
        collection(db, 'incidents'),
        where('reportedBy', '==', kpi.uid),
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<=', Timestamp.fromDate(end)),
        orderBy('createdAt', 'desc'),
      ),
    ).then((snap) => {
      setIncidents(
        snap.docs.map((d) => {
          const data = d.data()
          return { id: d.id, ...data, createdAt: data.createdAt as Timestamp | undefined } as Incident
        }),
      )
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [kpi.uid, kpi.period])

  const severityColor: Record<string, string> = {
    low: 'badge-gray',
    medium: 'badge-info',
    high: 'badge-warning',
    critical: 'badge-danger',
  }
  const severityLabel: Record<string, string> = {
    low: 'Nhẹ',
    medium: 'TB',
    high: 'Nghiêm trọng',
    critical: 'Khẩn cấp',
  }

  // Recurring group analysis
  const recurringGroups = incidents.reduce<Record<string, { location: string; category: string; count: number }[]>>(
    (acc, inc) => {
      const key = `${inc.location}-${inc.category ?? ''}`
      if (!acc[key]) acc[key] = []
      acc[key].push({ location: inc.location, category: inc.category ?? '', count: 0 })
      const group = acc[key]
      group[group.length - 1].count = incidents.filter(
        (i) => i.location === inc.location && (i.category ?? '') === (inc.category ?? ''),
      ).length
      return acc
    },
    {},
  )
  const uniqueGroups = Object.values(recurringGroups)
    .map((g) => g[0])
    .filter((g) => g.count > 1)

  return (
    <div className="space-y-4">
      {/* Incident list */}
      {loading ? (
        <div className="text-center py-8 text-t3 text-sm">Đang tải...</div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-8 text-t3 text-sm">Không có sự cố</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-white/[0.07]">
                <th className="text-left pb-2 font-medium">Tiêu đề</th>
                <th className="text-left pb-2 font-medium hidden sm:table-cell">Loại</th>
                <th className="text-left pb-2 font-medium hidden md:table-cell">Vị trí</th>
                <th className="text-left pb-2 font-medium">Ngày</th>
                <th className="text-center pb-2 font-medium">Mức độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-white/[0.03]">
                  <td className="py-2 text-gray-200">{inc.title}</td>
                  <td className="py-2 text-gray-400 hidden sm:table-cell">{inc.category}</td>
                  <td className="py-2 text-gray-400 hidden md:table-cell">{inc.location}</td>
                  <td className="py-2 text-gray-400">
                    {inc.createdAt ? inc.createdAt.toDate().toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="py-2 text-center">
                    <span className={`badge ${severityColor[inc.severity] ?? 'badge-gray'}`}>
                      {severityLabel[inc.severity] ?? inc.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recurring analysis */}
      {uniqueGroups.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Phân tích sự cố tái phát
          </h4>
          <div className="space-y-1.5">
            {uniqueGroups.map((group) => (
              <div
                key={`${group.location}-${group.category}`}
                className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-xs text-gray-200">
                  <span className="font-medium">{group.location}</span>
                  {' — '}
                  <span>{group.category}</span>
                </span>
                <span className="ml-auto text-xs font-semibold text-red-400">
                  {group.count} lần trong 30 ngày
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({ kpi }: { kpi: TechnicianKpi }) {
  const [history, setHistory] = useState<TechnicianKpi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getDocs(
      query(
        collection(db, 'kpiHistory', kpi.uid, 'months'),
        orderBy('period', 'desc'),
      ),
    )
      .then((snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data()
          return { ...data, calculatedAt: data.calculatedAt as Timestamp | undefined } as TechnicianKpi
        })
        // Include current period if not in history
        const hasCurrent = docs.some((d) => d.period === kpi.period)
        setHistory(hasCurrent ? docs : [kpi, ...docs])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [kpi.uid, kpi.period])

  const gradeColor: Record<string, string> = {
    A: 'text-green-400',
    B: 'text-teal-400',
    C: 'text-amber',
    D: 'text-orange-500',
    F: 'text-red-400',
  }

  const displayed = history.slice(0, 6)

  // Trend line data
  const trendData = [...displayed].reverse().map((h) => ({
    period: h.period.slice(5),
    score: h.score,
    grade: h.grade,
  }))

  return (
    <div className="space-y-4">
      {/* Score trend */}
      {trendData.length > 1 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Xu hướng điểm KPI
          </h4>
          <div className="flex items-end gap-1 h-24">
            {trendData.map((d) => {
              const max = 100
              const heightPct = (d.score / max) * 100
              return (
                <div key={d.period} className="flex-1 flex flex-col items-center gap-1">
                  <div className="relative w-full flex items-end justify-center" style={{ height: 72 }}>
                    <div
                      className={`w-full rounded-t-sm transition-all ${gradeColor[d.grade]?.replace('text-', 'bg-') ?? 'bg-gray-500'}`}
                      style={{ height: `${heightPct}%` }}
                      title={`${d.score} điểm`}
                    />
                    <span className="absolute -bottom-4 text-[9px] text-t3">{d.period}</span>
                  </div>
                  <span className={`text-xs font-bold ${gradeColor[d.grade] ?? 'text-gray-400'}`}>
                    {d.score}
                  </span>
                </div>
              )
            })}
          </div>
          {/* Grade threshold lines */}
          <div className="flex justify-between text-[9px] text-t3 mt-2 border-t border-white/[0.05] pt-1">
            <span className="text-green-400">A: 90</span>
            <span className="text-teal-400">B: 75</span>
            <span className="text-amber">C: 60</span>
            <span className="text-orange-500">D: 45</span>
            <span className="text-red-400">F: &lt;45</span>
          </div>
        </div>
      )}

      {/* History table */}
      {loading ? (
        <div className="text-center py-8 text-t3 text-sm">Đang tải...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-white/[0.07]">
                <th className="text-left pb-2 font-medium">Tháng</th>
                <th className="text-right pb-2 font-medium hidden sm:table-cell">WO%</th>
                <th className="text-right pb-2 font-medium hidden sm:table-cell">Đúng hạn%</th>
                <th className="text-right pb-2 font-medium hidden md:table-cell">TG PH</th>
                <th className="text-right pb-2 font-medium hidden lg:table-cell">PM%</th>
                <th className="text-right pb-2 font-medium hidden lg:table-cell">Tái phát%</th>
                <th className="text-right pb-2 font-medium">Điểm</th>
                <th className="text-center pb-2 font-medium">Xếp loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {displayed.map((h) => (
                <tr key={h.period} className="hover:bg-white/[0.03]">
                  <td className="py-2 text-gray-300">{h.period}</td>
                  <td className="py-2 text-right text-gray-400 hidden sm:table-cell">
                    {h.woStats.completionRate}%
                  </td>
                  <td className="py-2 text-right text-gray-400 hidden sm:table-cell">
                    {h.woStats.onTimeRate}%
                  </td>
                  <td className="py-2 text-right text-gray-400 hidden md:table-cell">
                    {h.responseStats.avgResponseMinutes > 0 ? `${h.responseStats.avgResponseMinutes}m` : '—'}
                  </td>
                  <td className="py-2 text-right text-gray-400 hidden lg:table-cell">
                    {h.pmStats.pmCompletionRate}%
                  </td>
                  <td className="py-2 text-right text-gray-400 hidden lg:table-cell">
                    {h.incidentStats.recurringRate}%
                  </td>
                  <td className="py-2 text-right font-semibold text-gray-100">{h.score}</td>
                  <td className="py-2 text-center">
                    <span className={`font-bold ${gradeColor[h.grade] ?? 'text-gray-400'}`}>
                      {h.grade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export function KpiDetailPanel({ kpi, onClose }: KpiDetailPanelProps) {
  const [tab, setTab] = useState<Tab>('summary')

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-ink-2 rounded-l-2xl shadow-xl flex flex-col animate-slide-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
          <h3 className="font-semibold text-gray-100">Chi tiết KPI</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-t2 hover:text-gray-200 hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-2 border-b border-white/[0.07] shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.key
                  ? 'bg-amber/15 text-amber'
                  : 'text-t2 hover:text-gray-200 hover:bg-white/[0.05]'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'summary' && (
            <div className="space-y-4">
              <KpiScoreCard kpi={kpi} />
              <ScoreBreakdownTable kpi={kpi} />
              <ImprovementSuggestions kpi={kpi} />
            </div>
          )}
          {tab === 'workOrders' && <WorkOrdersTab kpi={kpi} />}
          {tab === 'incidents' && <IncidentsTab kpi={kpi} />}
          {tab === 'history' && <HistoryTab kpi={kpi} />}
        </div>
      </div>
    </div>
  )
}
