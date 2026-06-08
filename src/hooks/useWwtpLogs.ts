import { useState, useCallback } from 'react'
import { listenWwtpLogs, addWwtpLog } from '@/firebase/db'
import { toast } from '@/components/ui/Toast'
import type { WwtpLog, WwtpReadings, WwtpChemicalUsed } from '@/types/firestore'
import { computeWwtpStatus } from '@/types/firestore'
import { Timestamp } from 'firebase/firestore'

export function useGetWwtpLogs() {
  const [logs, setLogs] = useState<(WwtpLog & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  const unsub = listenWwtpLogs((docs) => {
    setLogs(docs)
    setLoading(false)
  })

  return { logs, loading, unsub }
}

export function useCreateWwtpLog() {
  const [creating, setCreating] = useState(false)

  const create = useCallback(async (data: {
    logDate: Date
    shift: 'morning' | 'afternoon' | 'night'
    operatorId: string
    operatorName: string
    readings: WwtpReadings
    chemicalUsed: WwtpChemicalUsed[]
    issues: string
  }) => {
    setCreating(true)
    try {
      const overallStatus = computeWwtpStatus(data.readings)
      await addWwtpLog({
        logDate: Timestamp.fromDate(data.logDate),
        shift: data.shift,
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        readings: data.readings,
        chemicalUsed: data.chemicalUsed,
        issues: data.issues,
        overallStatus,
      })
      toast.success('Đã lưu nhật ký vận hành WWTP')
      return true
    } catch (err) {
      console.error('[WWTP] create error:', err)
      toast.error('Lưu thất bại')
      return false
    } finally {
      setCreating(false)
    }
  }, [])

  return { create, creating }
}
