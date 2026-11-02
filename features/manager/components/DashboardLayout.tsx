import type { ReactNode } from "react";
import { GraficoBarras } from "./GraficoBarras";
import { GraficoBarrasHorizontal } from "./GraficoBarrasHorizontal";
import { GraficoDonut } from "./GraficoDonut";
import { GraficoLinha } from "./GraficoLinha";
import { KpiRow } from "./KpiRow";
import { DashboardSectionContext } from "./ChartCard";
import { ExportButton } from "./ExportButton";
import {
  RISK_COLORS,
  STATUS_COLORS,
  type DashboardData,
  type DashboardPeriod,
} from "../dashboardUtils";
import { buildDashboardCsvRows, slugify } from "../exportUtils";

interface DashboardSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

function DashboardSection({ title, description, children }: DashboardSectionProps) {
  return (
    <DashboardSectionContext.Provider value={slugify(title)}>
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800 lg:text-lg">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-sm text-gray-600">{description}</p>
          ) : null}
        </div>
        {children}
      </section>
    </DashboardSectionContext.Provider>
  );
}

interface DashboardLayoutProps {
  data: DashboardData;
  period: DashboardPeriod;
}

/** Conteúdo analítico completo (KPIs + 7 blocos), na ordem do fluxo NEVIM. */
export function DashboardLayout({ data, period }: DashboardLayoutProps) {
  const exportRows = buildDashboardCsvRows(data, period);

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <ExportButton
          rows={exportRows}
          filename="dashboard-nevim"
          title="todos os indicadores"
          label="Exportar tudo (CSV)"
        />
      </div>

      <KpiRow
        summary={data.summary}
        taxaConversao={data.demandas.taxaConversao ?? 0}
      />

      <DashboardSection
        title="Demandas"
        description="Entrada do fluxo: origem, perfil da solicitante e evolução no período."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <GraficoBarras
            title="Por status"
            data={data.demandas.porStatus}
            colorMap={STATUS_COLORS}
            showPercent
          />
          <GraficoLinha
            title="Evolução mensal"
            data={data.demandas.porMes}
            color="#854F0B"
          />
          <GraficoBarrasHorizontal
            title="Por tipo de violência"
            data={data.demandas.porTipoViolencia}
            showPercent
          />
          <GraficoBarras
            title="Por vínculo com a instituição"
            data={data.demandas.porVinculo}
            showPercent
          />
          <GraficoBarras
            title="Por campus"
            data={data.demandas.porCampus}
            showPercent
          />
          <GraficoBarras
            title="Local de ocorrência"
            data={data.demandas.porLocalOcorrencia}
            showPercent
          />
        </div>
        <GraficoBarrasHorizontal
          title="Por curso"
          data={data.demandas.porCurso}
          height={320}
          showPercent
        />
      </DashboardSection>

      <DashboardSection
        title="Processos"
        description="Pipeline de atendimento: status, destino, risco e abertura por mês."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <GraficoBarras
            title="Por status"
            data={data.processos.porStatus}
            colorMap={STATUS_COLORS}
            showPercent
          />
          <GraficoBarras
            title="Por nível de risco"
            data={data.processos.porRisco}
            colorMap={RISK_COLORS}
            showPercent
          />
          <GraficoBarras
            title="Encaminhado para"
            data={data.processos.porDirecionadoPara}
            showPercent
          />
          <GraficoLinha
            title="Abertos por mês"
            data={data.processos.porMes}
            color="#0C447C"
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Consultas"
        description="Execução dos atendimentos: status, profissional e evolução mensal."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <GraficoBarras
            title="Por status"
            data={data.consultas.porStatus}
            colorMap={STATUS_COLORS}
            showPercent
          />
          <GraficoBarras
            title="Por profissional"
            data={data.consultas.porTipoProfissional}
            showPercent
          />
          <GraficoLinha
            title="Evolução mensal"
            data={data.consultas.porMes}
            color="#27500A"
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Risco e encaminhamentos"
        description="Classificação FRIDA e destino dos casos encaminhados."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <GraficoDonut
            title="FRIDA por nível de risco"
            data={data.frida.porNivelRisco}
          />
          <GraficoBarras
            title="Encaminhamentos por destino"
            data={data.encaminhamentos.porDestino}
            showPercent
          />
          <GraficoLinha
            title="Encaminhamentos por mês"
            data={data.encaminhamentos.porMes}
            color="#791F1F"
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Perfil demográfico"
        description={`Base de ${data.demografico.total} caso(s) com processo aberto no período.`}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <GraficoBarrasHorizontal
            title="Por sexo"
            data={data.demografico.porSexo}
            showPercent
          />
          <GraficoBarrasHorizontal
            title="Por gênero"
            data={data.demografico.porGenero}
            showPercent
          />
          <GraficoBarrasHorizontal
            title="Por etnia"
            data={data.demografico.porEtnia}
            showPercent
          />
          <GraficoBarrasHorizontal
            title="Por faixa etária"
            data={data.demografico.porFaixaIdade}
            height={320}
            showPercent
          />
        </div>
      </DashboardSection>
    </div>
  );
}

export default DashboardLayout;
