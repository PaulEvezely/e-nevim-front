import { cn } from "../../../../libs/utils";
import { RISK_LEVEL_LABELS, type RiskLevel } from "../fridaTypes";

type FridaRiskBadgeProps = {
  level: RiskLevel;
  className?: string;
  /** Versão compacta para uso em listas/cartões. */
  compact?: boolean;
};

/** Cores semânticas do PRD §10.3 (nível de risco). */
const RISK_STYLES: Record<RiskLevel, { background: string; text: string }> = {
  BAIXO: { background: "#EAF3DE", text: "#27500A" },
  MEDIO: { background: "#FAEEDA", text: "#854F0B" },
  ELEVADO: { background: "#FCEBEB", text: "#791F1F" },
};

export function FridaRiskBadge({
  level,
  className,
  compact = false,
}: FridaRiskBadgeProps) {
  const style = RISK_STYLES[level];

  return (
    <span
      role="status"
      aria-label={`Nível de risco: ${RISK_LEVEL_LABELS[level]}`}
      style={{ backgroundColor: style.background, color: style.text }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-black/5 font-semibold",
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: style.text }}
        className="h-1.5 w-1.5 shrink-0 rounded-full"
      />
      {RISK_LEVEL_LABELS[level]}
    </span>
  );
}

export default FridaRiskBadge;
