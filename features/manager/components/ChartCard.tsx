import {
  createContext,
  useContext,
  useId,
  type ReactNode,
} from "react";
import { cn } from "../../../libs/utils";
import { ExportButton } from "./ExportButton";
import { slugify, type CsvRows } from "../exportUtils";

/**
 * Nome da seção atual (ex.: `demandas`), usado para compor o nome do CSV
 * de cada bloco sem precisar repassar props por todos os gráficos.
 */
export const DashboardSectionContext = createContext<string>("");

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  exportRows?: CsvRows;
  children: ReactNode;
  className?: string;
}

/** Moldura padrão dos blocos de dashboard (título + área do gráfico). */
export function ChartCard({
  title,
  subtitle,
  actions,
  exportRows,
  children,
  className,
}: ChartCardProps) {
  const section = useContext(DashboardSectionContext);
  const titleId = useId();
  const exportFilename =
    [section, slugify(title)].filter(Boolean).join("-") || "dashboard";
  const canExport = Boolean(exportRows && exportRows.length > 1);

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      className={cn(
        "overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-stone-200 bg-stone-100 px-4 py-3">
        <div className="min-w-0">
          <h3 id={titleId} className="text-sm font-semibold text-gray-800">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-gray-600">{subtitle}</p>
          ) : null}
        </div>
        {actions || canExport ? (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {canExport && exportRows ? (
              <ExportButton
                rows={exportRows}
                filename={exportFilename}
                title={title}
              />
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default ChartCard;
