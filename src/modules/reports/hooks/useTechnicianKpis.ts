import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type DocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { TechnicianKpi } from '@/types/firestore'

function kpiFromData(d: DocumentSnapshot): TechnicianKpi {
  return d.data() as TechnicianKpi
}

export function useGetTechnicianKpis(period: string) {
  const [kpis, setKpis] = useState<TechnicianKpi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const q = query(
      collection(db, 'technicianKpi'),
      where('period', '==', period),
      orderBy('score', 'desc'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setKpis(snap.docs.map(kpiFromData))
      setLoading(false)
    })
    return unsub
  }, [period])

  return { kpis, loading }
}

export function useGetMyKpi(period: string, uid: string) {
  const [kpi, setKpi] = useState<TechnicianKpi | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    setLoading(true)
    const q = query(
      collection(db, 'technicianKpi'),
      where('period', '==', period),
      where('uid', '==', uid),
    )
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) setKpi(snap.docs[0].data() as TechnicianKpi)
      else setKpi(null)
      setLoading(false)
    })
    return unsub
  }, [period, uid])

  return { kpi, loading }
}
