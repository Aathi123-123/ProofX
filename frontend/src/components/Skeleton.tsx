/**
 * Reusable skeleton shimmer components for loading states.
 * Using these instead of a spinner makes pages feel much faster.
 */

function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-[hsl(217.2,32.6%,15%)] rounded-lg animate-pulse ${className}`}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Shimmer className="h-7 w-48" />
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-8 w-8 rounded-lg" />
            </div>
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Chart area */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-5">
          <Shimmer className="h-4 w-32 mb-4" />
          <Shimmer className="h-48 w-full" />
        </div>
        <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-5">
          <Shimmer className="h-4 w-32 mb-4" />
          <Shimmer className="h-48 w-full" />
        </div>
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-7 w-32" />
          <Shimmer className="h-4 w-20" />
        </div>
        <Shimmer className="h-10 w-32 rounded-lg" />
      </div>
      {/* Rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shimmer className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Shimmer className="h-4 w-40" />
                <Shimmer className="h-3 w-28" />
              </div>
            </div>
            <Shimmer className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Shimmer className="h-4 w-20" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-56" />
          <Shimmer className="h-4 w-32" />
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-9 w-32 rounded-lg" />
          <Shimmer className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-4 flex items-center gap-3">
            <Shimmer className="h-6 w-6 rounded" />
            <div className="space-y-1.5">
              <Shimmer className="h-5 w-10" />
              <Shimmer className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(217.2,32.6%,13%)]">
          <Shimmer className="h-4 w-28" />
        </div>
        <div className="divide-y divide-[hsl(217.2,32.6%,10%)]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-6">
              <Shimmer className="h-4 w-48" />
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-5 w-14 rounded-md" />
              <Shimmer className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="space-y-2">
        <Shimmer className="h-7 w-28" />
        <Shimmer className="h-4 w-48" />
      </div>
      <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-6 space-y-4">
        <Shimmer className="h-4 w-24" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Shimmer key={i} className="h-16 rounded-lg" />)}
        </div>
      </div>
      <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(217.2,32.6%,13%)]">
          <Shimmer className="h-4 w-32" />
          <Shimmer className="h-8 w-24 rounded-lg" />
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="px-4 py-3 flex items-center gap-6 border-b border-[hsl(217.2,32.6%,10%)]">
            <div className="space-y-1.5">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-20" />
            </div>
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-5 w-20 rounded-md" />
            <Shimmer className="h-5 w-14 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
