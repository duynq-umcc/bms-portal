import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { createNotification } from '@/utils/createNotification'
import type { PMSchedule, PMWorkOrderTask } from '@/types/firestore'

// ─── computeNextDueDate ───────────────────────────────────────────────────

export function computeNextDueDate(
  schedule: { frequency: { type: string; intervalDays: number; dayOfMonth?: number | null } },
  fromDate: Date = new Date(),
): Date {
  switch (schedule.frequency.type) {
    case 'monthly': {
      const next = new Date(fromDate)
      next.setMonth(next.getMonth() + 1)
      if (schedule.frequency.dayOfMonth) {
        next.setDate(schedule.frequency.dayOfMonth)
      }
      return next
    }
    case 'quarterly':
      return new Date(fromDate.getTime() + 90 * 86_400_000)
    case 'biannual':
      return new Date(fromDate.getTime() + 180 * 86_400_000)
    case 'annual':
      return new Date(fromDate.getTime() + 365 * 86_400_000)
    default:
      return new Date(fromDate.getTime() + schedule.frequency.intervalDays * 86_400_000)
  }
}

// ─── checkAndCreatePmWorkOrders ──────────────────────────────────────────

export async function checkAndCreatePmWorkOrders(): Promise<{ created: number; overdue: number }> {
  const now = Date.now()
  const triggerDate = Timestamp.fromMillis(now + 30 * 86_400_000)

  const schedulesSnap = await getDocs(
    query(
      collection(db, 'pmSchedules'),
      where('isActive', '==', true),
      where('nextDueDate', '<=', triggerDate),
    ),
  )

  let created = 0
  let overdue = 0

  for (const schedDoc of schedulesSnap.docs) {
    const sched = { id: schedDoc.id, ...schedDoc.data() } as PMSchedule & { id: string }

    // Check if WO already exists for this schedule+period
    const windowStart = Timestamp.fromMillis(
      sched.nextDueDate.toMillis() - 7 * 86_400_000,
    )
    const existingWO = await getDocs(
      query(
        collection(db, 'pmWorkOrders'),
        where('pmScheduleId', '==', sched.id),
        where('status', 'in', ['scheduled', 'inProgress', 'completed']),
        where('dueDate', '>=', windowStart),
        where('dueDate', '<=', sched.nextDueDate),
      ),
    )
    if (!existingWO.empty) continue

    const isOverdue = sched.nextDueDate.toMillis() < now
    if (isOverdue) overdue++

    const daysUntilDue = Math.floor(
      (sched.nextDueDate.toMillis() - now) / 86_400_000,
    )
    const shouldCreate =
      sched.autoCreateWO && daysUntilDue <= sched.autoCreateDaysBefore

    if (!shouldCreate && !isOverdue) continue

    // Create PM Work Order
    const tasks: PMWorkOrderTask[] = sched.tasks.map((t) => ({
      ...t,
      completed: false,
      completedAt: null,
      completedBy: null,
      note: '',
    }))

    await addDoc(collection(db, 'pmWorkOrders'), {
      pmScheduleId: sched.id,
      scheduleName: sched.name,
      assetId: sched.assetId ?? '',
      assetName: sched.assetName,
      assetCode: sched.assetCode,
      location: sched.location,
      department: sched.department,
      dueDate: sched.nextDueDate,
      scheduledDate: sched.nextDueDate,
      startedAt: null,
      completedAt: null,
      status: isOverdue ? 'overdue' : 'scheduled',
      assignedTo: sched.assignedTo ?? '',
      assignedToName: sched.assignedToName ?? 'Chưa phân công',
      requiresContractor: sched.requiresContractor,
      contractorId: sched.contractorId ?? null,
      tasks,
      completionPhotos: [],
      technicianNotes: '',
      actualDuration: null,
      partsUsed: [],
      signedOffBy: null,
      signedOffAt: null,
      signedOffNote: null,
      generatedAt: Timestamp.now(),
      generatedBy: 'auto',
    })
    created++

    // Notify assigned technician
    if (sched.assignedTo) {
      const dueDateStr = sched.nextDueDate.toDate().toLocaleDateString('vi-VN')
      await createNotification(sched.assignedTo, {
        title: `Lịch BT: ${sched.assetName}`,
        body: `${sched.name} — hạn ${dueDateStr}`,
        type: 'workOrder',
        link: `/maintenance?tab=pm`,
        priority: isOverdue ? 'urgent' : 'high',
      })
    }
  }

  // Log execution
  await addDoc(collection(db, 'pmExecutionLog'), {
    runAt: Timestamp.now(),
    schedulesChecked: schedulesSnap.size,
    woCreated: created,
    overdueMarked: overdue,
    details: [`Created ${created} WOs, ${overdue} overdue`],
  })

  return { created, overdue }
}

// ─── markOverduePmWorkOrders ──────────────────────────────────────────────

export async function markOverduePmWorkOrders(): Promise<number> {
  const snap = await getDocs(
    query(
      collection(db, 'pmWorkOrders'),
      where('status', '==', 'scheduled'),
      where('dueDate', '<', Timestamp.now()),
    ),
  )

  if (snap.empty) return 0

  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.update(d.ref, { status: 'overdue' }))
  await batch.commit()
  return snap.size
}

// ─── updateNextDueDateAfterCompletion ──────────────────────────────────────

export async function updateNextDueDateAfterCompletion(
  scheduleId: string,
  completedDate: Date,
): Promise<void> {
  const schedDoc = await getDoc(doc(db, 'pmSchedules', scheduleId))
  if (!schedDoc.exists()) return

  const sched = schedDoc.data() as PMSchedule
  const nextDue = computeNextDueDate(sched, completedDate)

  await updateDoc(schedDoc.ref, {
    lastExecutedDate: Timestamp.fromDate(completedDate),
    nextDueDate: Timestamp.fromDate(nextDue),
    updatedAt: Timestamp.now(),
  })
}
