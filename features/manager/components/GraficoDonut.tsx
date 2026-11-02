import type { ReactNode } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { ChartEmpty } from "./ChartEmpty";
import { TOOLTIP_STYLE } from "./chartTheme";
import {
  RISK_COLORS,
  formatNumber,
  labelFor,
  toChartData,
} from "../dashboardUtils";
import { donutCsvRows } from "../exportUtils";
import { useReducedMotion } from "../../../shared/hooks/useReducedMotion";

interface GraficoDonutProps {
  title: string;
  subtitle?: string;
  data?: Record<string, number>;
  centerLabel?: string;
  height?: number;
  actions?: ReactNode;
}

/** Distribuição por nível de risco (FRIDA) em donut com legenda própria. */
export function GraficoDonut({
  title,
  subtitle,
  data,
  centerLabel = "FRIDAs",
  height = 240,
  actions,
}: GraficoDonutProps) {
  const rows = toChartData(data, RISK_COLORS).map((row) => ({
    key: row.key,
    name: labelFor(row.key),
    value: row.value,
    fill: row.text,
  }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const exportRows = donutCsvRows(data);
  const prefersReducedMotion = useReducedMotion();
  const chartDescription = `Gráfico de rosca: ${title}, ${rows.length} categoria(s), total ${formatNumber(total)}.`;

  if (rows.length === 0) {
    return (
      <ChartCard
        title={title}
        subtitle={subtitle}
        actions={actions}
        exportRows={exportRows}
      >
        <ChartEmpty message="Nenhum FRIDA preenchido no período." />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      actions={actions}
      exportRows={exportRows}
    >
      <div className="relative">
        <ResponsiveContainer
          width="100%"
          height={height}
          initialDimension={{ width: 640, height }}
          role="img"
          aria-roledescription="gráfico"
          aria-label={chartDescription}
        >
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="84%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={!prefersReducedMotion}
            >
              {rows.map((row) => (
                <Cell key={row.key} fill={row.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatNumber(Number(value)), "FRIDAs"]}
              contentStyle={TOOLTIP_STYLE}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none text-gray-800">
            {formatNumber(total)}
          </span>
          <span className="mt-1 text-xs text-gray-500">{centerLabel}</span>
        </div>
      </div>

      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => {
          const pct = total > 0 ? (row.value / total) * 100 : 0;
          return (
            <li
              key={row.key}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="inline-flex items-center gap-2 text-gray-700">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: row.fill }}
                />
                {row.name}
              </span>
              <span className="text-gray-500">
                {formatNumber(row.value)} · {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

export default GraficoDonut;
