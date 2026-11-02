import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { ChartEmpty } from "./ChartEmpty";
import { CURSOR_FILL, GRID_COLOR, TOOLTIP_STYLE } from "./chartTheme";
import {
  formatNumber,
  labelFor,
  toChartData,
  type StatusColorMap,
} from "../dashboardUtils";
import { categoricalCsvRows } from "../exportUtils";
import { useReducedMotion } from "../../../shared/hooks/useReducedMotion";

interface GraficoBarrasProps {
  title: string;
  subtitle?: string;
  data?: Record<string, number>;
  colorMap?: StatusColorMap;
  horizontal?: boolean;
  height?: number;
  actions?: ReactNode;
  showPercent?: boolean;
}

const Y_TICK_MAX_CHARS = 24;
const HORIZONTAL_MIN_ROWS = 5;
const HORIZONTAL_MIN_NAME_LENGTH = 12;

/** Trunca rótulos longos com "…"; o nome completo continua no tooltip. */
function truncateLabel(value: string, max: number = Y_TICK_MAX_CHARS): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Barras verticais ou horizontais com cores semânticas do PRD. */
export function GraficoBarras({
  title,
  subtitle,
  data,
  colorMap,
  horizontal = false,
  height = 260,
  actions,
  showPercent = false,
}: GraficoBarrasProps) {
  const rows = toChartData(data, colorMap).map((row) => ({
    key: row.key,
    name: labelFor(row.key),
    value: row.value,
    fill: row.text,
  }));
  const exportRows = categoricalCsvRows(data);
  const prefersReducedMotion = useReducedMotion();

  const longestName = rows.reduce(
    (max, row) => Math.max(max, row.name.length),
    0,
  );
  const isHorizontal =
    horizontal ||
    rows.length > HORIZONTAL_MIN_ROWS ||
    rows.some((row) => row.name.length > HORIZONTAL_MIN_NAME_LENGTH);
  const rotateLabels = !isHorizontal && rows.length > 5;
  // Altura cresce com a quantidade de linhas no modo horizontal.
  const effectiveHeight = isHorizontal
    ? Math.max(height, 140 + rows.length * 42)
    : height;
  // Largura do eixo Y acompanha o maior rótulo (com teto).
  const yAxisWidth = isHorizontal
    ? Math.min(
        240,
        Math.max(140, Math.min(longestName, Y_TICK_MAX_CHARS) * 7),
      )
    : 140;
  const chartDescription = `Gráfico de ${
    isHorizontal ? "barras horizontais" : "barras"
  }: ${title}, ${rows.length} categoria(s).`;

  const total = rows.reduce((sum, row) => sum + row.value, 0);

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

  // Dados truncados apenas para exibição; tooltip mantém nome completo.
  const displayRows = rows.map((row) => ({
    ...row,
    displayName: isHorizontal ? truncateLabel(row.name) : row.name,
  }));

  const xAxisHeight = rotateLabels
    ? Math.min(96, 30 + Math.min(longestName, 20) * 1.6)
    : 30;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      actions={actions}
      exportRows={exportRows}
    >
      <ResponsiveContainer
        width="100%"
        height={effectiveHeight}
        initialDimension={{ width: 640, height: effectiveHeight }}
        role="img"
        aria-roledescription="gráfico"
        aria-label={chartDescription}
      >
        <BarChart
          data={isHorizontal ? displayRows : rows}
          layout={isHorizontal ? "vertical" : "horizontal"}
          margin={{
            top: 8,
            right: 16,
            left: isHorizontal ? 8 : 0,
            bottom: rotateLabels ? 8 : 4,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={GRID_COLOR}
            vertical={isHorizontal}
            horizontal={!isHorizontal}
          />
          {isHorizontal ? (
            <>
              <XAxis
                type="number"
                tick={{ fill: "#6B7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="displayName"
                width={yAxisWidth}
                tick={{ fill: "#374151", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fill: "#374151", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={
                  rows.length > 6 ? ("preserveStartEnd" as const) : 0
                }
                angle={rotateLabels ? -25 : 0}
                textAnchor={rotateLabels ? "end" : "middle"}
                height={xAxisHeight}
              />
              <YAxis
                type="number"
                tick={{ fill: "#6B7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
            </>
          )}
          <Tooltip
            formatter={(value) => {
              const num = Number(value);
              const pct = total > 0 ? (num / total) * 100 : 0;
              return [
                `${formatNumber(num)} · ${pct.toFixed(1)}%`,
                "Total",
              ];
            }}
            labelFormatter={(label: unknown) => {
              if (!isHorizontal) return String(label ?? "");
              const text = String(label ?? "");
              const match = displayRows.find(
                (row) => row.displayName === text,
              );
              return match ? match.name : text;
            }}
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: CURSOR_FILL }}
          />
          <Bar
            dataKey="value"
            radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={44}
            isAnimationActive={!prefersReducedMotion}
          >
            {rows.map((row) => (
              <Cell key={row.key} fill={row.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {showPercent ? (
        <ul className="mt-3 space-y-1.5">
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
      ) : null}
    </ChartCard>
  );
}

export default GraficoBarras;
