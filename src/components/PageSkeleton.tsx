import { Skeleton } from "./ui/skeleton";

interface PageSkeletonProps {
  type?: "table" | "cards" | "dashboard" | "pipeline";
}

function FilterBarSkeleton() {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-300 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="h-10 flex-1 min-w-[200px]" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr>
      <td className="px-6 py-4"><Skeleton className="h-4 w-4" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
      <td className="px-6 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
      <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
      <td className="px-6 py-4"><Skeleton className="h-8 w-16" /></td>
    </tr>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      <Skeleton className="h-8 w-20 mb-1" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

const CHART_BAR_HEIGHTS = [65, 45, 80, 55, 90, 40, 70];

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="flex items-end gap-2 h-48">
        {CHART_BAR_HEIGHTS.map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function TaskCardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-300 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full ml-8" />
      <div className="flex items-center gap-3 ml-8">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

function PipelineColumnSkeleton() {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border border-gray-200 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-20" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomPanelSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-300">
      <div className="p-6 border-b border-gray-300">
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="divide-y divide-gray-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({ type = "table" }: PageSkeletonProps) {
  if (type === "dashboard") {
    return (
      <div className="p-4 md:p-8 space-y-6">
        {/* Date range + actions */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>

        {/* Bottom panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BottomPanelSkeleton />
          <BottomPanelSkeleton />
        </div>
      </div>
    );
  }

  if (type === "cards") {
    return (
      <div className="p-8">
        <FilterBarSkeleton />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (type === "pipeline") {
    return (
      <div className="p-8">
        <FilterBarSkeleton />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <PipelineColumnSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Table type (default) — used by Leads, Deals
  return (
    <div className="p-4 md:p-8">
      <FilterBarSkeleton />
      <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-300">
              <tr>
                {Array.from({ length: 7 }).map((_, i) => (
                  <th key={i} className="px-6 py-3 text-left">
                    <Skeleton className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
