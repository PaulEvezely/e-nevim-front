import { apiFetchJson } from "../auth/apiFetch.server";
import type {
  AppointmentProcessOption,
  AppointmentStatus,
  CreateAppointmentInput,
  ManagerAppointmentDetail,
  ManagerAppointmentItem,
  ProfessionalOption,
  ProfessionalType,
  UpdateAppointmentInput,
} from "./appointmentUtils";
import {
  fetchVictimsAwaitingTriage,
  fetchVictimsInTriagem,
  isEmTriagemProcess,
  isTriagePendingProcess,
} from "./victimsApi.server";

const DEFAULT_APPOINTMENTS_ERROR =
  "Não foi possível carregar as consultas. Tente novamente em instantes.";
const DEFAULT_PROCESSES_ERROR =
  "Não foi possível carregar os processos. Tente novamente em instantes.";
const DEFAULT_PROFESSIONALS_ERROR =
  "Não foi possível carregar os profissionais. Tente novamente em instantes.";

export type AppointmentQuery = {
  de?: string;
  ate?: string;
  processoId?: string;
  profissionalId?: string;
};

type BackendPatient = {
  processoId: string;
  status: string;
  direcionadoPara: ProfessionalType | null;
  classificacaoRisco: AppointmentProcessOption["classificacaoRisco"];
  abertoEm: string;
  vitima: {
    id: string;
    nome: string;
    campus: string;
    curso: string;
    vinculo: string;
  };
  totalConsultas: number;
};

type PatientPagePayload = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pacientes: BackendPatient[];
};

type BackendUser = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  psicologo?: { id: string; crp: string } | null;
  assistenteSocial?: { id: string; cress: string } | null;
  assessorJuridico?: { id: string; oab: string } | null;
};

type UsersPagePayload = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  usuarios: BackendUser[];
};

const PATIENT_FETCH_LIMIT = 100;
const USER_FETCH_LIMIT = 100;

function getRegistro(user: BackendUser): string | null {
  if (user.perfil === "PSICOLOGO") return user.psicologo?.crp ?? null;
  if (user.perfil === "ASSISTENTE_SOCIAL") {
    return user.assistenteSocial?.cress ?? null;
  }
  if (user.perfil === "ASSESSOR_JURIDICO") {
    return user.assessorJuridico?.oab ?? null;
  }
  return null;
}

function buildQuery(params: AppointmentQuery): string {
  const search = new URLSearchParams();
  if (params.de) search.set("de", params.de);
  if (params.ate) search.set("ate", params.ate);
  if (params.processoId) search.set("processoId", params.processoId);
  if (params.profissionalId) {
    search.set("profissionalId", params.profissionalId);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function fetchPatientPage(
  request: Request,
  page: number,
): Promise<PatientPagePayload> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(PATIENT_FETCH_LIMIT));
  return apiFetchJson<PatientPagePayload>(
    request,
    `/patients?${params.toString()}`,
    undefined,
    DEFAULT_PROCESSES_ERROR,
  );
}

async function fetchUserPage(
  request: Request,
  perfil: ProfessionalType | "GESTOR",
  page: number,
): Promise<UsersPagePayload> {
  const params = new URLSearchParams();
  params.set("perfil", perfil);
  params.set("page", String(page));
  params.set("limit", String(USER_FETCH_LIMIT));
  return apiFetchJson<UsersPagePayload>(
    request,
    `/users?${params.toString()}`,
    undefined,
    DEFAULT_PROFESSIONALS_ERROR,
  );
}

export const appointmentApi = {
  /** Consultas da agenda. GESTOR vê todas; profissional vê só as suas. */
  async listAppointments(
    request: Request,
    query: AppointmentQuery = {},
  ): Promise<ManagerAppointmentItem[]> {
    return apiFetchJson<ManagerAppointmentItem[]>(
      request,
      `/appointments${buildQuery(query)}`,
      undefined,
      DEFAULT_APPOINTMENTS_ERROR,
    );
  },

  async getAppointment(
    request: Request,
    id: string,
  ): Promise<ManagerAppointmentDetail> {
    return apiFetchJson<ManagerAppointmentDetail>(
      request,
      `/appointments/${encodeURIComponent(id)}`,
      undefined,
      "Não foi possível carregar a consulta. Tente novamente em instantes.",
    );
  },

  async createAppointment(
    request: Request,
    payload: CreateAppointmentInput,
  ): Promise<ManagerAppointmentItem> {
    return apiFetchJson<ManagerAppointmentItem>(
      request,
      "/appointments",
      { method: "POST", body: JSON.stringify(payload) },
      "Não foi possível agendar a consulta. Tente novamente em instantes.",
    );
  },

  async updateAppointment(
    request: Request,
    id: string,
    payload: UpdateAppointmentInput,
  ): Promise<ManagerAppointmentItem> {
    return apiFetchJson<ManagerAppointmentItem>(
      request,
      `/appointments/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
      "Não foi possível atualizar a consulta. Tente novamente em instantes.",
    );
  },

  async updateAppointmentStatus(
    request: Request,
    id: string,
    status: Exclude<AppointmentStatus, "AGENDADA">,
  ): Promise<ManagerAppointmentItem> {
    return apiFetchJson<ManagerAppointmentItem>(
      request,
      `/appointments/${encodeURIComponent(id)}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      "Não foi possível atualizar o status da consulta. Tente novamente em instantes.",
    );
  },

  /** Confirma a presença do profissional dono (idempotente). */
  async confirmAppointment(
    request: Request,
    id: string,
  ): Promise<ManagerAppointmentItem> {
    return apiFetchJson<ManagerAppointmentItem>(
      request,
      `/appointments/${encodeURIComponent(id)}/confirmar`,
      { method: "POST" },
      "Não foi possível confirmar a consulta. Tente novamente em instantes.",
    );
  },

  /** Recusa a consulta (motivo opcional); o gestor é avisado para reagendar. */
  async refuseAppointment(
    request: Request,
    id: string,
    motivo: string | null,
  ): Promise<ManagerAppointmentItem> {
    return apiFetchJson<ManagerAppointmentItem>(
      request,
      `/appointments/${encodeURIComponent(id)}/recusar`,
      {
        method: "POST",
        body: JSON.stringify(motivo ? { motivo } : {}),
      },
      "Não foi possível recusar a consulta. Tente novamente em instantes.",
    );
  },

  /** Processos ENCAMINHADOS (com dados da vítima) para o seletor de agenda. */
  async listProcessOptions(request: Request): Promise<AppointmentProcessOption[]> {
    const firstPage = await fetchPatientPage(request, 1);
    const totalPages = Math.max(1, firstPage.totalPages || 1);
    const remainingPages = Array.from(
      { length: totalPages - 1 },
      (_, index) => index + 2,
    );
    const pages = await Promise.all(
      remainingPages.map((page) => fetchPatientPage(request, page)),
    );
    const all = [
      ...firstPage.pacientes,
      ...pages.flatMap((page) => page.pacientes),
    ];
    return all.map((patient) => ({
      processoId: patient.processoId,
      status: patient.status,
      direcionadoPara: patient.direcionadoPara,
      classificacaoRisco: patient.classificacaoRisco,
      abertoEm: patient.abertoEm,
      vitimaNome: patient.vitima?.nome ?? "",
      vitimaCampus: patient.vitima?.campus ?? "",
      totalConsultas: patient.totalConsultas ?? 0,
    }));
  },

  /**
   * Nome do gestor autenticado. O JWT da sessão não carrega o nome, então ele
   * é resolvido por `GET /users?perfil=GESTOR`. A triagem é sempre feita pelo
   * próprio gestor, então só o próprio registro é usado.
   */
  async getGestor(
    request: Request,
    gestorId: string,
  ): Promise<{ id: string; nome: string }> {
    const payload = await fetchUserPage(request, "GESTOR", 1).catch(() => null);
    const gestor = payload?.usuarios.find((user) => user.id === gestorId);
    return { id: gestorId, nome: gestor?.nome ?? "Gestor" };
  },

  /**
   * Processos ABERTO (aguardando triagem) para o agendamento da triagem.
   * Vêm de `GET /victims?triage=SEM_TRIAGEM` porque `/patients` só lista os
   * processos ENCAMINHADO. O processo nasce automaticamente no cadastro
   * (via convite) ou na aprovação da demanda com vítima já cadastrada.
   */
  async listTriageProcessOptions(
    request: Request,
  ): Promise<AppointmentProcessOption[]> {
    const [victims, appointments] = await Promise.all([
      fetchVictimsAwaitingTriage(request),
      appointmentApi.listAppointments(request).catch(() => []),
    ]);
    // Processos com triagem AGENDADA (não realizada) não são oferecidos
    // para novo agendamento — o back devolveria 409.
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
      .filter((victim) => !triagemAgendada.has(victim.processo!.id))
      .map((victim) => ({
        processoId: victim.processo!.id,
        status: victim.processo!.status,
        direcionadoPara: null,
        classificacaoRisco: victim.processo!.classificacaoRisco,
        abertoEm: victim.processo!.abertoEm,
        vitimaNome: victim.nome,
        vitimaCampus: victim.campus,
        totalConsultas: victim.totalConsultas,
      }));
  },

  /**
   * Encaminha o processo para um profissional (EM_TRIAGEM -> ENCAMINHADO).
   * Chamado automaticamente ao agendar consulta com profissional — agendar
   * É o encaminhamento (sem passo separado no front).
   */
  async encaminharProcesso(
    request: Request,
    processoId: string,
    direcionadoPara: ProfessionalType,
  ): Promise<{ id: string; status: string }> {
    return apiFetchJson<{ id: string; status: string }>(
      request,
      `/processes/${encodeURIComponent(processoId)}/encaminhar`,
      { method: "PATCH", body: JSON.stringify({ direcionadoPara }) },
      "Não foi possível encaminhar o processo. Tente novamente em instantes.",
    );
  },

  /**
   * Processos EM_TRIAGEM (triagem registrada, aguardando acompanhamento).
   * Ao agendar com um profissional, o front encaminha automaticamente
   * (EM_TRIAGEM -> ENCAMINHADO) — agendar É o encaminhamento.
   */
  async listEmTriagemProcessOptions(
    request: Request,
  ): Promise<AppointmentProcessOption[]> {
    const victims = await fetchVictimsInTriagem(request);
    return victims
      .filter(isEmTriagemProcess)
      .map((victim) => ({
        processoId: victim.processo!.id,
        status: victim.processo!.status,
        direcionadoPara: victim.processo!.direcionadoPara,
        classificacaoRisco: victim.processo!.classificacaoRisco,
        abertoEm: victim.processo!.abertoEm,
        vitimaNome: victim.nome,
        vitimaCampus: victim.campus,
        totalConsultas: victim.totalConsultas,
      }));
  },

  /**
   * Triagens do gestor autenticado (`tipoProfissional === TRIAGEM`).
   * O back filtra por `profissionalId`; o front reforça o tipo por segurança.
   */
  async listMyTriagemAppointments(
    request: Request,
    gestorId: string,
  ): Promise<ManagerAppointmentItem[]> {
    const appointments = await apiFetchJson<ManagerAppointmentItem[]>(
      request,
      `/appointments?profissionalId=${encodeURIComponent(gestorId)}`,
      undefined,
      DEFAULT_APPOINTMENTS_ERROR,
    );
    return appointments.filter(
      (appointment) => appointment.tipoProfissional === "TRIAGEM",
    );
  },

  /**
   * Busca digitável de processos para o combobox (debounced no front).
   * Filtra por nome da vítima (`q`) via `GET /victims` e converte para
   * `AppointmentProcessOption`. Se `triage` específico, já filtra no back.
   * Suporta busca por prefixo de id via fallback local.
   */
  async searchProcessOptions(
    request: Request,
    query: string,
    triage: "ALL" | "SEM_TRIAGEM" | "EM_TRIAGEM" | "ENCAMINHADO" | "ENCERRADO" = "ALL",
    limit = 20,
  ): Promise<AppointmentProcessOption[]> {
    const { searchVictimsForProcess } = await import("./victimsApi.server");
    const trimmed = query.trim();
    // Se for UUID completo, tenta busca direta por processo (suporte a colar id).
    // Prefixos de 8 chars são tratados via busca por nome (q), não via GET direto.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      try {
        const { getProcessReport } = await import("./processReportApi.server");
        const report = await getProcessReport(request, trimmed);
        return [
          {
            processoId: report.processo.id,
            status: report.processo.status,
            direcionadoPara: report.processo.direcionadoPara,
            classificacaoRisco: report.processo.classificacaoRisco,
            abertoEm: report.processo.abertoEm,
            vitimaNome: report.vitima.nome ?? "",
            vitimaCampus: report.vitima.campus ?? "",
            totalConsultas: report.consultas.length,
          },
        ];
      } catch {
        // fallback para busca por nome
      }
    }
    const victims = await searchVictimsForProcess(request, trimmed, triage, limit);
    return victims
      .filter((v) => v.processo !== null)
      .map((v) => ({
        processoId: v.processo!.id,
        status: v.processo!.status,
        direcionadoPara: v.processo!.direcionadoPara,
        classificacaoRisco: v.processo!.classificacaoRisco,
        abertoEm: v.processo!.abertoEm,
        vitimaNome: v.nome,
        vitimaCampus: v.campus,
        totalConsultas: v.totalConsultas,
      }));
  },

  /** Busca única para pré-preencher o combobox quando o id vem de deep-link. */
  async getProcessOptionById(
    request: Request,
    processoId: string,
  ): Promise<AppointmentProcessOption | null> {
    try {
      const { getProcessReport } = await import("./processReportApi.server");
      const report = await getProcessReport(request, processoId);
      return {
        processoId: report.processo.id,
        status: report.processo.status,
        direcionadoPara: report.processo.direcionadoPara,
        classificacaoRisco: report.processo.classificacaoRisco,
        abertoEm: report.processo.abertoEm,
        vitimaNome: report.vitima.nome ?? "",
        vitimaCampus: report.vitima.campus ?? "",
        totalConsultas: report.consultas.length,
      };
    } catch {
      return null;
    }
  },

  /** Profissionais ativos, opcionalmente filtrados por tipo. */
  async listProfessionals(
    request: Request,
    tipo?: ProfessionalType,
  ): Promise<ProfessionalOption[]> {
    const tipos = tipo ? [tipo] : (["PSICOLOGO", "ASSISTENTE_SOCIAL", "ASSESSOR_JURIDICO"] as ProfessionalType[]);
    const results = await Promise.all(
      tipos.map(async (perfil) => {
        const firstPage = await fetchUserPage(request, perfil, 1);
        const totalPages = Math.max(1, firstPage.totalPages || 1);
        const remainingPages = Array.from(
          { length: totalPages - 1 },
          (_, index) => index + 2,
        );
        const pages = await Promise.all(
          remainingPages.map((page) => fetchUserPage(request, perfil, page)),
        );
        return [
          ...firstPage.usuarios,
          ...pages.flatMap((page) => page.usuarios),
        ];
      }),
    );
    return results
      .flat()
      .filter(
        (user) =>
          user.ativo &&
          (user.perfil === "PSICOLOGO" ||
            user.perfil === "ASSISTENTE_SOCIAL" ||
            user.perfil === "ASSESSOR_JURIDICO"),
      )
      .map((user) => ({
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil as ProfessionalType,
        ativo: user.ativo,
        registro: getRegistro(user),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
};
