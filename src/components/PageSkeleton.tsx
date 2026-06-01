function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`skeleton-line ${className}`} />
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-white/[0.07] p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <SkeletonLine className="h-3 w-24" />
          <SkeletonLine className="h-7 w-16" />
          <SkeletonLine className="h-2.5 w-32" />
        </div>
        <SkeletonLine className="w-10 h-10 rounded-xl" />
      </div>
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="bg-white rounded-xl border border-white/[0.07] p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <SkeletonLine className="h-4 w-32" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <SkeletonLine className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <SkeletonLine className="h-3 w-48" />
            <SkeletonLine className="h-2.5 w-24" />
          </div>
          <SkeletonLine className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl border border-white/[0.07] p-4">
      <div className="flex items-center justify-between mb-4">
        <SkeletonLine className="h-4 w-40" />
        <SkeletonLine className="h-3 w-12" />
      </div>
      <div className="flex items-end gap-2 h-36 px-2">
        {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
          <div key={i} className="flex-1 bg-t1 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex justify-between mt-2 px-2">
        {[...Array(7)].map((_, i) => (
          <SkeletonLine key={i} className="h-2 w-6" />
        ))}
      </div>
    </div>
  )
}

export default function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Page header */}
      <div className="space-y-1">
        <SkeletonLine className="h-5 w-32" />
        <SkeletonLine className="h-3 w-48" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>

      {/* Chart + table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonTable />
      </div>
    </div>
  )
}
