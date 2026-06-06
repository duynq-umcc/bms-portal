import { useEffect } from 'react'
import { computeAllTechnicianKpi, getCurrentPeriod } from '@/utils/kpiEngine'
import { useAuth } from '@/contexts/AuthContext'

export function useKpiEngine() {
  const { user } = useAuth()
  const role = user?.role as string | undefined

  useEffect(() => {
    if (!user || !['admin', 'manager'].includes(role ?? '')) return

    const run = async () => {
      if (import.meta.env.DEV) console.log('[KpiEngine] Computing KPIs...')
      try {
        await computeAllTechnicianKpi(getCurrentPeriod())
        if (import.meta.env.DEV) console.log('[KpiEngine] Done.')
      } catch (err) {
        console.error('[KpiEngine] Error:', err)
      }
    }

    run()
    const id = setInterval(run, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [user, role])
}
