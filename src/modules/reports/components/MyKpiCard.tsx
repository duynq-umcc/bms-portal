import { useAuth } from '@/contexts/AuthContext'
import { TableSkeleton } from '@/components/ui/Table'
import type { TechnicianKpi } from '@/types/firestore'

const GRADE_COLORS: Record<string, { ring: string; text: string; bg: string; badge: string }> = {
  A: { ring: '#16a34a', text: 'text-green-400', bg: 'bg-green-500/15', badge: 'badge-success' },
  B: { ring: '#0d9488', text: 'text-teal-400', bg: 'bg-teal-500/15', badge: 'bg-teal-500/15 text-teal-400' },
  C: { ring: '#d97706', text: 'text-amber', bg: 'bg-amber/15', badge: 'badge-warning' },
  D: { ring: '#ea580c', text: 'text-orange-500', bg: 'bg-orange-500/15', badge: 'bg-orange-500/15 text-orange-500' },
  F: { ring: '#dc2626', text: 'text-red-400', bg: 'bg-red-500/15', badge: 'badge-danger' },
}

const SCORE_LABELS: Record<string, string> = {
  A: 'Xuất sắc', B: 'Tốt', C: 'Đạt', D: 'Cần cải thiện', F: 'Không đạt',
}

function RadialRing({ score, grade, size = 120 }: { score: number; grade: string; size?: number }) {
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.F
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={colors.ring} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-black ${colors.text}`}>{score}</span>
        <span className={`text-xs font-medium ${colors.text} opacity-70`}>/ 100</span>
      </div>
    </div>
  )
}

interface MyKpiCardProps {
  kpi: TechnicianKpi | null
  loading: boolean
  monthLabel: string
}

export default function MyKpiCard({ kpi, loading, monthLabel }: MyKpiCardProps) {
  const { user } = useAuth()

  if (loading) return <TableSkeleton rows={2} />

  if (!kpi) {
    return (
      <div className="card p-6 text-center">
        <p className="text-t2 text-sm mb-1">Chưa có dữ liệu KPI</p>
        <p className="text-t3 text-xs">KPI cho tháng {monthLabel} sẽ được tính khi có dữ liệu work orders</p>
      </div>
    )
  }

  const colors = GRADE_COLORS[kpi.grade] ?? GRADE_COLORS.F

  const metrics = [
    {
      label: 'WO đúng hạn',
      value: `${kpi.woStats.onTimeRate}%`,
      sub: `${kpi.woStats.completedOnTime} / ${kpi.woStats.totalCompleted} WO`,
      color: 'text-green-400',
      barColor: 'bg-green-500',
      pct: kpi.woStats.onTimeRate,
    },
    {
      label: 'PM tuân thủ',
      value: kpi.pmStats.pmScheduled > 0 ? `${kpi.pmStats.pmCompletionRate}%` : '—',
      sub: kpi.pmStats.pmScheduled > 0
        ? `${kpi.pmStats.pmCompleted} / ${kpi.pmStats.pmScheduled} BT phòng ngừa`
        : 'Chưa có lịch PM',
      color: 'text-blue-400',
      barColor: 'bg-blue-500',
      pct: kpi.pmStats.pmCompletionRate,
    },
    {
      label: 'TB giải quyết',
      value: kpi.woStats.avgCompletionHours > 0 ? `${kpi.woStats.avgCompletionHours}h` : '—',
      sub: kpi.responseStats.totalResponseSamples > 0
        ? `TG phản hồi TB: ${kpi.responseStats.avgResponseMinutes} phút`
        : 'Chưa có dữ liệu',
      color: 'text-purple-400',
      barColor: 'bg-purple-500',
      pct: kpi.woStats.avgCompletionHours > 0
        ? Math.max(0, Math.min(100, (20 - kpi.woStats.avgCompletionHours) / 20 * 100))
        : 0,
    },
    {
      label: 'Phản hồi đầu',
      value: kpi.responseStats.avgResponseMinutes > 0 ? `${kpi.responseStats.avgResponseMinutes}m` : '—',
      sub: kpi.responseStats.totalResponseSamples > 0
        ? `${kpi.responseStats.totalResponseSamples} mẫu`
        : 'Chưa có dữ liệu',
      color: 'text-cyan-400',
      barColor: 'bg-cyan-500',
      pct: kpi.responseStats.avgResponseMinutes > 0
        ? Math.max(0, Math.min(100, (30 - kpi.responseStats.avgResponseMinutes) / 30 * 100))
        : 0,
    },
  ]

  return (
    <div className={`card p-5 ${colors.bg} border ${colors.ring} border-opacity-20`}>
      <div className="flex items-start gap-5">
        {/* Radial ring */}
        <RadialRing score={kpi.score} grade={kpi.grade} />

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-100">{user?.displayName ?? 'Bạn'}</h3>
            <p className="text-xs text-t3">KPI {monthLabel}</p>
          </div>

          {/* Grade badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${colors.badge}`}>
              {kpi.grade}
            </span>
            <span className={`text-sm font-semibold ${colors.text}`}>
              {SCORE_LABELS[kpi.grade]}
            </span>
            {kpi.previousPeriodScore !== null && (
              <span className={`text-xs ${kpi.score > kpi.previousPeriodScore ? 'text-green-400' : kpi.score < kpi.previousPeriodScore ? 'text-red-400' : 'text-t3'}`}>
                {kpi.score > kpi.previousPeriodScore ? '↑' : kpi.score < kpi.previousPeriodScore ? '↓' : '='}
                {' '}
                {Math.abs(kpi.score - kpi.previousPeriodScore)} vs tháng trước
              </span>
            )}
          </div>

          {/* 4 sub-metrics */}
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="bg-white/[0.04] rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400">{m.label}</span>
                  <span className={`text-sm font-bold ${m.color}`}>{m.value}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
                  <div className={`h-full rounded-full transition-all ${m.barColor}`} style={{ width: `${m.pct}%` }} />
                </div>
                <p className="text-[10px] text-t3">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
