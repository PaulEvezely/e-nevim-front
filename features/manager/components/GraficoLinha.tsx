import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { ChartEmpty } from "./ChartEmpty";
import { GRID_COLOR, PRIMARY_FILL, TOOLTIP_STYLE } from "./chartTheme";
import {
  formatMonthLabel,
  formatNumber,
  toMonthlySeries,
} from "../dashboardUtils";
import { monthlyCsvRows } from "../exportUtils";
import { useReducedMotion } from "../../../shared/hooks/useReducedMotion";

interface GraficoLinhaProps {
  title: string;
  subtitle?: string;
  data?: Record<string, number>;
  color?: string;
  height?: number;
  actions?: ReactNode;
}

/** Série temporal mensal (`porMes`) com curva suave. */
export function GraficoLinha({
  title,
  subtitle,
  data,
  color = PRIMARY_FILL,
  height = 240,
  actions,
}: GraficoLinhaProps) {
  const rows = toMonthlySeries(data).map((row) => ({
    key: row.key,
    name: formatMonthLabel(row.key),
    value: row.value,
  }));
  const exportRows = monthlyCsvRows(data);
  const prefersReducedMotion = useReducedMotion();
  const chartDescription = `Gráfico de linha: ${title}, ${rows.length} ponto(s) no tempo.`;

  if (rows.length === 0) {
    return (
      <ChartCard
        title={title}
        subtitle={subtitle}
        actions={actions}
        exportRows={exportRows}
      >
        <ChartEmpty />
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
      <ResponsiveContainer
        width="100%"
        height={height}
        initialDimension={{ width: 640, height }}
        role="img"
        aria-roledescription="gráfico"
        aria-label={chartDescription}
      >
        <LineChart
          data={rows}
          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#374151", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            type="number"
            tick={{ fill: "#6B7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value) => [formatNumber(Number(value)), "Total"]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: color, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={!prefersReducedMotion}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export default GraficoLinha;
