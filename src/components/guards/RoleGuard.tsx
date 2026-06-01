import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import type { Department } from '@/firebase/types'

interface RoleGuardProps {
  children: React.ReactNode
  allowed?: Department[]
}

export default function RoleGuard({ children, allowed }: RoleGuardProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowed && !allowed.includes(user.dept) && user.dept !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
