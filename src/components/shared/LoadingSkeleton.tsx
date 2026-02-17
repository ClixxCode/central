import { Skeleton } from '@/components/ui/skeleton';

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-4 flex-1 max-w-sm" />
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border rounded-lg">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/50">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function KanbanColumnSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex-shrink-0 w-72 bg-muted/50 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-8" />
      </div>
      {Array.from({ length: cards }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function KanbanBoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columns }).map((_, i) => (
        <KanbanColumnSkeleton key={i} cards={3 - (i % 2)} />
      ))}
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="w-64 border-r p-4 space-y-6">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-24" />
      </div>

      {/* Nav items */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* Clients */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SwimlaneSkeleton({ lanes = 4 }: { lanes?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: lanes }).map((_, i) => (
        <div key={i} className="border rounded-lg bg-card">
          {/* Lane header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-6 ml-2 rounded-full" />
          </div>
          {/* Task rows */}
          <div className="divide-y">
            {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
              <div key={j} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 flex-1 max-w-xs" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded" />
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PersonalRollupSkeleton({ clients = 3 }: { clients?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: clients }).map((_, i) => (
        <div key={i} className="border rounded-lg bg-card">
          {/* Client header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-6 ml-auto rounded-full" />
          </div>
          {/* Task cards */}
          <div className="p-2 space-y-2">
            {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
              <div key={j} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Skeleton className="h-2.5 w-2.5 rounded-full mt-1.5" />
                  <Skeleton className="h-4 flex-1 max-w-xs" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-6 rounded-full ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
