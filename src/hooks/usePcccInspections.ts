import { useState, useCallback } from 'react'
import { listenPcccInspections, addPcccInspection, getPcccInspectionByMonth } from '@/firebase/db'
import { toast } from '@/components/ui/Toast'
import type {
  PcccInspection,
  PcccCheckItem,
  PcccOverallResult,
} from '@/types/firestore'
import { DEFAULT_PCCC_CHECKLIST } from '@/types/firestore'
import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

export function useGetPcccInspections() {
  const [inspections, setInspections] = useState<(PcccInspection & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  const unsub = listenPcccInspections((docs) => {
    setInspections(docs)
    setLoading(false)
  })

  return { inspections, loading, unsub }
}

export function useCreatePcccInspection() {
  const [creating, setCreating] = useState(false)

  const create = useCallback(async (data: {
    inspectorName: string
    locationNotes: string
    checklist: PcccCheckItem[]
    notes: string
    signatureUrl?: string
  }) => {
    const month = format(new Date(), 'yyyy-MM')
    const existing = await getPcccInspectionByMonth(month)
    if (existing) {
      toast.error('Tháng này đã có biên bản kiểm tra PCCC')
      return null
    }

    setCreating(true)
    try {
      const failedCount = data.checklist.filter((c) => c.result === 'fail').length
      const naCount = data.checklist.filter((c) => c.result === 'na').length
      let overallResult: PcccOverallResult = 'pass'
      if (failedCount > 2) overallResult = 'fail'
      else if (failedCount > 0) overallResult = 'conditional'

      const doc = {
        month,
        inspectedAt: Timestamp.now(),
        inspectorId: '',
        inspectorName: data.inspectorName,
        locationNotes: data.locationNotes,
        checklist: data.checklist,
        overallResult,
        failedItems: failedCount,
        naItems: naCount,
        notes: data.notes,
        signatureUrl: data.signatureUrl,
      }

      await addPcccInspection(doc as Omit<PcccInspection, 'id'>)
      toast.success('Đã lưu biên bản kiểm tra PCCC tháng ' + format(new Date(), 'MM/yyyy', { locale: vi }))
      return true
    } catch (err) {
      console.error('[PCCC] create error:', err)
      toast.error('Lưu biên bản thất bại')
      return null
    } finally {
      setCreating(false)
    }
  }, [])

  return { create, creating }
}

export function buildDefaultChecklist(): PcccCheckItem[] {
  return DEFAULT_PCCC_CHECKLIST.map((item) => ({
    ...item,
    result: 'ok' as const,
    note: '',
  }))
}
