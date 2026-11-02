import type { ReactNode } from "react";
import { Skeleton } from "../../../shared/components/LoadingOverlay";

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <Skeleton className="h-9 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <Skeleton className="h-9 w-full rounded-none" />
      <div className="p-4">
        <div
          className="w-full animate-pulse rounded-xl bg-stone-200"
          style={{ height }}
        />
      </div>
    </div>
  );
}

function SectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      </div>
      {children}
    </section>
  );
}

/**
 * Placeholder da tela de dashboards durante o carregamento (RFF11).
 * Espelha a ordem e os grids de `DashboardLayout` para minimizar CLS.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-40" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <KpiSkeleton key={index} />
        ))}
      </div>

      <SectionSkeleton>
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton height={260} />
          <ChartSkeleton height={240} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
        </div>
        <ChartSkeleton height={320} />
      </SectionSkeleton>

      <SectionSkeleton>
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={240} />
        </div>
      </SectionSkeleton>

      <SectionSkeleton>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={240} />
        </div>
      </SectionSkeleton>

      <SectionSkeleton>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ChartSkeleton height={240} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={240} />
        </div>
      </SectionSkeleton>

      <SectionSkeleton>
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={320} />
        </div>
      </SectionSkeleton>
    </div>
  );
}

export default DashboardSkeleton;
