import { Download, Trophy, Medal } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Table'
import type { TechnicianKpi } from '@/types/firestore'

const GRADE_COLORS: Record<string, { text: string; badge: string }> = {
  A: { text: 'text-green-400', badge: 'badge-success' },
  B: { text: 'text-teal-400', badge: 'bg-teal-500/15 text-teal-400' },
  C: { text: 'text-amber', badge: 'badge-warning' },
  D: { text: 'text-orange-500', badge: 'bg-orange-500/15 text-orange-500' },
  F: { text: 'text-red-400', badge: 'badge-danger' },
}

const SCORE_LABEL: Record<string, string> = {
  A: 'Xuất sắc',
  B: 'Tốt',
  C: 'Đạt',
  D: 'Cần cải thiện',
  F: 'Không đạt',
}

function exportCsv(kpis: TechnicianKpi[], month: string) {
  const BOM = '﻿'
  const header = ['Hạng', 'Nhân viên', 'Phòng ban', 'Điểm', 'Xếp loại',
    'WO hoàn thành', 'Đúng hạn%', 'TB giải quyết (h)', 'PM%',
    'TG phản hồi (phút)', 'Sự cố tái phát%']
  const rows = kpis.map((k, i) => [
    i + 1, k.name, k.department || k.role, k.score, k.grade,
    `${k.woStats.completionRate}% (${k.woStats.totalCompleted}/${k.woStats.totalAssigned})`,
    `${k.woStats.onTimeRate}%`,
    k.woStats.avgCompletionHours > 0 ? `${k.woStats.avgCompletionHours}h` : '—',
    `${k.pmStats.pmCompletionRate}% (${k.pmStats.pmCompleted}/${k.pmStats.pmScheduled})`,
    k.responseStats.avgResponseMinutes > 0 ? `${k.responseStats.avgResponseMinutes}m` : '—',
    `${k.incidentStats.recurringRate}%`,
  ])
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `kpi_${month}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

interface KpiLeaderboardProps {
  kpis: TechnicianKpi[]
  loading: boolean
  month: string
  onSelectKpi: (kpi: TechnicianKpi) => void
  currentUserUid?: string
}

export default function KpiLeaderboard({
  kpis, loading, month, onSelectKpi, currentUserUid,
}: KpiLeaderboardProps) {
  if (loading) return <TableSkeleton rows={5} />

  if (kpis.length === 0) {
    return (
      <div className="text-center py-10 text-t3 text-sm">
        Chưa có dữ liệu KPI cho tháng này
      </div>
    )
  }

  const avgScore = Math.round(kpis.reduce((s, k) => s + k.score, 0) / kpis.length)

  return (
    <div className="card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber" />
          <h3 className="text-sm font-semibold text-gray-100">Bảng xếp hạng</h3>
          <span className="text-xs text-t3">· {kpis.length} nhân viên</span>
          <span className="text-xs text-t3">· ĐTB: <span className="text-amber font-semibold">{avgScore}</span></span>
        </div>
        <button
          onClick={() => exportCsv(kpis, month)}
          className="btn-secondary text-xs flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="table-desktop text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-white/[0.07]">
              <th className="text-left w-12">Hạng</th>
              <th className="text-left">Nhân viên</th>
              <th className="text-left hidden md:table-cell">Phòng ban</th>
              <th className="text-right">WO HP</th>
              <th className="text-right hidden sm:table-cell">Đúng hạn</th>
              <th className="text-right hidden lg:table-cell">TB giải quyết</th>
              <th className="text-right hidden lg:table-cell">PM%</th>
              <th className="text-right">Điểm</th>
              <th className="text-center">Xếp loại</th>
              <th className="text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {kpis.map((kpi, i) => {
              const colors = GRADE_COLORS[kpi.grade] ?? GRADE_COLORS.F
              const isMe = kpi.uid === currentUserUid
              const rankBg = i === 0
                ? 'bg-yellow-500/5'
                : i === 1
                  ? 'bg-gray-400/5'
                  : i === 2
                    ? 'bg-orange-600/5'
                    : isMe
                      ? 'bg-amber/5'
                      : ''

              return (
                <tr
                  key={kpi.uid}
                  className={`hover:bg-white/[0.03] ${rankBg}`}
                >
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-100">{kpi.name}</span>
                      {isMe && (
                        <span className="badge badge-warning text-[10px]">Bạn</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-400 hidden md:table-cell">
                    {kpi.department || kpi.role}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-gray-300">
                      {kpi.woStats.completionRate}%
                    </span>
                    <span className="text-[10px] text-t3 block">
                      {kpi.woStats.totalCompleted}/{kpi.woStats.totalAssigned}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right hidden sm:table-cell">
                    <span className={kpi.woStats.onTimeRate >= 80 ? 'text-green-400' : 'text-gray-400'}>
                      {kpi.woStats.onTimeRate}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-400 hidden lg:table-cell">
                    {kpi.woStats.avgCompletionHours > 0
                      ? `${kpi.woStats.avgCompletionHours}h`
                      : '—'}
                  </td>
                  <td className="px-3 py-3 text-right hidden lg:table-cell">
                    <span className={kpi.pmStats.pmCompletionRate >= 80 ? 'text-green-400' : 'text-gray-400'}>
                      {kpi.pmStats.pmCompletionRate}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={`font-bold ${colors.text}`}>{kpi.score}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${colors.badge}`}>
                        {kpi.grade}
                      </span>
                      <span className="text-[9px] text-t3">{SCORE_LABEL[kpi.grade]}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => onSelectKpi(kpi)}
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
  )
}
