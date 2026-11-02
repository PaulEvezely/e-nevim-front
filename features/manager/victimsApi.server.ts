import { apiFetchJson } from "../auth/apiFetch.server";
import type { ManagerPatientItem } from "./patientUtils";

const DEFAULT_VICTIMS_ERROR =
  "Não foi possível carregar as vítimas. Tente novamente em instantes.";

const VICTIMS_FETCH_LIMIT = 100;

type VictimsPagePayload = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pacientes?: ManagerPatientItem[];
};

/**
 * Vítimas que ainda precisam de triagem.
 *
 * `GET /victims?triage=SEM_TRIAGEM` devolve quem não tem processo e quem tem
 * processo ABERTO. Busca todas as páginas para não perder vítimas quando
 * há mais de 100 itens (limite do back-end).
 */
export async function fetchVictimsAwaitingTriage(
  request: Request,
): Promise<ManagerPatientItem[]> {
  const params = new URLSearchParams();
  params.set("triage", "SEM_TRIAGEM");
  params.set("sort", "recent");
  params.set("limit", String(VICTIMS_FETCH_LIMIT));

  const firstPage = await apiFetchJson<VictimsPagePayload>(
    request,
    `/victims?${params.toString()}&page=1`,
    undefined,
    DEFAULT_VICTIMS_ERROR,
  );

  const totalPages = Math.max(1, firstPage.totalPages ?? 1);
  if (totalPages <= 1) {
    return firstPage.pacientes ?? [];
  }

  const remainingPages = Array.from(
    { length: totalPages - 1 },
    (_, i) => i + 2,
  );
  const pages = await Promise.all(
    remainingPages.map((page) =>
      apiFetchJson<VictimsPagePayload>(
        request,
        `/victims?${params.toString()}&page=${page}`,
        undefined,
        DEFAULT_VICTIMS_ERROR,
      ),
    ),
  );

  return [
    ...(firstPage.pacientes ?? []),
    ...pages.flatMap((p) => p.pacientes ?? []),
  ];
}

/**
 * Processos criados que ainda não passaram pela triagem (status ABERTO).
 * Com a criação automática no cadastro/aprovação, todo cadastro via convite
 * já nasce com processo ABERTO.
 */
export function isTriagePendingProcess(
  patient: ManagerPatientItem,
): boolean {
  return patient.processo !== null && patient.processo.status === "ABERTO";
}

/**
 * Vítimas com processo EM_TRIAGEM (triagem registrada, aguardando
 * encaminhamento/agendamento com profissional).
 */
export async function fetchVictimsInTriagem(
  request: Request,
): Promise<ManagerPatientItem[]> {
  const params = new URLSearchParams();
  params.set("triage", "EM_TRIAGEM");
  params.set("sort", "recent");
  params.set("limit", String(VICTIMS_FETCH_LIMIT));

  const firstPage = await apiFetchJson<VictimsPagePayload>(
    request,
    `/victims?${params.toString()}&page=1`,
    undefined,
    DEFAULT_VICTIMS_ERROR,
  );

  const totalPages = Math.max(1, firstPage.totalPages ?? 1);
  if (totalPages <= 1) {
    return firstPage.pacientes ?? [];
  }

  const remainingPages = Array.from(
    { length: totalPages - 1 },
    (_, i) => i + 2,
  );
  const pages = await Promise.all(
    remainingPages.map((page) =>
      apiFetchJson<VictimsPagePayload>(
        request,
        `/victims?${params.toString()}&page=${page}`,
        undefined,
        DEFAULT_VICTIMS_ERROR,
      ),
    ),
  );

  return [
    ...(firstPage.pacientes ?? []),
    ...pages.flatMap((p) => p.pacientes ?? []),
  ];
}

/** Processo EM_TRIAGEM (triagem registrada, pode receber acompanhamento). */
export function isEmTriagemProcess(patient: ManagerPatientItem): boolean {
  return patient.processo !== null && patient.processo.status === "EM_TRIAGEM";
}

/**
 * Busca digitável de vítimas/processos para o combobox de agendamento.
 * Reusa `GET /victims` com `q` (nome) + `triage` opcional, limitado a 20.
 * Retorna `ManagerPatientItem[]` para conversão em `AppointmentProcessOption`.
 */
export async function searchVictimsForProcess(
  request: Request,
  query: string,
  triage: "ALL" | "SEM_TRIAGEM" | "EM_TRIAGEM" | "ENCAMINHADO" | "ENCERRADO" = "ALL",
  limit = 20,
): Promise<ManagerPatientItem[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (triage !== "ALL") params.set("triage", triage);
  params.set("sort", "recent");
  params.set("limit", String(limit));
  params.set("page", "1");

  const payload = await apiFetchJson<VictimsPagePayload>(
    request,
    `/victims?${params.toString()}`,
    undefined,
    DEFAULT_VICTIMS_ERROR,
  );
  return payload.pacientes ?? [];
}
