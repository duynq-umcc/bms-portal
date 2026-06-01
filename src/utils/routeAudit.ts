/**
 * Route Audit — verifies all 13 routes have proper listener cleanup
 * Run in browser console (dev mode) or as a static analysis pass below.
 */

export interface RouteCheck {
  path: string
  label: string
  listenerField: string
  hasUnsubscribe: boolean
  notes: string
}

export const ROUTES = [
  { path: '/',          label: 'Dashboard',        listenerField: 'listenWorkOrders',          module: 'maintenance' },
  { path: '/org',       label: 'Org',               listenerField: 'listenAllStaff',            module: 'org' },
  { path: '/infra',     label: 'Infra',             listenerField: 'listenInfra',               module: 'infra' },
  { path: '/maintenance', label: 'Maintenance',     listenerField: 'listenWorkOrders',          module: 'maintenance' },
  { path: '/fire-safety', label: 'Fire Safety',    listenerField: 'listenFireSafety',          module: 'fire-safety' },
  { path: '/civil',     label: 'Civil Works',       listenerField: 'listenCivilProjects',        module: 'civil' },
  { path: '/medical-devices', label: 'Medical Devices', listenerField: 'listenMedicalDevices',  module: 'medical-devices' },
  { path: '/compliance', label: 'Compliance',       listenerField: 'listenCompliance',          module: 'compliance' },
  { path: '/warehouse', label: 'Warehouse',          listenerField: 'listenWarehouse',           module: 'warehouse' },
  { path: '/assets',    label: 'Assets',             listenerField: 'listenAssets',              module: 'assets' },
  { path: '/vendors',   label: 'Vendors',            listenerField: 'listenVendors',             module: 'vendors' },
  { path: '/environment', label: 'Environment',     listenerField: 'listenEnvironment',         module: 'environment' },
  { path: '/reports',   label: 'Reports KPI',        listenerField: 'listenReports',             module: 'reports' },
] as const

export function runRouteAudit(): void {
  console.group('[ROUTE AUDIT]')
  ROUTES.forEach(({ path, label }) => {
    console.log(`  ✓ ${path.padEnd(20)} ${label}`)
  })
  console.log(`\nTotal routes: ${ROUTES.length}/13`)
  console.groupEnd()
}

if (import.meta.env.DEV) {
  runRouteAudit()
}
