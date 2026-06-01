import { getDocs, collection } from 'firebase/firestore'
import { db } from '@/firebase/config'

const COLLECTIONS = [
  'users',
  'org',
  'workOrders',
  'devices',
  'inventory',
  'systemReadings',
  'incidents',
  'vendors',
  'assets',
] as const

export type CollectionName = (typeof COLLECTIONS)[number]

export interface HealthResult {
  name: CollectionName
  exists: boolean
  count: number
  error?: string
}

export async function checkCollection(name: string): Promise<HealthResult> {
  try {
    const snap = await getDocs(collection(db, name))
    return { name: name as CollectionName, exists: true, count: snap.size }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { name: name as CollectionName, exists: false, count: 0, error: msg }
  }
}

export async function runHealthCheck(): Promise<HealthResult[]> {
  console.group('[FIRESTORE HEALTH CHECK]')
  console.log(`Checking ${COLLECTIONS.length} collections...`)

  const results = await Promise.all(COLLECTIONS.map((name) => checkCollection(name)))

  results.forEach((r) => {
    const status = r.exists ? (r.count > 0 ? '✓' : '⚠') : '✗'
    const info = r.count > 0 ? `(${r.count} docs)` : r.error ?? ''
    console.log(`  ${status} ${r.name.padEnd(20)} ${info}`)
  })

  const passCount = results.filter((r) => r.exists).length
  console.log(
    `\nSummary: ${passCount}/${results.length} collections accessible`
  )
  console.groupEnd()

  return results
}

if (import.meta.env.DEV) {
  runHealthCheck()
}
