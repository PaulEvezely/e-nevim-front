import { cn } from "../../libs/utils";

interface SpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_STYLES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-3",
  lg: "w-12 h-12 border-4",
};

/** Indicador de carregamento (RFF11). */
export function Spinner({ label, size = "md", className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? "Carregando"}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "rounded-full animate-spin border-[#E6F1FB] border-t-[#378ADD]",
          SIZE_STYLES[size],
        )}
      />
      {label ? (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      ) : null}
    </span>
  );
}

export default Spinner;
