/** Tipos e helpers puros da tela de pacientes do gestor (loader E componente). */

import type {
  ProcessStatus,
  TriageStatus,
} from "../../shared/components/StatusBadge";

export type PatientProfessionalArea =
  | "PSICOLOGO"
  | "ASSISTENTE_SOCIAL"
  | "ASSESSOR_JURIDICO";

export type PatientRiskLevel = "BAIXO" | "MEDIO" | "ELEVADO";

export type PatientTriageStatus =
  | "SEM_TRIAGEM"
  | "EM_TRIAGEM"
  | "ENCAMINHADO"
  | "ENCERRADO";

/** Processo mais recente da vítima (null quando ainda não há processo). */
export type ManagerPatientProcess = {
  id: string;
  status: string;
  classificacaoRisco: PatientRiskLevel | null;
  direcionadoPara: PatientProfessionalArea | null;
  abertoEm: string;
  triadoEm: string | null;
};

/** Item retornado por `GET /victims` (visão gestor). */
export type ManagerPatientItem = {
  vitimaId: string;
  nome: string;
  campus: string;
  curso: string | null;
  vinculo: string;
  cadastradoEm: string;
  triageStatus: PatientTriageStatus;
  processo: ManagerPatientProcess | null;
  totalConsultas: number;
  ultimaConsulta: {
    dataHora: string;
    tipoProfissional: string;
    status: string;
  } | null;
};

export const PATIENT_AREA_LABELS: Record<PatientProfessionalArea, string> = {
  PSICOLOGO: "Psicologia",
  ASSISTENTE_SOCIAL: "Assistência social",
  ASSESSOR_JURIDICO: "Jurídico",
};

export const EXTERNAL_AREA_LABEL = "Externo";

export const PATIENT_TRIAGE_LABELS: Record<PatientTriageStatus, TriageStatus> = {
  SEM_TRIAGEM: "Sem triagem",
  EM_TRIAGEM: "Em triagem",
  ENCAMINHADO: "Encaminhado",
  ENCERRADO: "Encerrado",
};

export const PATIENT_BOND_LABELS: Record<string, string> = {
  DISCENTE: "Discente",
  DOCENTE: "Docente",
  TECNICO_ADMINISTRATIVO: "Técnico Administrativo",
};

export const PATIENT_BOND_OPTIONS = [
  "DISCENTE",
  "DOCENTE",
  "TECNICO_ADMINISTRATIVO",
] as const;

/** Encaminhados apenas para órgãos externos não têm área interna. */
export type PatientAreaFilter = "ALL" | PatientProfessionalArea | "EXTERNO";
export type PatientRiskFilter = "ALL" | PatientRiskLevel;
export type PatientTriageFilter = "ALL" | PatientTriageStatus;

export type PatientFilters = {
  triage: PatientTriageFilter;
  area: PatientAreaFilter;
  risk: PatientRiskFilter;
  campus: string;
  course: string;
  bond: string;
  search: string;
  from: string;
  to: string;
};

const VALID_TRIAGE: PatientTriageFilter[] = [
  "ALL",
  "SEM_TRIAGEM",
  "EM_TRIAGEM",
  "ENCAMINHADO",
  "ENCERRADO",
];

const VALID_AREAS: PatientAreaFilter[] = [
  "ALL",
  "PSICOLOGO",
  "ASSISTENTE_SOCIAL",
  "ASSESSOR_JURIDICO",
  "EXTERNO",
];

const VALID_RISKS: PatientRiskFilter[] = ["ALL", "BAIXO", "MEDIO", "ELEVADO"];

export function parsePatientFilters(
  searchParams: URLSearchParams,
): PatientFilters {
  const rawTriage = (searchParams.get("triage") ?? "ALL").toUpperCase();
  const triage = VALID_TRIAGE.includes(rawTriage as PatientTriageFilter)
    ? (rawTriage as PatientTriageFilter)
    : "ALL";
  const rawArea = (searchParams.get("area") ?? "ALL").toUpperCase();
  const area = VALID_AREAS.includes(rawArea as PatientAreaFilter)
    ? (rawArea as PatientAreaFilter)
    : "ALL";
  const rawRisk = (searchParams.get("risk") ?? "ALL").toUpperCase();
  const risk = VALID_RISKS.includes(rawRisk as PatientRiskFilter)
    ? (rawRisk as PatientRiskFilter)
    : "ALL";
  return {
    triage,
    area,
    risk,
    campus: searchParams.get("campus")?.trim() || "ALL",
    course: searchParams.get("course")?.trim() || "ALL",
    bond: searchParams.get("bond")?.trim() || "ALL",
    search: searchParams.get("q")?.trim() || "",
    from: searchParams.get("from")?.trim() || "",
    to: searchParams.get("to")?.trim() || "",
  };
}

export function getPatientAreaLabel(
  area: PatientProfessionalArea | null,
): string {
  return area ? PATIENT_AREA_LABELS[area] : EXTERNAL_AREA_LABEL;
}

export function getPatientTriageLabel(status: PatientTriageStatus): TriageStatus {
  return PATIENT_TRIAGE_LABELS[status];
}

/**
 * Mapeia o `processo.status` do back (ABERTO/EM_TRIAGEM/ENCAMINHADO/ENCERRADO)
 * para o `ProcessStatus` padronizado do PRD (RFF09) usado em Demandas/Painel:
 * Pendente/Ativo/Inativo/Encerrado.
 * - ABERTO -> Pendente (aguardando triagem, mesma fila do Painel)
 * - EM_TRIAGEM/ENCAMINHADO -> Ativo (em acompanhamento)
 * - ENCERRADO -> Encerrado
 * - null (sem processo) -> Inativo (cadastro completo sem processo criado)
 */
export function getProcessStatusLabel(
  status: string | null | undefined,
): ProcessStatus {
  if (!status) return "Inativo";
  switch (status.toUpperCase()) {
    case "ABERTO":
      return "Pendente";
    case "EM_TRIAGEM":
    case "ENCAMINHADO":
      return "Ativo";
    case "ENCERRADO":
      return "Encerrado";
    default:
      return "Inativo";
  }
}

/** Texto explicativo do status do processo (tooltip / acessibilidade). */
export function getProcessStatusHint(
  status: string | null | undefined,
): string {
  if (!status) return "Sem processo criado";
  switch (status.toUpperCase()) {
    case "ABERTO":
      return "Processo aberto aguardando triagem (fila de triagem do Painel)";
    case "EM_TRIAGEM":
      return "Em triagem/acompanhamento";
    case "ENCAMINHADO":
      return "Encaminhado para acompanhamento";
    case "ENCERRADO":
      return "Processo encerrado";
    default:
      return `Status do processo: ${status}`;
  }
}

export function getPatientBondLabel(bond: string | null | undefined): string {
  if (!bond) return "—";
  return PATIENT_BOND_LABELS[bond] ?? bond;
}

export function getPatientRiskBadgeLabel(
  risk: PatientRiskLevel | null,
): "Baixo" | "Médio" | "Elevado" | null {
  switch (risk) {
    case "BAIXO":
      return "Baixo";
    case "MEDIO":
      return "Médio";
    case "ELEVADO":
      return "Elevado";
    default:
      return null;
  }
}

export function getConsultationStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case "AGENDADA":
      return "Agendada";
    case "REALIZADA":
      return "Realizada";
    case "CANCELADA":
      return "Cancelada";
    case "FALTOU":
      return "Faltou";
    default:
      return status;
  }
}

export type PatientFacets = {
  campuses: string[];
  courses: string[];
  bonds: string[];
};

export type PatientTriageCounts = Record<PatientTriageFilter, number>;

export const PATIENTS_PER_PAGE = 20;

export function parsePatientPage(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("page") ?? 1);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.floor(raw);
}
