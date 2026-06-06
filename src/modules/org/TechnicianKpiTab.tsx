import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { computeAllTechnicianKpi, getCurrentPeriod, getPeriodLabel } from '@/utils/kpiEngine'
import type { TechnicianKpi } from '@/types/firestore'
import { KpiScoreCard } from '@/components/kpi/KpiScoreCard'
import { KpiDetailPanel } from '@/components/kpi/KpiDetailPanel'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { RefreshCw, Trophy, Medal } from 'lucide-react'

const RANK_COLORS = ['bg-yellow-500/20 border border-yellow-500/30', 'bg-gray-400/15 border border-gray-400/25', 'bg-orange-600/15 border border-orange-600/25']

const GRADE_LABEL: Record<string, string> = {
  A: 'Xuất sắc',
  B: 'Tốt',
  C: 'Trung bình',
  D: 'Cần cải thiện',
  F: 'Không đạt',
}

const GRADE_COLOR: Record<string, string> = {
  A: 'text-green-400',
  B: 'text-teal-400',
  C: 'text-amber',
  D: 'text-orange-500',
  F: 'text-red-400',
}

function TeamSummaryBar({ kpis }: { kpis: TechnicianKpi[] }) {
  if (kpis.length === 0) return null
  const avgComp = Math.round(kpis.reduce((s, k) => s + k.woStats.completionRate, 0) / kpis.length)
  const avgResp = Math.round(kpis.reduce((s, k) => s + k.responseStats.avgResponseMinutes, 0) / kpis.length)
  const avgPm = Math.round(kpis.reduce((s, k) => s + k.pmStats.pmCompletionRate, 0) / kpis.length)
  const avgScore = Math.round(kpis.reduce((s, k) => s + k.score, 0) / kpis.length)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: 'TB WO hoàn thành', value: `${avgComp}%`, color: 'text-amber' },
        { label: 'TB TG phản hồi', value: avgResp > 0 ? `${avgResp} phút` : '—', color: 'text-blue-400' },
        { label: 'TB PM hoàn thành', value: `${avgPm}%`, color: 'text-green-400' },
        { label: 'Điểm trung bình', value: `${avgScore}`, color: 'text-purple-400' },
      ].map((stat) => (
        <div key={stat.label} className="bg-white/[0.04] rounded-xl p-3 text-center">
          <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          <p className="text-xs text-t3 mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

function MiniBar({ pct, color = 'bg-amber' }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden w-16">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

export default function TechnicianKpiTab() {
  const [kpis, setKpis] = useState<TechnicianKpi[]>([])
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [selectedKpi, setSelectedKpi] = useState<TechnicianKpi | null>(null)
  const { user } = useAuth()
  const isPrivileged = user?.role === 'admin' || user?.role === 'manager'

  useEffect(() => {
    const period = getCurrentPeriod()
    const q = query(
      collection(db, 'technicianKpi'),
      where('period', '==', period),
      orderBy('score', 'desc'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setKpis(
        snap.docs.map((d) => {
          const data = d.data()
          return { ...data, calculatedAt: data.calculatedAt } as TechnicianKpi
        }),
      )
      setLoading(false)
    })
    return unsub
  }, [])

  const handleRefresh = async () => {
    if (!isPrivileged) return
    setComputing(true)
    try {
      await computeAllTechnicianKpi(getCurrentPeriod())
      toast.success('Đã cập nhật KPI')
    } catch {
      toast.error('Cập nhật KPI thất bại')
    } finally {
      setComputing(false)
    }
  }

  const period = getCurrentPeriod()
  const periodLabel = getPeriodLabel(period)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton-line h-6 w-56" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton-line h-16 rounded-xl" />
          ))}
        </div>
        <div className="skeleton-line h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-100">KPI Nhân viên</h3>
          <p className="text-xs text-t3">{periodLabel}</p>
        </div>
        {isPrivileged && (
          <button
            onClick={handleRefresh}
            disabled={computing}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${computing ? 'animate-spin' : ''}`} />
            {computing ? 'Đang tính toán...' : 'Tính lại KPI'}
          </button>
        )}
      </div>

      {/* Team summary */}
      <TeamSummaryBar kpis={kpis} />

      {kpis.length === 0 ? (
        <div className="text-center py-12 text-t2">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-t3" />
          <p className="text-sm">Chưa có dữ liệu KPI cho tháng này</p>
        </div>
      ) : (
        <>
          {/* Desktop: ranking table */}
          <div className="hidden xl:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-desktop text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-white/[0.07]">
                    <th className="text-left w-12">Hạng</th>
                    <th className="text-left">Nhân viên</th>
                    <th className="text-left hidden md:table-cell">Phòng ban</th>
                    <th className="text-right">Điểm</th>
                    <th className="text-left hidden lg:table-cell">Xếp loại</th>
                    <th className="text-left hidden lg:table-cell">WO%</th>
                    <th className="text-left hidden lg:table-cell">Đúng hạn</th>
                    <th className="text-left hidden xl:table-cell">TG PH</th>
                    <th className="text-left hidden xl:table-cell">PM%</th>
                    <th className="text-left">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {kpis.map((kpi, i) => {
                    const rankBg = i < 3 ? RANK_COLORS[i] : ''
                    const gradeColors = GRADE_COLOR[kpi.grade] ?? 'text-gray-400'
                    return (
                      <tr key={kpi.uid} className={`hover:bg-white/[0.03] ${rankBg}`}>
                        <td className="px-3 py-3">
                          {i === 0 ? (
                            <span className="flex items-center gap-1 text-yellow-400 font-bold">
                              <Trophy className="w-4 h-4" /> 1
                            </span>
                          ) : i === 1 ? (
                            <span className="flex items-center gap-1 text-gray-300 font-bold">
                              <Medal className="w-4 h-4" /> 2
                            </span>
                          ) : i === 2 ? (
                            <span className="flex items-center gap-1 text-orange-400 font-bold">
                              <Medal className="w-4 h-4" /> 3
                            </span>
                          ) : (
                            <span className="text-t3 text-sm">{i + 1}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-100">{kpi.name}</p>
                        </td>
                        <td className="px-3 py-3 text-gray-400 hidden md:table-cell">
                          {kpi.department || kpi.role}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-bold ${gradeColors}`}>{kpi.score}</span>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <span className={`text-xs font-semibold ${gradeColors}`}>
                            {kpi.grade}
                          </span>
                          <p className="text-[10px] text-t3">{GRADE_LABEL[kpi.grade]}</p>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <MiniBar pct={kpi.woStats.completionRate} />
                            <span className="text-xs text-gray-400">{kpi.woStats.completionRate}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <MiniBar pct={kpi.woStats.onTimeRate} color="bg-green-500" />
                            <span className="text-xs text-gray-400">{kpi.woStats.onTimeRate}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden xl:table-cell">
                          <span className="text-xs text-gray-400">
                            {kpi.responseStats.avgResponseMinutes > 0
                              ? `${kpi.responseStats.avgResponseMinutes}m`
                              : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 hidden xl:table-cell">
                          <div className="flex items-center gap-2">
                            <MiniBar pct={kpi.pmStats.pmCompletionRate} color="bg-green-500" />
                            <span className="text-xs text-gray-400">{kpi.pmStats.pmCompletionRate}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
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

          {/* Mobile/tablet: KPI cards grid */}
          <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
            {kpis.map((kpi) => (
              <KpiScoreCard
                key={kpi.uid}
                kpi={kpi}
                onClick={() => setSelectedKpi(kpi)}
              />
            ))}
          </div>
        </>
      )}

      {selectedKpi && (
        <KpiDetailPanel kpi={selectedKpi} onClose={() => setSelectedKpi(null)} />
      )}
    </div>
  )
}
