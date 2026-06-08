import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { checkAndCreatePmWorkOrders, markOverduePmWorkOrders } from '@/utils/pmEngine'

const LAST_RUN_KEY = 'pm_auto_runner:last_run_date'

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

export function usePmAutoRunner() {
  const { user, loading } = useAuth()
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (loading || !user) return
    if (hasRunRef.current) return

    const run = async () => {
      const lastRun = localStorage.getItem(LAST_RUN_KEY)
      const today = todayDateStr()

      if (lastRun === today) {
        if (import.meta.env.DEV) {
          console.log('[PmAutoRunner] Already ran today, skipping.')
        }
        return
      }

      hasRunRef.current = true

      try {
        if (import.meta.env.DEV) {
          console.log('[PmAutoRunner] Running PM auto-generation...')
        }

        const pm = await checkAndCreatePmWorkOrders()
        const overdue = await markOverduePmWorkOrders()

        localStorage.setItem(LAST_RUN_KEY, today)

        if (import.meta.env.DEV) {
          console.log(
            `[PmAutoRunner] Done. ${pm.created} WOs created, ${pm.overdue} overdue, ${overdue} overdue marked.${pm.skipped > 0 ? ` (${pm.skipped} skipped)` : ''}`,
          )
        }
      } catch (err) {
        console.error('[PmAutoRunner] Error:', err)
      }
    }

    run()
  }, [user, loading])
}
