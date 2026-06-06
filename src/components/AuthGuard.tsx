import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: string
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-ink">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber" />
          <p className="text-t2 text-sm">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    toast.error('Không có quyền truy cập')
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
