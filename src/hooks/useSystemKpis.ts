import { useState, useEffect } from 'react'
import {
  listenWorkOrders,
  listenIncidents,
  listenEnergyReadings,
  listenPmWorkOrders,
  listenInventory,
  listenCompliance,
} from '@/firebase/db'
import type { WorkOrder, Incident, EnergyReading, PMWorkOrder, InventoryItem, ComplianceRecord } from '@/types/firestore'
import { Timestamp } from 'firebase/firestore'

export interface SystemKpis {
  uptime: number
  workOrderCompletion: number
  workOrderOnTime: number
  deviceOnTime: number
  inventoryAccuracy: number
  fireIncidents: number
  complianceRate: number
  totalWorkOrders: number
  totalIncidents: number
  totalEnergyKwh: number
}

interface UseSystemKpisOptions {
  month: string
  year: number
}

function inPeriod(ts: Timestamp | undefined, month: string, year: number): boolean {
  if (!ts) return false
  const d = ts.toDate()
  return d.getFullYear() === year && d.getMonth() + 1 === Number(month)
}

export function useSystemKpis({ month, year }: UseSystemKpisOptions) {
  const [workOrders, setWorkOrders] = useState<(WorkOrder & { id: string })[]>([])
  const [incidents, setIncidents] = useState<(Incident & { id: string })[]>([])
  const [energyReadings, setEnergyReadings] = useState<(EnergyReading & { id: string })[]>([])
  const [pmWorkOrders, setPmWorkOrders] = useState<(PMWorkOrder & { id: string })[]>([])
  const [inventory, setInventory] = useState<(InventoryItem & { id: string })[]>([])
  const [compliance, setCompliance] = useState<(ComplianceRecord & { id: string })[]>([])

  useEffect(() => {
    const unsubWos = listenWorkOrders(setWorkOrders as (docs: (WorkOrder & { id: string })[]) => void)
    const unsubInc = listenIncidents(setIncidents as (docs: (Incident & { id: string })[]) => void)
    const unsubEnergy = listenEnergyReadings(setEnergyReadings as (docs: (EnergyReading & { id: string })[]) => void)
    const unsubPm = listenPmWorkOrders(setPmWorkOrders as (docs: (PMWorkOrder & { id: string })[]) => void)
    const unsubInv = listenInventory(setInventory as (docs: (InventoryItem & { id: string })[]) => void)
    const unsubComp = listenCompliance(setCompliance as (docs: (ComplianceRecord & { id: string })[]) => void)
    return () => {
      unsubWos(); unsubInc(); unsubEnergy(); unsubPm(); unsubInv(); unsubComp()
    }
  }, [])

  const periodWos = workOrders.filter((wo) => inPeriod(wo.createdAt, month, year))
  const periodIncidents = incidents.filter((i) => inPeriod(i.createdAt, month, year))
  const periodEnergy = energyReadings.filter((r) => inPeriod(r.date, month, year))
  const periodPmWos = pmWorkOrders.filter((wo) => inPeriod(wo.dueDate, month, year))

  const totalWos = periodWos.length
  const closedWos = periodWos.filter((wo) => wo.status === 'completed')
  const onTimeWos = closedWos.filter((wo) => {
    if (!wo.completedAt || !wo.dueDate) return false
    return wo.completedAt.toDate() <= wo.dueDate.toDate()
  })

  const completedPm = periodPmWos.filter((wo) => wo.status === 'completed')
  const totalPm = periodPmWos.length

  const totalEnergyKwh = periodEnergy.reduce((s, r) => s + (r.kwh ?? 0), 0)
  const totalIncidents = periodIncidents.length

  const workOrderCompletion = totalWos > 0 ? Math.round((closedWos.length / totalWos) * 100) : 0
  const workOrderOnTime = closedWos.length > 0 ? Math.round((onTimeWos.length / closedWos.length) * 100) : 0
  const deviceOnTime = totalPm > 0 ? Math.round((completedPm.length / totalPm) * 100) : 100

  // System uptime: from corrective WOs with known downtime
  const totalHours = (() => {
    const start = new Date(year, Number(month) - 1, 1)
    const end = new Date(year, Number(month), 0)
    return (end.getTime() - start.getTime()) / 3_600_000
  })()
  const totalDowntime = closedWos
    .filter((wo) => wo.type === 'corrective' && wo.completedAt && wo.createdAt)
    .reduce((s, wo) => {
      try {
        return s + (wo.completedAt!.toDate().getTime() - wo.createdAt!.toDate().getTime())
      } catch { return s }
    }, 0) / 3_600_000
  const uptime = totalHours > 0
    ? Number(Math.max(0, Math.min(100, (1 - totalDowntime / totalHours) * 100)).toFixed(2))
    : 100

  // P2.6: compute inventoryAccuracy from inventory items (items with valid qty)
  const inventoryAccuracy = inventory.length > 0
    ? Math.round(inventory.filter((item) => item.quantity >= 0).length / inventory.length * 100)
    : 100

  const compliantItems = compliance.filter((c) => c.status === 'compliant')
  const complianceRate = compliance.length > 0
    ? Math.round(compliantItems.length / compliance.length * 100)
    : 100

  // fireIncidents: score based on incident count in period (0 incidents = 100, 1+ = 0)
  const fireIncidents = totalIncidents === 0 ? 100 : 0

  const kpis: SystemKpis = {
    uptime,
    workOrderCompletion,
    workOrderOnTime,
    deviceOnTime,
    inventoryAccuracy,
    fireIncidents,
    complianceRate,
    totalWorkOrders: totalWos,
    totalIncidents,
    totalEnergyKwh,
  }

  return { kpis, isLoading: false }
}
