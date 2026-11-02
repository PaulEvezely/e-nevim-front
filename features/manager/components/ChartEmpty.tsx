interface ChartEmptyProps {
  message?: string;
}

/** Estado vazio padrão dos gráficos (sem dados no período). */
export function ChartEmpty({
  message = "Nenhum dado no período selecionado.",
}: ChartEmptyProps) {
  return (
    <div
      className="flex h-[220px] flex-col items-center justify-center gap-2 text-center"
      role="status"
    >
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-stone-300"
        aria-hidden="true"
      >
        <path d="M3 3v18h18" />
        <path d="M7 15l3-4 3 2 4-6" />
      </svg>
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}

export default ChartEmpty;
