import { addDoc, collection, query, getDocs, where, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'

export type NotifType = 'workOrder' | 'inventory' | 'device' | 'document' | 'system'
export type NotifPriority = 'low' | 'medium' | 'high' | 'urgent'

export async function createNotification(
  uid: string,
  payload: {
    title: string
    body: string
    type: NotifType
    link: string
    priority: NotifPriority
  },
) {
  await addDoc(collection(db, `notifications/${uid}/items`), {
    ...payload,
    isRead: false,
    createdAt: Timestamp.now(),
  })
}

export async function createNotificationForRoles(
  roles: string[],
  payload: {
    title: string
    body: string
    type: 'workOrder' | 'inventory' | 'device' | 'document' | 'system'
    link: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
  },
) {
  const usersSnap = await getDocs(
    query(collection(db, 'users'), where('role', 'in', roles)),
  )
  await Promise.all(usersSnap.docs.map((u) => createNotification(u.id, payload)))
}
