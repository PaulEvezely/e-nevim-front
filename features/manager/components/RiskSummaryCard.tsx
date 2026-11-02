import {
  RISK_COLORS,
  formatNumber,
  labelFor,
} from "../dashboardUtils";

const RISK_ORDER = ["BAIXO", "MEDIO", "ELEVADO"] as const;

interface RiskSummaryCardProps {
  title: string;
  data?: Record<string, number>;
}

/** Card compacto com total e distribuição por nível de risco (barra + legenda). */
export function RiskSummaryCard({ title, data }: RiskSummaryCardProps) {
  const total = RISK_ORDER.reduce((sum, key) => sum + (data?.[key] ?? 0), 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <p className="border-b border-stone-200 bg-stone-100 px-4 pb-2 pt-3 text-sm font-semibold text-gray-700">
        {title}
      </p>
      <div className="p-4">
        <p className="text-3xl font-bold leading-none text-gray-800">
          {formatNumber(total)}
        </p>
        <p className="mt-1 text-xs text-gray-500">casos classificados</p>

        <div
          className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-stone-200"
          role="img"
          aria-label={RISK_ORDER.map(
            (key) => `${labelFor(key)}: ${data?.[key] ?? 0}`,
          ).join(", ")}
        >
          {RISK_ORDER.map((key) => {
            const value = data?.[key] ?? 0;
            if (value === 0) return null;
            const width = total > 0 ? (value / total) * 100 : 0;
            return (
              <span
                key={key}
                style={{
                  width: `${width}%`,
                  backgroundColor: RISK_COLORS[key].text,
                }}
                title={`${labelFor(key)}: ${value}`}
              />
            );
          })}
        </div>

        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600">
          {RISK_ORDER.map((key) => (
            <li key={key} className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: RISK_COLORS[key].text }}
              />
              {labelFor(key)}:{" "}
              <strong className="font-semibold text-gray-700">
                {formatNumber(data?.[key] ?? 0)}
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default RiskSummaryCard;
