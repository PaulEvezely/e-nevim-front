import { cn } from "../../libs/utils";

interface LoadingOverlayProps {
  open: boolean;
  message?: string;
}

/** Overlay de carregamento p/ requisições perceptíveis (RFF11). */
export function LoadingOverlay({ open, message }: LoadingOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-40 flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="bg-white rounded-xl shadow-xl p-6 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#E6F1FB] border-t-[#378ADD] rounded-full animate-spin" />
        {message ? (
          <p className="text-sm font-medium text-gray-700">{message}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-stone-200", className)}
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

/** Placeholder de conteúdo em carregamento (RFF11). */
export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-white rounded-xl border border-stone-200 p-4 space-y-3",
        className,
      )}
    >
      <Skeleton className="h-5 w-2/5" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className={cn("h-4", index === lines - 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}

export default LoadingOverlay;
