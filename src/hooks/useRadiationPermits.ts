import { useState, useCallback } from 'react'
import {
  listenRadiationPermits,
  addRadiationPermit,
  updateRadiationPermit,
} from '@/firebase/db'
import { toast } from '@/components/ui/Toast'
import type { RadiationPermit, RadiationPermitStatus } from '@/types/firestore'
import { Timestamp } from 'firebase/firestore'
import { differenceInDays } from 'date-fns'

function computePermitStatus(expiryDate: Timestamp): RadiationPermitStatus {
  const daysLeft = differenceInDays(expiryDate.toDate(), new Date())
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 90) return 'expiring_soon'
  return 'valid'
}

export function useGetRadiationPermits() {
  const [permits, setPermits] = useState<(RadiationPermit & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  const unsub = listenRadiationPermits((docs) => {
    const withStatus = docs.map((d) => ({
      ...d,
      status: computePermitStatus(d.expiryDate),
    }))
    setPermits(withStatus)
    setLoading(false)
  })

  return { permits, loading, unsub }
}

export function useCreateRadiationPermit() {
  const [creating, setCreating] = useState(false)

  const create = useCallback(async (data: {
    equipmentName: string
    equipmentCode: string
    permitNumber: string
    issuedBy: string
    issuedDate: Date
    expiryDate: Date
    licenseFileUrl: string
    safetyOfficer: string
  }) => {
    setCreating(true)
    try {
      const doc = {
        equipmentName: data.equipmentName,
        equipmentCode: data.equipmentCode,
        permitNumber: data.permitNumber,
        issuedBy: data.issuedBy,
        issuedDate: Timestamp.fromDate(data.issuedDate),
        expiryDate: Timestamp.fromDate(data.expiryDate),
        licenseFileUrl: data.licenseFileUrl,
        safetyOfficer: data.safetyOfficer,
        status: computePermitStatus(Timestamp.fromDate(data.expiryDate)),
        alertSentAt: null,
      }
      await addRadiationPermit(doc as Omit<RadiationPermit, 'id'>)
      toast.success('Đã thêm giấy phép bức xạ')
      return true
    } catch (err) {
      console.error('[RadiationPermit] create error:', err)
      toast.error('Thêm giấy phép thất bại')
      return false
    } finally {
      setCreating(false)
    }
  }, [])

  return { create, creating }
}

export function useUpdateRadiationPermit() {
  const [updating, setUpdating] = useState(false)

  const update = useCallback(async (
    id: string,
    data: Partial<Omit<RadiationPermit, 'id' | 'status' | 'alertSentAt'>>
  ) => {
    setUpdating(true)
    try {
      const updateData: Partial<RadiationPermit> = { ...data }
      if (data.expiryDate) {
        updateData.status = computePermitStatus(data.expiryDate as Timestamp)
      }
      await updateRadiationPermit(id, updateData)
      toast.success('Đã cập nhật giấy phép')
      return true
    } catch (err) {
      console.error('[RadiationPermit] update error:', err)
      toast.error('Cập nhật thất bại')
      return false
    } finally {
      setUpdating(false)
    }
  }, [])

  return { update, updating }
}
