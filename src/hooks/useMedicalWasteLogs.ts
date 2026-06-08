import { useState, useCallback } from 'react'
import { listenMedicalWasteLogs, addMedicalWasteLog } from '@/firebase/db'
import { toast } from '@/components/ui/Toast'
import type { MedicalWasteLog, MedicalWaste } from '@/types/firestore'
import { Timestamp } from 'firebase/firestore'

export function useGetMedicalWasteLogs() {
  const [logs, setLogs] = useState<(MedicalWasteLog & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  const unsub = listenMedicalWasteLogs((docs) => {
    setLogs(docs)
    setLoading(false)
  })

  return { logs, loading, unsub }
}

export function useCreateMedicalWasteLog() {
  const [creating, setCreating] = useState(false)

  const create = useCallback(async (data: {
    logDate: Date
    recordedBy: string
    recordedByName: string
    waste: MedicalWaste
    collectedBy: string
    collectionReceiptNo: string
    storageLocation: string
    notes: string
  }) => {
    setCreating(true)
    try {
      await addMedicalWasteLog({
        logDate: Timestamp.fromDate(data.logDate),
        recordedBy: data.recordedBy,
        recordedByName: data.recordedByName,
        waste: data.waste,
        collectedBy: data.collectedBy,
        collectionReceiptNo: data.collectionReceiptNo,
        storageLocation: data.storageLocation,
        notes: data.notes,
      })
      toast.success('Đã lưu nhật ký chất thải y tế')
      return true
    } catch (err) {
      console.error('[MedicalWaste] create error:', err)
      toast.error('Lưu thất bại')
      return false
    } finally {
      setCreating(false)
    }
  }, [])

  return { create, creating }
}
