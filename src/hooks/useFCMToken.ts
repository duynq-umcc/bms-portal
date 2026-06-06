import { useEffect } from 'react'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/contexts/AuthContext'
import app from '@/firebase/config'

export function useFCMToken() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    if (!('Notification' in window)) return
    if (Notification.permission === 'denied') return

    const init = async () => {
      try {
        const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
        const messaging = getMessaging(app)

        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: sw,
        })

        if (!token) return

        await updateDoc(doc(db, 'users', user.uid), {
          fcmTokens: arrayUnion(token),
          lastTokenUpdate: Timestamp.now(),
        })

        if (import.meta.env.DEV) {
          console.log('[FCM] Token registered:', token.slice(0, 20) + '...')
        }
      } catch (err) {
        const e = err as Error
        console.warn('[FCM] getToken failed:', e.message)
      }
    }

    init()

    const messaging = getMessaging(app)
    const unsub = onMessage(messaging, (payload) => {
      if (import.meta.env.DEV) {
        console.log('[FCM] Foreground message:', payload)
      }
    })

    return unsub
  }, [user])
}
