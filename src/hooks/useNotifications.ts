import { useState, useEffect, useCallback } from 'react'
import { listenNotifications, markNotificationRead, markAllNotificationsRead } from '@/firebase/db'
import type { NotificationItem } from '@/firebase/types'

export type Notification = NotificationItem & { id: string }

export function useNotifications(uid: string | undefined) {
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setItems([])
      setUnreadCount(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const unsubscribe = listenNotifications(uid, (notifications) => {
      setItems(notifications)
      setUnreadCount(notifications.length)
      setIsLoading(false)
    })

    return unsubscribe
  }, [uid])

  const markRead = useCallback(
    async (id: string) => {
      if (!uid) return
      await markNotificationRead(uid, id)
    },
    [uid],
  )

  const markAllRead = useCallback(async () => {
    if (!uid || !items.length) return
    const ids = items.map((i) => i.id)
    await markAllNotificationsRead(uid, ids)
  }, [uid, items])

  return { items, unreadCount, isLoading, markRead, markAllRead }
}
