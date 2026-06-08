import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AuthGuard from '@/components/AuthGuard'
import AppShell from '@/layouts/AppShell'
import LoginPage from '@/pages/LoginPage'
import PageSkeleton from '@/components/PageSkeleton'
import { ToastContainer } from '@/components/ui/Toast'
import { Loader2 } from 'lucide-react'

const DashboardPage = lazy(() => import('@/modules/dashboard/DashboardPage'))
const AdminUsersPage = lazy(() => import('@/modules/admin/AdminUsersPage'))
const AdminNotificationsPage = lazy(() => import('@/modules/admin/AdminNotificationsPage'))
const OrgPage = lazy(() => import('@/modules/org/OrgPage'))
const InfraPage = lazy(() => import('@/modules/infra/InfraPage'))
const MaintenancePage = lazy(() => import('@/modules/maintenance/MaintenancePage'))
const FireSafetyPage = lazy(() => import('@/modules/fire-safety/FireSafetyPage'))
const CivilWorksPage = lazy(() => import('@/modules/civil/CivilWorksPage'))
const MedicalDevicesPage = lazy(() => import('@/modules/medical-devices/MedicalDevicesPage'))
const CompliancePage = lazy(() => import('@/modules/compliance/CompliancePage'))
const WarehousePage = lazy(() => import('@/modules/warehouse/WarehousePage'))
const AssetsPage = lazy(() => import('@/modules/assets/AssetsPage'))
const VendorsPage = lazy(() => import('@/modules/vendors/VendorsPage'))
const EnvironmentPage = lazy(() => import('@/modules/environment/EnvironmentPage'))
const ReportsPage = lazy(() => import('@/modules/reports/ReportsPage'))
const FiveSPage = lazy(() => import('@/modules/fiveS/FiveSPage'))
const PatrolPage = lazy(() => import('@/modules/patrol/PatrolPage'))
const TrainingPage = lazy(() => import('@/modules/training/TrainingPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function RedirectIfAuth() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-ink">
        <Loader2 className="w-8 h-8 animate-spin text-amber" />
      </div>
    )
  }
  return user ? <Navigate to="/" replace /> : null
}

function PageFallback() {
  return <PageSkeleton />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastContainer />
          <Routes>
            {/* Public */}
            <Route
              path="/login"
              element={
                <>
                  <RedirectIfAuth />
                  <LoginPage />
                </>
              }
            />

            {/* Protected */}
            <Route
              element={
                <AuthGuard>
                  <AppShell />
                </AuthGuard>
              }
            >
              <Route
                path="/"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <DashboardPage />
                  </Suspense>
                }
              />
              <Route
                path="/org"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <OrgPage />
                  </Suspense>
                }
              />
              <Route
                path="/infra"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <InfraPage />
                  </Suspense>
                }
              />
              <Route
                path="/maintenance"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <MaintenancePage />
                  </Suspense>
                }
              />
              <Route
                path="/fire-safety"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <FireSafetyPage />
                  </Suspense>
                }
              />
              <Route
                path="/civil"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CivilWorksPage />
                  </Suspense>
                }
              />
              <Route
                path="/medical-devices"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <MedicalDevicesPage />
                  </Suspense>
                }
              />
              <Route
                path="/compliance"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CompliancePage />
                  </Suspense>
                }
              />
              <Route
                path="/warehouse"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <WarehousePage />
                  </Suspense>
                }
              />
              <Route
                path="/assets"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <AssetsPage />
                  </Suspense>
                }
              />
              <Route
                path="/vendors"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <VendorsPage />
                  </Suspense>
                }
              />
              <Route
                path="/environment"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <EnvironmentPage />
                  </Suspense>
                }
              />
              <Route
                path="/reports"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <ReportsPage />
                  </Suspense>
                }
              />
              <Route
                path="/five-s"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <FiveSPage />
                  </Suspense>
                }
              />
              <Route
                path="/patrol"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <PatrolPage />
                  </Suspense>
                }
              />
              <Route
                path="/training"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <TrainingPage />
                  </Suspense>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <AuthGuard requiredRole="admin">
                      <AdminUsersPage />
                    </AuthGuard>
                  </Suspense>
                }
              />
              <Route
                path="/admin/notifications"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <AuthGuard requiredRole="admin">
                      <AdminNotificationsPage />
                    </AuthGuard>
                  </Suspense>
                }
              />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
