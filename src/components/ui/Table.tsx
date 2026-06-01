import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse bg-white/[0.06] rounded ${className}`} />
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

export function LoadingSpinner({ message = 'Đang tải...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-amber" />
      <p className="text-sm text-t2">{message}</p>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: () => void
  actionLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-white/[0.05] rounded-full flex items-center justify-center mb-4 text-t3">
        {Icon}
      </div>
      <h3 className="text-base font-semibold text-gray-200 mb-1">{title}</h3>
      <p className="text-sm text-t2 max-w-xs mb-4">{description}</p>
      {action && actionLabel && (
        <button onClick={action} className="btn-primary">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
