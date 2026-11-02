import { apiFetchJson } from "../auth/apiFetch.server";
import { appointmentApi } from "./appointmentApi.server";
import {
  DEMANDS_PER_PAGE,
  isAguardandoCadastro,
  isPendenteAnalise,
  sortFilaDemandas,
} from "./managerUtils";
import type {
  DemandFilters,
  DemandStatusCounts,
  ManagerDemandDetail,
  ManagerDemandItem,
  ManagerSummary,
} from "./managerUtils";
import type {
  ManagerPatientItem,
  PatientFacets,
  PatientFilters,
  PatientTriageCounts,
} from "./patientUtils";
import {
  fetchVictimsAwaitingTriage,
  isTriagePendingProcess,
} from "./victimsApi.server";

export type ApproveDemandResult = {
  id: string;
  status: string;
  /** Processo criado automaticamente na aprovação (quando a vítima já é cadastrada). */
  processoId?: string | null;
  notificationStatus?: string;
  inviteLink?: string;
  _debugToken?: string;
};

/** Item da fila de triagem: processo ABERTO que ainda não passou pela triagem. */
export type TriageQueueItem = {
  vitimaId: string;
  processoId: string;
  nome: string;
  campus: string;
  vinculo: string;
  cadastradoEm: string;
  abertoEm: string;
  /**
   * Existe consulta de triagem com status AGENDADA para o processo.
   * (Processos com triagem REALIZADA nem entram na fila.)
   */
  triagemAgendada: boolean;
};

export type RejectDemandResult = {
  id: string;
  status: string;
  motivoRejeicao: string;
};

const DEMAND_FETCH_LIMIT = 100;

/** Backend now paginates `GET /demands`. */
export type PaginatedDemands = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts?: DemandStatusCounts;
  demandas: ManagerDemandItem[];
};

/** Server-filtered, server-paginated result consumed by the demands screen. */
export type DemandListResult = {
  demandas: ManagerDemandItem[];
  total: number;
  page: number;
  totalPages: number;
  counts: DemandStatusCounts;
};

const DEFAULT_DEMANDS_ERROR =
  "Não foi possível carregar as demandas. Tente novamente em instantes.";

/**
 * Maps the UI filter model to the `GET /demands` query contract. The backend
 * exposes only the raw statuses (PENDENTE/APROVADA/REJEITADA) plus a
 * `registration` flag, so the derived categories are translated here.
 */
function buildDemandQueryParams(
  filters: DemandFilters,
  page: number,
): URLSearchParams {
  const params = new URLSearchParams();

  switch (filters.status) {
    case "PENDENTE":
      params.set("status", "PENDENTE");
      break;
    case "AGUARDANDO_CADASTRO":
      params.set("status", "APROVADA");
      params.set("registration", "pending");
      break;
    case "EM_PROCESSO":
      params.set("status", "APROVADA");
      params.set("registration", "completed");
      break;
    case "REJEITADA":
      params.set("status", "REJEITADA");
      break;
    default:
      break;
  }

  if (filters.campus !== "ALL") params.set("campus", filters.campus);
  if (filters.violenceType !== "ALL") {
    params.set("violenceType", filters.violenceType);
  }
  if (filters.search) params.set("q", filters.search);
  if (filters.from) params.set("de", filters.from);
  if (filters.to) params.set("ate", filters.to);
  if (filters.onlyCampus) params.set("onlyCampus", "1");

  params.set("page", String(page));
  params.set("limit", String(DEMANDS_PER_PAGE));
  return params;
}

/**
 * Accepts both the paginated payload and the legacy bare array so the front
 * keeps working against older backend builds during rollout.
 */
function normalizeDemandPage(
  payload: PaginatedDemands | ManagerDemandItem[],
): PaginatedDemands {
  if (Array.isArray(payload)) {
    return {
      total: payload.length,
      page: 1,
      limit: payload.length || 1,
      totalPages: 1,
      demandas: payload,
    };
  }
  return payload;
}

async function fetchDemandPage(
  request: Request,
  page: number,
  status?: string,
): Promise<PaginatedDemands> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("page", String(page));
  params.set("limit", String(DEMAND_FETCH_LIMIT));
  const payload = await apiFetchJson<PaginatedDemands | ManagerDemandItem[]>(
    request,
    `/demands?${params.toString()}`,
    undefined,
    DEFAULT_DEMANDS_ERROR,
  );
  return normalizeDemandPage(payload);
}

/**
 * Front-only pagination: the backend caps `limit` at 100, so we walk every
 * page and accumulate the full list. Filters/counts stay client-side and
 * therefore correct across the whole dataset. Fine for NEVIM's volume;
 * revisit if the dataset outgrows it.
 */
async function fetchAllDemandPages(
  request: Request,
  status?: string,
): Promise<ManagerDemandItem[]> {
  const firstPage = await fetchDemandPage(request, 1, status);
  const totalPages = Math.max(1, firstPage.totalPages || 1);
  if (totalPages <= 1) return firstPage.demandas;

  const remainingPages = Array.from(
    { length: totalPages - 1 },
    (_, index) => index + 2,
  );
  const pages = await Promise.all(
    remainingPages.map((page) => fetchDemandPage(request, page, status)),
  );
  return [
    ...firstPage.demandas,
    ...pages.flatMap((page) => page.demandas),
  ];
}

export type PatientPagePayload = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: PatientTriageCounts;
  facets: PatientFacets;
  pacientes: ManagerPatientItem[];
};

const DEFAULT_PATIENTS_ERROR =
  "Não foi possível carregar os pacientes. Tente novamente em instantes.";

/**
 * Maps the UI filter model to the `GET /victims` query contract. `GET /victims`
 * is server-filtered, server-paginated and returns counts/facets for the chips.
 */
function buildPatientQueryParams(
  filters: PatientFilters,
  page: number,
  limit: number,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.triage !== "ALL") params.set("triage", filters.triage);
  if (filters.search) params.set("q", filters.search);
  if (filters.risk !== "ALL") params.set("risk", filters.risk);
  if (filters.area !== "ALL") params.set("area", filters.area);
  if (filters.campus !== "ALL") params.set("campus", filters.campus);
  if (filters.course !== "ALL") params.set("course", filters.course);
  if (filters.bond !== "ALL") params.set("bond", filters.bond);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("sort", "recent");
  params.set("page", String(page));
  params.set("limit", String(limit));
  return params;
}

export const managerApi = {
  async getSummary(request: Request): Promise<ManagerSummary> {
    return apiFetchJson<ManagerSummary>(
      request,
      "/dashboard/summary",
      undefined,
      "Não foi possível carregar os indicadores. Tente novamente em instantes.",
    );
  },

  /** Server-filtered, server-paginated demands for the Demands screen. */
  async listDemands(
    request: Request,
    filters: DemandFilters,
    page: number,
  ): Promise<DemandListResult> {
    const params = buildDemandQueryParams(filters, page);
    const payload = await apiFetchJson<PaginatedDemands>(
      request,
      `/demands?${params.toString()}`,
      undefined,
      DEFAULT_DEMANDS_ERROR,
    );
    return {
      demandas: payload.demandas,
      total: payload.total,
      page: payload.page,
      totalPages: payload.totalPages,
      counts: payload.counts ?? {
        ALL: payload.total,
        PENDENTE: 0,
        AGUARDANDO_CADASTRO: 0,
        EM_PROCESSO: 0,
        REJEITADA: 0,
      },
    };
  },

  /**
   * Fila do gestor: pendentes de análise + aprovadas cuja vítima ainda não
   * completou o cadastro. Aprovadas já vinculadas ficam fora (viram processo).
   */
  async listFilaDemandas(request: Request): Promise<ManagerDemandItem[]> {
    const all = await fetchAllDemandPages(request);
    const fila = all.filter(
      (demand) => isPendenteAnalise(demand) || isAguardandoCadastro(demand),
    );
    return sortFilaDemandas(fila);
  },

  /** Registered victims (patients), server-filtered/paginated via GET /victims. */
  async listPatients(
    request: Request,
    filters: PatientFilters,
    page: number,
    limit: number,
  ): Promise<PatientPagePayload> {
    const params = buildPatientQueryParams(filters, page, limit);
    return apiFetchJson<PatientPagePayload>(
      request,
      `/victims?${params.toString()}`,
      undefined,
      DEFAULT_PATIENTS_ERROR,
    );
  },

  /**
   * Fila de triagem do gestor: processos ABERTO (criados automaticamente no
   * cadastro/aprovação) cuja triagem ainda não foi REALIZADA. Processos com
   * consulta de triagem REALIZADA saem da fila (já cumpriram a etapa).
   * Ordenada pelo processo mais recente.
   */
  async listTriageQueue(request: Request): Promise<TriageQueueItem[]> {
    const [victims, appointments] = await Promise.all([
      fetchVictimsAwaitingTriage(request),
      appointmentApi.listAppointments(request),
    ]);
    const triagemRealizada = new Set(
      appointments
        .filter(
          (appointment) =>
            appointment.tipoProfissional === "TRIAGEM" &&
            appointment.status === "REALIZADA",
        )
        .map((appointment) => appointment.processoId),
    );
    const triagemAgendada = new Set(
      appointments
        .filter(
          (appointment) =>
            appointment.tipoProfissional === "TRIAGEM" &&
            appointment.status === "AGENDADA",
        )
        .map((appointment) => appointment.processoId),
    );
    return victims
      .filter(isTriagePendingProcess)
      .filter((victim) => !triagemRealizada.has(victim.processo!.id))
      .map((victim) => ({
        vitimaId: victim.vitimaId,
        processoId: victim.processo!.id,
        nome: victim.nome,
        campus: victim.campus,
        vinculo: victim.vinculo,
        cadastradoEm: victim.cadastradoEm,
        abertoEm: victim.processo!.abertoEm,
        triagemAgendada: triagemAgendada.has(victim.processo!.id),
      }))
      .sort((a, b) => b.abertoEm.localeCompare(a.abertoEm));
  },

  async getDemandDetail(
    request: Request,
    id: string,
  ): Promise<ManagerDemandDetail> {
    return apiFetchJson<ManagerDemandDetail>(
      request,
      `/demands/${encodeURIComponent(id)}`,
      undefined,
      "Não foi possível carregar os dados da demanda. Tente novamente em instantes.",
    );
  },

  async approveDemand(
    request: Request,
    id: string,
  ): Promise<ApproveDemandResult> {
    return apiFetchJson<ApproveDemandResult>(
      request,
      `/demands/${encodeURIComponent(id)}/aprovar`,
      { method: "PATCH" },
      "Não foi possível aprovar a demanda. Tente novamente em instantes.",
    );
  },

  async rejectDemand(
    request: Request,
    id: string,
    motivoRejeicao: string,
  ): Promise<RejectDemandResult> {
    return apiFetchJson<RejectDemandResult>(
      request,
      `/demands/${encodeURIComponent(id)}/rejeitar`,
      { method: "PATCH", body: JSON.stringify({ motivoRejeicao }) },
      "Não foi possível rejeitar a demanda. Tente novamente em instantes.",
    );
  },

  async resendInvite(
    request: Request,
    id: string,
  ): Promise<ApproveDemandResult> {
    return apiFetchJson<ApproveDemandResult>(
      request,
      `/demands/${encodeURIComponent(id)}/reenviar-convite`,
      { method: "POST" },
      "Não foi possível reenviar o convite. Tente novamente em instantes.",
    );
  },
};
