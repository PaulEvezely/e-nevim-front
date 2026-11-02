import { KpiCard } from "../../../shared/components/KpiCard";
import { RiskSummaryCard } from "./RiskSummaryCard";
import {
  formatNumber,
  type DashboardSummary,
} from "../dashboardUtils";

interface KpiRowProps {
  summary: DashboardSummary;
  taxaConversao: number;
}

/** Faixa de KPIs gerais + card de distribuição de risco (FRIDA). */
export function KpiRow({ summary, taxaConversao }: KpiRowProps) {
  const demandas = summary.demandas ?? {};
  const processos = summary.processos ?? {};

  const pendentes = demandas.PENDENTE ?? 0;
  const aprovadas = demandas.APROVADA ?? 0;
  const rejeitadas = demandas.REJEITADA ?? 0;
  const ativos =
    (processos.ABERTO ?? 0) +
    (processos.EM_TRIAGEM ?? 0) +
    (processos.ENCAMINHADO ?? 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Demandas pendentes"
        value={formatNumber(pendentes)}
        subtitle="aguardando análise"
        icon="alert"
        tone={pendentes > 0 ? "danger" : "neutral"}
      />
      <KpiCard
        title="Demandas aprovadas"
        value={formatNumber(aprovadas)}
        subtitle="convertidas ou em cadastro"
        icon="inbox"
        tone="info"
      />
      <KpiCard
        title="Demandas rejeitadas"
        value={formatNumber(rejeitadas)}
        subtitle="no período"
        icon="inbox"
        tone="neutral"
      />
      <KpiCard
        title="Processos ativos"
        value={formatNumber(ativos)}
        subtitle="abertos, em triagem ou encaminhados"
        icon="inbox"
        tone="info"
      />
      <KpiCard
        title="Consultas na semana"
        value={formatNumber(summary.consultasSemana ?? 0)}
        subtitle="semana corrente"
        icon="clock"
        tone="info"
      />
      <KpiCard
        title="Taxa de conversão"
        value={`${taxaConversao.toFixed(1)}%`}
        subtitle="aprovadas → processos"
        icon="inbox"
        tone="neutral"
      />
      <RiskSummaryCard title="Risco no FRIDA" data={summary.risco?.frida} />
    </div>
  );
}

export default KpiRow;
