importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyBGhWzb7oHk6QvxyxsjxlYMJnmgN11OscY",
  authDomain: "bms-portal-firestore.firebaseapp.com",
  projectId: "bms-portal-firestore",
  storageBucket: "bms-portal-firestore.firebasestorage.app",
  messagingSenderId: "892534039368",
  appId: "1:892534039368:web:ddd92f5dd7ea3088bc897d"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification ?? {}
  const { type, link } = payload.data ?? {}

  const iconMap = {
    workOrder: '/icons/icon-192.svg',
    inventory: '/icons/icon-192.svg',
    device:    '/icons/icon-192.svg',
    document:  '/icons/icon-192.svg',
    system:    '/icons/icon-192.svg',
  }

  self.registration.showNotification(title ?? 'BMS Hospital', {
    body: body ?? '',
    icon: iconMap[type] ?? '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: link,
    data: { link },
    actions: [
      { action: 'view',    title: 'Xem ngay' },
      { action: 'dismiss', title: 'Bỏ qua'  }
    ],
    requireInteraction: type === 'urgent'
  })
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const link = event.notification.data?.link ?? '/'
  const url = `https://bms-portal-firestore.web.app${link}`

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const existing = list.find(c => c.url.includes('bms-portal-firestore.web.app'))
        if (existing) {
          existing.focus()
          existing.navigate(url)
        } else {
          clients.openWindow(url)
        }
      })
  )
})
