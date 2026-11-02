/** Tipos e helpers puros da área do gestor (uso livre em loader E componente). */

/** Demanda resumida retornada por `GET /demands` (visão gestor). */
export type ManagerDemandItem = {
  id: string;
  status: string;
  vitimaId?: string | null;
  tipoViolencia: string;
  descricaoPreview?: string;
  solicitanteNome?: string | null;
  solicitanteEmail?: string | null;
  solicitantePhone?: string | null;
  solicitanteVinculo?: string | null;
  solicitanteCampus?: string | null;
  solicitanteCidade?: string | null;
  /** Local da ocorrência: coluna dedicada do back (plaintext). Null = legado/desconhecido. */
  solicitanteLocalOcorrencia?: string | null;
  /** false = valor veio do parse do blob legado `[Meta] Local:` (revisar). */
  localOcorrenciaConfiavel?: boolean;
  criadoEm: string;
  atualizadoEm?: string;
};

/** Detalhe completo retornado por `GET /demands/:id` (visão gestor). */
export type ManagerDemandDetail = ManagerDemandItem & {
  descricao: string;
  motivoRejeicao?: string | null;
  vitimaId?: string | null;
};

/** KPIs agregados de `GET /dashboard/summary`. */
export type ManagerSummary = {
  demandas: Record<string, number>;
  processos: Record<string, number>;
  consultasSemana?: number;
};

export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

/**
 * Normaliza o valor do local da ocorrência (RF03/RF06).
 * Valores atuais do front: "Dentro do campus da UESPI" | "Fora do campus".
 */
export function isDentroCampusValue(value?: string | null): boolean {
  if (!value) return false;
  return value.toLowerCase().includes("dentro do campus");
}

/**
 * Heurística legada de alerta campus (RN-03/RF06): bloco `[Meta] Local:`
 * embutido no `descricaoPreview`. Mantida apenas como fallback para
 * registros antigos sem a coluna dedicada `solicitanteLocalOcorrencia`.
 */
export function isDentroCampusPreview(preview?: string | null): boolean {
  return isDentroCampusValue(preview);
}

type DentroCampusSource = Pick<
  ManagerDemandItem,
  "solicitanteLocalOcorrencia" | "descricaoPreview"
> & { descricao?: string | null };

/**
 * Detecção campus usada na fila (RF06): prioriza a coluna dedicada do back;
 * cai para `descricao`/`descricaoPreview` quando a coluna é NULL (legado
 * sem backfill). Nunca lança para item incompleto.
 */
export function isDentroCampusItem(demand: DentroCampusSource): boolean {
  if (isDentroCampusValue(demand.solicitanteLocalOcorrencia)) return true;
  // Coluna preenchida com valor fora do campus: não precisa do fallback.
  if (
    demand.solicitanteLocalOcorrencia != null &&
    demand.solicitanteLocalOcorrencia.trim() !== ""
  ) {
    return false;
  }
  const fallback =
    ("descricao" in demand ? demand.descricao : null) ??
    demand.descricaoPreview ??
    null;
  return isDentroCampusPreview(fallback);
}

export function countDentroCampus(demands: ManagerDemandItem[]): number {
  return demands.filter((d) => isDentroCampusItem(d)).length;
}

/**
 * Demanda aprovada cuja vítima ainda não completou o cadastro via convite.
 * O back vincula `vitimaId` e marca o convite como usado na mesma transação
 * (`POST /auth/register/:token`), então `vitimaId == null` equivale a
 * cadastro pendente.
 */
export function isAguardandoCadastro(demand: ManagerDemandItem): boolean {
  return demand.status === "APROVADA" && !demand.vitimaId;
}

export function isPendenteAnalise(demand: ManagerDemandItem): boolean {
  return demand.status === "PENDENTE";
}

export function isRejeitada(demand: ManagerDemandItem): boolean {
  return demand.status === "REJEITADA";
}

export function isEmProcesso(demand: ManagerDemandItem): boolean {
  return demand.status === "APROVADA" && !!demand.vitimaId;
}

export type DemandStatusFilter =
  | "ALL"
  | "PENDENTE"
  | "AGUARDANDO_CADASTRO"
  | "EM_PROCESSO"
  | "REJEITADA";

export type DemandFilters = {
  status: DemandStatusFilter;
  campus: string;
  violenceType: string;
  search: string;
  onlyCampus: boolean;
  from: string;
  to: string;
};

export const EMPTY_DEMAND_FILTERS: DemandFilters = {
  status: "ALL",
  campus: "ALL",
  violenceType: "ALL",
  search: "",
  onlyCampus: false,
  from: "",
  to: "",
};

export function parseDemandFilters(searchParams: URLSearchParams): DemandFilters {
  const rawStatus = (searchParams.get("status") ?? "ALL").toUpperCase();
  const validStatuses: DemandStatusFilter[] = [
    "ALL",
    "PENDENTE",
    "AGUARDANDO_CADASTRO",
    "EM_PROCESSO",
    "REJEITADA",
  ];
  const status = validStatuses.includes(rawStatus as DemandStatusFilter)
    ? (rawStatus as DemandStatusFilter)
    : "ALL";
  return {
    status,
    campus: searchParams.get("campus")?.trim() || "ALL",
    violenceType: searchParams.get("violenceType")?.trim() || "ALL",
    search: searchParams.get("q")?.trim() || "",
    onlyCampus: searchParams.get("onlyCampus") === "1",
    from: searchParams.get("from")?.trim() || "",
    to: searchParams.get("to")?.trim() || "",
  };
}

export function getDemandCategory(
  demand: ManagerDemandItem
): Exclude<DemandStatusFilter, "ALL"> {
  if (isPendenteAnalise(demand)) return "PENDENTE";
  if (isAguardandoCadastro(demand)) return "AGUARDANDO_CADASTRO";
  if (isEmProcesso(demand)) return "EM_PROCESSO";
  return "REJEITADA";
}

export type DemandStatusCounts = Record<DemandStatusFilter, number>;

export const DEMANDS_PER_PAGE = 20;

/**
 * Reads the `page` query param clamped to a positive integer. Filtering
 * resets the page because the filter form never submits `page`.
 */
export function parseDemandPage(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("page") ?? 1);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.floor(raw);
}

/**
 * Ordena a fila (RFF05/RF06): pendentes de análise primeiro, depois
 * aguardando cadastro; dentro de cada status, casos dentro do campus
 * primeiro, depois os normais; cada subgrupo por data de criação
 * (mais recentes antes).
 */
export function sortFilaDemandas(demands: ManagerDemandItem[]): ManagerDemandItem[] {
  return [...demands].sort((a, b) => {
    const rankA = isPendenteAnalise(a) ? 0 : 1;
    const rankB = isPendenteAnalise(b) ? 0 : 1;
    if (rankA !== rankB) return rankA - rankB;
    const campusA = isDentroCampusItem(a) ? 0 : 1;
    const campusB = isDentroCampusItem(b) ? 0 : 1;
    if (campusA !== campusB) return campusA - campusB;
    return b.criadoEm.localeCompare(a.criadoEm);
  });
}
