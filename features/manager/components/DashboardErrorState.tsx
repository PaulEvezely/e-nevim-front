interface DashboardErrorStateProps {
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

/** Falha de comunicação com o back-end, sem expor detalhes técnicos (RFF17). */
export function DashboardErrorState({
  message = "Não foi possível carregar os indicadores. Tente novamente em instantes.",
  onRetry,
  retrying = false,
}: DashboardErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]"
    >
      <span>{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="rounded-lg bg-[#791F1F] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#791F1F] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {retrying ? "Tentando…" : "Tentar novamente"}
        </button>
      ) : null}
    </div>
  );
}

export default DashboardErrorState;
