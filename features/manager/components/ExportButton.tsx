import { cn } from "../../../libs/utils";
import {
  currentPeriodSuffix,
  downloadCsv,
  type CsvRows,
} from "../exportUtils";

interface ExportButtonProps {
  rows: CsvRows;
  filename: string;
  title: string;
  label?: string;
  className?: string;
}

/** Botão de exportação CSV (Excel-compatível) de um bloco do dashboard. */
export function ExportButton({
  rows,
  filename,
  title,
  label = "CSV",
  className,
}: ExportButtonProps) {
  function handleExport() {
    downloadCsv(`${filename}${currentPeriodSuffix()}`, rows);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      aria-label={`Exportar ${title} em CSV`}
      title="Exportar CSV (abre no Excel)"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#378ADD]/40",
        className,
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      {label}
    </button>
  );
}

export default ExportButton;
