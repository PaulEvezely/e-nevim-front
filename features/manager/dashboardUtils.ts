/**
 * Tipos e helpers dos dashboards do gestor (RFF14/RFF15).
 * Espelham os contratos de `nevim-backend/src/routes/dashboard.routes.ts`.
 * Uso livre em loader (server) e componentes (client).
 */

/** Filtros aceitos por todos os endpoints de agregação (período + campus). */
export type DashboardPeriod = {
  de?: string;
  ate?: string;
  campus?: string;
};

/** Lê `de`/`ate`/`campus` da query string da tela. */
export function parseDashboardPeriod(
  searchParams: URLSearchParams,
): DashboardPeriod {
  const de = searchParams.get("de")?.trim() || undefined;
  const ate = searchParams.get("ate")?.trim() || undefined;
  const campus = searchParams.get("campus")?.trim() || undefined;
  return { de, ate, campus };
}

/**
 * Converte datas `AAAA-MM-DD` em limites ISO inclusivos para a API:
 * início do dia para `de` e fim do dia para `ate` (o back usa `gte`/`lte`).
 * `campus` é repassado sem conversão.
 */
export function toApiPeriod(period: DashboardPeriod): DashboardPeriod {
  const de = period.de
    ? period.de.length === 10
      ? `${period.de}T00:00:00.000Z`
      : period.de
    : undefined;
  const ate = period.ate
    ? period.ate.length === 10
      ? `${period.ate}T23:59:59.999Z`
      : period.ate
    : undefined;
  return { de, ate, campus: period.campus };
}

/** Rótulo curto do período selecionado para exibição no cabeçalho. */
export function formatPeriodLabel(period: DashboardPeriod): string {
  const fmt = (value?: string) => {
    if (!value) return null;
    const [year, month, day] = value.slice(0, 10).split("-");
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
  };
  const de = fmt(period.de);
  const ate = fmt(period.ate);
  if (de && ate) return `${de} a ${ate}`;
  if (de) return `A partir de ${de}`;
  if (ate) return `Até ${ate}`;
  return "Todo o período";
}

/** KPIs agregados de `GET /dashboard/summary`. */
export type DashboardSummary = {
  demandas: Record<string, number>;
  processos: Record<string, number>;
  consultasSemana?: number;
  risco?: {
    triagem: Record<string, number>;
    frida: Record<string, number>;
  };
};

/** `GET /dashboard/demandas`. */
export type DashboardDemandas = {
  porStatus: Record<string, number>;
  porTipoViolencia: Record<string, number>;
  porVinculo: Record<string, number>;
  porCampus: Record<string, number>;
  porLocalOcorrencia: Record<string, number>;
  porCurso: Record<string, number>;
  porMes: Record<string, number>;
  taxaConversao: number;
};

/** `GET /dashboard/processos`. */
export type DashboardProcessos = {
  porStatus: Record<string, number>;
  porDirecionadoPara: Record<string, number>;
  porRisco: Record<string, number>;
  porMes: Record<string, number>;
};

/** `GET /dashboard/consultas`. */
export type DashboardConsultas = {
  porStatus: Record<string, number>;
  porTipoProfissional: Record<string, number>;
  porMes: Record<string, number>;
};

/** `GET /dashboard/frida`. */
export type DashboardFrida = {
  porNivelRisco: Record<string, number>;
};

/** `GET /dashboard/encaminhamentos`. */
export type DashboardEncaminhamentos = {
  porDestino: Record<string, number>;
  porMes: Record<string, number>;
};

/** `GET /dashboard/demografico`. */
export type DashboardDemografico = {
  total: number;
  porSexo: Record<string, number>;
  porGenero: Record<string, number>;
  porEtnia: Record<string, number>;
  porFaixaIdade: Record<string, number>;
};

/** Payload consolidado consumido pela tela de dashboards. */
export type DashboardData = {
  summary: DashboardSummary;
  demandas: DashboardDemandas;
  processos: DashboardProcessos;
  consultas: DashboardConsultas;
  frida: DashboardFrida;
  encaminhamentos: DashboardEncaminhamentos;
  demografico: DashboardDemografico;
};

/** Par de cores (fundo/texto) usado em badges e gráficos. */
export type StatusColor = { bg: string; text: string };

/** Mapa de cores semânticas por chave de enum. */
export type StatusColorMap = Record<string, StatusColor>;

/** Cores semânticas do PRD §10.3 (nível de risco). */
export const RISK_COLORS: StatusColorMap = {
  BAIXO: { bg: "#EAF3DE", text: "#27500A" },
  MEDIO: { bg: "#FAEEDA", text: "#854F0B" },
  ELEVADO: { bg: "#FCEBEB", text: "#791F1F" },
};

/** Cores semânticas do PRD §10.2 (status do processo/demanda). */
export const STATUS_COLORS: StatusColorMap = {
  PENDENTE: { bg: "#FAEEDA", text: "#854F0B" },
  APROVADA: { bg: "#E6F1FB", text: "#0C447C" },
  REJEITADA: { bg: "#FCEBEB", text: "#791F1F" },
  ABERTO: { bg: "#E6F1FB", text: "#0C447C" },
  EM_TRIAGEM: { bg: "#FAEEDA", text: "#854F0B" },
  ENCAMINHADO: { bg: "#E6F1FB", text: "#0C447C" },
  ENCERRADO: { bg: "#EAF3DE", text: "#27500A" },
  AGENDADA: { bg: "#E6F1FB", text: "#0C447C" },
  REALIZADA: { bg: "#EAF3DE", text: "#27500A" },
  CANCELADA: { bg: "#F1EFE8", text: "#5F5E5A" },
  FALTOU: { bg: "#FAEEDA", text: "#854F0B" },
};

/** Cor neutra padrão para categorias sem semântica de alerta. */
export const NEUTRAL_COLOR = { bg: "#E6F1FB", text: "#0C447C" } as const;

/** Converte um mapa `{ CHAVE: total }` em linhas ordenadas para gráficos. */
export function toChartData(
  record: Record<string, number> | undefined,
  colorMap: Record<string, { bg: string; text: string }> = {},
): { key: string; value: number; bg: string; text: string }[] {
  if (!record) return [];
  return Object.entries(record)
    .filter(([, value]) => typeof value === "number" && value > 0)
    .map(([key, value]) => {
      const color = colorMap[key] ?? NEUTRAL_COLOR;
      return { key, value, bg: color.bg, text: color.text };
    })
    .sort((a, b) => b.value - a.value);
}

/** Ordena uma série `{ "AAAA-MM": total }` cronologicamente. */
export function toMonthlySeries(
  record: Record<string, number> | undefined,
): { key: string; value: number }[] {
  if (!record) return [];
  return Object.entries(record)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));
}

/** Formata número no padrão pt-BR (separador de milhar). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** Formata um `AAAA-MM` como `mmm/aa` (ex.: `jan/26`). */
export function formatMonthLabel(value: string): string {
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  })
    .format(date)
    .replace(".", "");
}

/** Rótulos legíveis para os enums agregados pelo back-end. */
export const LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  ABERTO: "Aberto",
  EM_TRIAGEM: "Em triagem",
  ENCAMINHADO: "Encaminhado",
  ENCERRADO: "Encerrado",
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ELEVADO: "Elevado",
  PSICOLOGO: "Psicologia",
  ASSISTENTE_SOCIAL: "Assistência social",
  ASSESSOR_JURIDICO: "Jurídico",
  SEM_DESTINO: "Sem destino",
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
  FALTOU: "Faltou",
  DEFENSORIA: "Defensoria",
  REDE_SAUDE: "Rede de saúde",
  DELEGACIA: "Delegacia",
  OUTRO: "Outro",
  NAO_INFORMADO: "Não informado",
  SEM_IDADE: "Sem idade",
};

/** Traduz uma chave de enum para rótulo exibível. */
export function labelFor(key: string): string {
  return LABELS[key] ?? key;
}
