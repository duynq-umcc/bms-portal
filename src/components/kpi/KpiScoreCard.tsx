import type { TechnicianKpi } from '@/types/firestore'

interface KpiScoreCardProps {
  kpi: TechnicianKpi
  compact?: boolean
  onClick?: () => void
}

// ─── Grade + trend colors ─────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, { ring: string; text: string; bg: string; badge: string }> = {
  A: { ring: '#16a34a', text: 'text-green-400', bg: 'bg-green-500/15', badge: 'badge-success' },
  B: { ring: '#0d9488', text: 'text-teal-400', bg: 'bg-teal-500/15', badge: 'bg-teal-500/15 text-teal-400' },
  C: { ring: '#d97706', text: 'text-amber', bg: 'bg-amber/15', badge: 'badge-warning' },
  D: { ring: '#ea580c', text: 'text-orange-500', bg: 'bg-orange-500/15', badge: 'bg-orange-500/15 text-orange-500' },
  F: { ring: '#dc2626', text: 'text-red-400', bg: 'bg-red-500/15', badge: 'badge-danger' },
}

const TREND_CONFIG = {
  up: { arrow: '↑', color: 'text-green-400', label: 'Tăng' },
  down: { arrow: '↓', color: 'text-red-400', label: 'Giảm' },
  stable: { arrow: '=', color: 'text-gray-400', label: 'Ổn định' },
}

function ScoreRing({
  score,
  grade,
  size = 48,
}: {
  score: number
  grade: string
  size?: number
}) {
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.F
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.ring}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ fontSize: size * 0.28 }}
      >
        <span className={`font-bold ${colors.text}`}>{score}</span>
      </div>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function MetricMini({
  label,
  value,
  sub,
  barColor,
}: {
  label: string
  value: string
  sub: string
  barColor: string
}) {
  const pct = Math.min(100, parseInt(value) || 0)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-sm font-bold text-gray-100">{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-t3 mt-0.5 block">{sub}</span>
    </div>
  )
}

// ─── Compact version ──────────────────────────────────────────────────────────

export function KpiScoreCardCompact({
  kpi,
  onClick,
}: {
  kpi: TechnicianKpi
  onClick?: () => void
}) {
  const colors = GRADE_COLORS[kpi.grade] ?? GRADE_COLORS.F

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/[0.07] rounded-xl hover:bg-white/[0.08] transition-all text-left"
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colors.bg} ${colors.text}`}
      >
        {getInitials(kpi.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-100 truncate">{kpi.name}</p>
        <p className="text-[10px] text-t3 truncate">{kpi.department || kpi.role}</p>
      </div>
      <ScoreRing score={kpi.score} grade={kpi.grade} size={32} />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${colors.badge}`}>
            {kpi.grade}
          </span>
          {kpi.trend !== 'stable' && (
            <span className={`text-xs ${TREND_CONFIG[kpi.trend].color}`}>
              {TREND_CONFIG[kpi.trend].arrow}
            </span>
          )}
        </div>
        <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-amber"
            style={{ width: `${kpi.woStats.completionRate}%` }}
          />
        </div>
      </div>
    </button>
  )
}

// ─── Full version ──────────────────────────────────────────────────────────────

export function KpiScoreCard({ kpi, compact = false, onClick }: KpiScoreCardProps) {
  if (compact) return <KpiScoreCardCompact kpi={kpi} onClick={onClick} />

  const colors = GRADE_COLORS[kpi.grade] ?? GRADE_COLORS.F
  const trend = TREND_CONFIG[kpi.trend]

  const roleColorMap: Record<string, string> = {
    admin: 'bg-purple-500/20 text-purple-400',
    manager: 'bg-teal-500/20 text-teal-400',
    technician: 'bg-blue-500/20 text-blue-400',
  }
  const roleColor = roleColorMap[kpi.role] ?? 'bg-white/10 text-gray-400'

  const recurringColor =
    kpi.incidentStats.recurringRate > 20
      ? 'bg-red-500'
      : kpi.incidentStats.recurringRate > 10
        ? 'bg-amber'
        : 'bg-green-500'

  const periodDate = kpi.calculatedAt?.toDate()

  return (
    <div
      onClick={onClick}
      className={`card p-4 space-y-4 ${onClick ? 'cursor-pointer hover:bg-white/[0.06] transition-colors' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${roleColor}`}
        >
          {getInitials(kpi.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100">{kpi.name}</p>
          <span className="text-xs text-t3">{kpi.department || kpi.role}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ScoreRing score={kpi.score} grade={kpi.grade} size={48} />
          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${colors.badge}`}>
            {kpi.grade}
          </span>
          {kpi.previousPeriodScore !== null && (
            <span className={`text-xs ${trend.color}`}>
              {trend.arrow} {trend.label}
            </span>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricMini
          label="WO Hoàn thành"
          value={`${kpi.woStats.completionRate}%`}
          sub={`${kpi.woStats.totalCompleted}/${kpi.woStats.totalAssigned} phiếu`}
          barColor="bg-amber"
        />
        <MetricMini
          label="Đúng hạn"
          value={`${kpi.woStats.onTimeRate}%`}
          sub={`${kpi.woStats.completedOnTime} WO đúng hạn`}
          barColor="bg-green-500"
        />
        <MetricMini
          label="TG phản hồi"
          value={
            kpi.responseStats.avgResponseMinutes > 0
              ? `${kpi.responseStats.avgResponseMinutes} phút`
              : '—'
          }
          sub={
            kpi.responseStats.totalResponseSamples > 0
              ? `Nhanh nhất: ${kpi.responseStats.fastestResponseMinutes} phút`
              : 'Chưa có dữ liệu'
          }
          barColor="bg-blue-500"
        />
        <MetricMini
          label="Sự cố tái phát"
          value={`${kpi.incidentStats.recurringRate}%`}
          sub={`${kpi.incidentStats.recurringIncidents}/${kpi.incidentStats.totalIncidentsReported} sự cố`}
          barColor={recurringColor}
        />
      </div>

      {/* PM row */}
      {kpi.pmStats.pmScheduled > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 shrink-0">BT phòng ngừa:</span>
          <span className="text-xs font-semibold text-gray-100">
            {kpi.pmStats.pmCompleted}/{kpi.pmStats.pmScheduled} lịch hoàn thành ({kpi.pmStats.pmCompletionRate}%)
          </span>
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: `${kpi.pmStats.pmCompletionRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Period */}
      <div className="flex items-center justify-between text-[10px] text-t3 border-t border-white/[0.05] pt-2">
        <span>{kpi.period}</span>
        {periodDate && (
          <span>
            Tính lúc:{' '}
            {periodDate.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  )
}
