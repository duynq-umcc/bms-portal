import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { TechnicianKpi } from '@/types/firestore'

// ─── KPI weights ──────────────────────────────────────────────────────────────

const KPI_WEIGHTS = {
  woCompletionRate: 30,
  woOnTimeRate: 25,
  avgResponseTime: 20,
  pmCompletionRate: 15,
  recurringRate: 10,
}

// ─── Period helpers ───────────────────────────────────────────────────────────

export function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getPrevPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

export function getPeriodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const months = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
  ]
  return `${months[m - 1]} ${y}`
}

// ─── Score computation ────────────────────────────────────────────────────────

export function computeScore(kpi: Pick<TechnicianKpi, 'woStats' | 'responseStats' | 'pmStats' | 'incidentStats'>): number {
  let score = 0

  // WO Completion Rate (30pts)
  score += (kpi.woStats.completionRate / 100) * KPI_WEIGHTS.woCompletionRate

  // On-time Rate (25pts)
  score += (kpi.woStats.onTimeRate / 100) * KPI_WEIGHTS.woOnTimeRate

  // Response Time (20pts) — target: < 60 min = full marks, > 240 min = 0
  const responseScore = Math.max(
    0,
    1 - (kpi.responseStats.avgResponseMinutes - 60) / 180,
  )
  score += responseScore * KPI_WEIGHTS.avgResponseTime

  // PM Completion (15pts)
  score += (kpi.pmStats.pmCompletionRate / 100) * KPI_WEIGHTS.pmCompletionRate

  // Recurring Incidents (10pts) — lower is better
  const recurringScore = Math.max(
    0,
    1 - kpi.incidentStats.recurringRate / 100,
  )
  score += recurringScore * KPI_WEIGHTS.recurringRate

  return Math.round(Math.min(100, score))
}

export function computeGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 45) return 'D'
  return 'F'
}

// ─── Score breakdown for detail panel ───────────────────────────────────────

export function getScoreBreakdown(kpi: Pick<TechnicianKpi, 'woStats' | 'responseStats' | 'pmStats' | 'incidentStats'>) {
  const woCompPoints = Math.round((kpi.woStats.completionRate / 100) * KPI_WEIGHTS.woCompletionRate)
  const woTimePoints = Math.round((kpi.woStats.onTimeRate / 100) * KPI_WEIGHTS.woOnTimeRate)
  const responseScore = Math.max(0, 1 - (kpi.responseStats.avgResponseMinutes - 60) / 180)
  const responsePoints = Math.round(responseScore * KPI_WEIGHTS.avgResponseTime)
  const pmPoints = Math.round((kpi.pmStats.pmCompletionRate / 100) * KPI_WEIGHTS.pmCompletionRate)
  const recurringScore = Math.max(0, 1 - kpi.incidentStats.recurringRate / 100)
  const recurringPoints = Math.round(recurringScore * KPI_WEIGHTS.recurringRate)
  const total = woCompPoints + woTimePoints + responsePoints + pmPoints + recurringPoints

  return [
    { label: 'Tỷ lệ hoàn thành WO', max: KPI_WEIGHTS.woCompletionRate, points: woCompPoints },
    { label: 'Tỷ lệ đúng hạn', max: KPI_WEIGHTS.woOnTimeRate, points: woTimePoints },
    { label: 'Thời gian phản hồi', max: KPI_WEIGHTS.avgResponseTime, points: responsePoints },
    { label: 'Hoàn thành BT phòng ngừa', max: KPI_WEIGHTS.pmCompletionRate, points: pmPoints },
    { label: 'Sự cố tái phát', max: KPI_WEIGHTS.recurringRate, points: recurringPoints },
  ].map((row) => ({
    ...row,
    pct: row.max > 0 ? Math.round((row.points / row.max) * 100) : 0,
  })).concat([{ label: 'TỔNG', max: 100, points: total, pct: total }])
}

// ─── Main computation ─────────────────────────────────────────────────────────

export async function computeTechnicianKpi(
  uid: string,
  period: string,
): Promise<TechnicianKpi> {
  const [year, month] = period.split('-').map(Number)
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)
  const startTs = Timestamp.fromDate(startOfMonth)
  const endTs = Timestamp.fromDate(endOfMonth)

  // ── WO Stats ───────────────────────────────────────────────────────────────
  const [allWoSnap, completedWoSnap, pmWoSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'workOrders'),
        where('assignedTo', '==', uid),
        where('createdAt', '>=', startTs),
        where('createdAt', '<=', endTs),
      ),
    ),
    getDocs(
      query(
        collection(db, 'workOrders'),
        where('assignedTo', '==', uid),
        where('status', '==', 'completed'),
        where('completedAt', '>=', startTs),
        where('completedAt', '<=', endTs),
      ),
    ),
    getDocs(
      query(
        collection(db, 'pmWorkOrders'),
        where('assignedTo', '==', uid),
        where('dueDate', '>=', startTs),
        where('dueDate', '<=', endTs),
      ),
    ),
  ])

  const allWos = allWoSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt as Timestamp | undefined,
      completedAt: data.completedAt as Timestamp | undefined,
      dueDate: data.dueDate as Timestamp | undefined,
      startedAt: data.startedAt as Timestamp | undefined,
      status: data.status as string | undefined,
    }
  })
  const completedWos = completedWoSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      completedAt: data.completedAt as Timestamp | undefined,
      createdAt: data.createdAt as Timestamp | undefined,
      dueDate: data.dueDate as Timestamp | undefined,
      startedAt: data.startedAt as Timestamp | undefined,
      status: data.status as string | undefined,
    }
  })

  const completedOnTime = completedWos.filter(
    (wo) =>
      wo.dueDate &&
      wo.completedAt &&
      wo.completedAt.toMillis() <= wo.dueDate.toMillis(),
  ).length

  const completionHours = completedWos
    .filter((wo) => wo.completedAt && wo.createdAt)
    .map((wo) =>
      (wo.completedAt!.toMillis() - wo.createdAt!.toMillis()) / 3_600_000,
    )
  const avgCompletionHours =
    completionHours.length > 0
      ? Math.round(
          completionHours.reduce((a, b) => a + b, 0) / completionHours.length,
        )
      : 0

  // ── Response Stats ─────────────────────────────────────────────────────────
  const responseTimes = allWos
    .filter((wo) => wo.startedAt && wo.createdAt)
    .map((wo) =>
      (wo.startedAt!.toMillis() - wo.createdAt!.toMillis()) / 60_000,
    )
    .filter((t) => t > 0 && t < 10_000)

  const avgResponseMinutes =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        )
      : 0

  // ── Incident Stats ─────────────────────────────────────────────────────────
  const incidentSnap = await getDocs(
    query(
      collection(db, 'incidents'),
      where('reportedBy', '==', uid),
      where('createdAt', '>=', startTs),
      where('createdAt', '<=', endTs),
    ),
  )
  const incidents = incidentSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt as Timestamp | undefined,
      location: (data as Record<string, unknown>).location as string || '',
      category: (data as Record<string, unknown>).category as string || '',
      severity: (data as Record<string, unknown>).severity as string || 'low',
    }
  })

  let recurringCount = 0
  for (let i = 0; i < incidents.length; i++) {
    const current = incidents[i]
    const thirtyDaysBefore = current.createdAt!.toMillis() - 30 * 86_400_000
    const isRecurring = incidents.some(
      (prev, j) =>
        j !== i &&
        prev.location === current.location &&
        prev.category === current.category &&
        prev.createdAt!.toMillis() > thirtyDaysBefore &&
        prev.createdAt!.toMillis() < current.createdAt!.toMillis(),
    )
    if (isRecurring) recurringCount++
  }

  // ── PM Stats ────────────────────────────────────────────────────────────────
  const pmWos = pmWoSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      completedAt: data.completedAt as Timestamp | undefined,
      dueDate: data.dueDate as Timestamp | undefined,
      status: data.status as string | undefined,
    }
  })
  const pmCompleted = pmWos.filter((wo) => wo.status === 'completed').length
  const pmOnTime = pmWos.filter(
    (wo) =>
      wo.status === 'completed' &&
      wo.completedAt &&
      wo.dueDate &&
      wo.completedAt.toMillis() <= wo.dueDate.toMillis(),
  ).length

  // ── Assemble KPI ────────────────────────────────────────────────────────────
  const woStats = {
    totalAssigned: allWos.length,
    totalCompleted: completedWos.length,
    completedOnTime,
    overdue: allWos.filter(
      (wo) =>
        wo.status !== 'completed' &&
        wo.status !== 'cancelled' &&
        wo.dueDate &&
        wo.dueDate.toMillis() < Date.now(),
    ).length,
    inProgress: allWos.filter((wo) => wo.status === 'in_progress').length,
    completionRate:
      allWos.length > 0
        ? Math.round((completedWos.length / allWos.length) * 100)
        : 0,
    onTimeRate:
      completedWos.length > 0
        ? Math.round((completedOnTime / completedWos.length) * 100)
        : 0,
    avgCompletionHours,
  }

  const responseStats = {
    avgResponseMinutes,
    fastestResponseMinutes:
      responseTimes.length > 0 ? Math.round(Math.min(...responseTimes)) : 0,
    slowestResponseMinutes:
      responseTimes.length > 0 ? Math.round(Math.max(...responseTimes)) : 0,
    totalResponseSamples: responseTimes.length,
  }

  const incidentStats = {
    totalIncidentsReported: incidents.length,
    recurringIncidents: recurringCount,
    recurringRate:
      incidents.length > 0
        ? Math.round((recurringCount / incidents.length) * 100)
        : 0,
    criticalIncidents: incidents.filter(
      (i) => i.severity === 'high' || i.severity === 'critical',
    ).length,
  }

  const pmStats = {
    pmScheduled: pmWos.length,
    pmCompleted,
    pmOnTime,
    pmCompletionRate:
      pmWos.length > 0
        ? Math.round((pmCompleted / pmWos.length) * 100)
        : 0,
  }

  // ── User info ──────────────────────────────────────────────────────────────
  const userDoc = await getDoc(doc(db, 'users', uid))
  const userData = userDoc.data() ?? {}

  const kpiData: TechnicianKpi = {
    uid,
    period,
    name: userData.displayName ?? uid,
    department: userData.dept ?? '',
    role: userData.role ?? '',
    woStats,
    responseStats,
    incidentStats,
    pmStats,
    score: 0,
    grade: 'F',
    trend: 'stable',
    calculatedAt: Timestamp.now(),
    previousPeriodScore: null,
  }

  kpiData.score = computeScore(kpiData)
  kpiData.grade = computeGrade(kpiData.score)

  // Get previous period for trend
  const prevPeriod = getPrevPeriod(period)
  try {
    const prevDoc = await getDoc(
      doc(db, 'kpiHistory', uid, 'months', prevPeriod),
    )
    if (prevDoc.exists()) {
      const prevScore = prevDoc.data().score as number
      kpiData.previousPeriodScore = prevScore
      kpiData.trend =
        kpiData.score > prevScore + 3
          ? 'up'
          : kpiData.score < prevScore - 3
            ? 'down'
            : 'stable'
    }
  } catch {
    // Previous period may not exist yet
  }

  return kpiData
}

// ─── Compute for all technicians ──────────────────────────────────────────────

export async function computeAllTechnicianKpi(period: string): Promise<void> {
  const techniciansSnap = await getDocs(
    query(
      collection(db, 'users'),
      where('role', 'in', ['technician', 'manager']),
    ),
  )

  for (const techDoc of techniciansSnap.docs) {
    try {
      const kpi = await computeTechnicianKpi(techDoc.id, period)
      await setDoc(doc(db, 'technicianKpi', techDoc.id), kpi)
    } catch (err) {
      console.error(`[kpiEngine] Failed for uid=${techDoc.id}:`, err)
    }
  }
}
