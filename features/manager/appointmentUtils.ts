/** Tipos e helpers puros das consultas (uso livre em loader E componente). */

export type ProfessionalType =
  | "TRIAGEM"
  | "PSICOLOGO"
  | "ASSISTENTE_SOCIAL"
  | "ASSESSOR_JURIDICO";

export type AppointmentStatus =
  | "AGENDADA"
  | "REALIZADA"
  | "CANCELADA"
  | "FALTOU";

export type AppointmentModality = "PRESENCIAL" | "ONLINE";

export type ConfirmationStatus = "PENDENTE" | "CONFIRMADO" | "RECUSADO";

export type AppointmentRiskLevel = "BAIXO" | "MEDIO" | "ELEVADO";

export const PROFESSIONAL_TYPES: ProfessionalType[] = [
  "TRIAGEM",
  "PSICOLOGO",
  "ASSISTENTE_SOCIAL",
  "ASSESSOR_JURIDICO",
];

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "AGENDADA",
  "REALIZADA",
  "CANCELADA",
  "FALTOU",
];

export const APPOINTMENT_MODALITIES: AppointmentModality[] = [
  "PRESENCIAL",
  "ONLINE",
];

export const PROFESSIONAL_TYPE_LABELS: Record<ProfessionalType, string> = {
  TRIAGEM: "Triagem",
  PSICOLOGO: "Psicologia",
  ASSISTENTE_SOCIAL: "Assistência social",
  ASSESSOR_JURIDICO: "Jurídico",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
  FALTOU: "Faltou",
};

export const MODALITY_LABELS: Record<AppointmentModality, string> = {
  PRESENCIAL: "Presencial",
  ONLINE: "Online",
};

export const CONFIRMATION_LABELS: Record<ConfirmationStatus, string> = {
  PENDENTE: "Pendente",
  CONFIRMADO: "Confirmado",
  RECUSADO: "Recusado",
};

/** Consulta como retornada por `GET /appointments`. */
export type ManagerAppointmentItem = {
  id: string;
  processoId: string;
  tipoProfissional: ProfessionalType;
  profissionalId: string;
  dataHora: string;
  /** Fim do atendimento (só quando o back retornar; ausente = legado). */
  dataHoraFim?: string | null;
  status: AppointmentStatus;
  observacoes: string | null;
  linkMeet: string | null;
  modalidade: AppointmentModality | null;
  confirmacaoProfissional: ConfirmationStatus;
  confirmacaoVitima: ConfirmationStatus;
  confirmadoProfissionalEm?: string | null;
  confirmadoVitimaEm?: string | null;
  motivoRecusa?: string | null;
  criadoEm: string;
  processo?: {
    id: string;
    status: string;
    vitimaId: string | null;
  };
  /** Preenchidos pela tela ao enriquecer com `GET /patients` (não vêm da API). */
  vitimaNome?: string | null;
  vitimaCampus?: string | null;
};

/** Detalhe de uma consulta (`GET /appointments/:id`). */
export type ManagerAppointmentDetail = ManagerAppointmentItem & {
  processo: {
    id: string;
    status: string;
    vitimaId?: string | null;
  };
};

/** Profissional disponível para agendamento (`GET /users?perfil=`). */
export type ProfessionalOption = {
  id: string;
  nome: string;
  email: string;
  perfil: ProfessionalType;
  ativo: boolean;
  registro: string | null;
};

/** Processo ENCAMINHADO exibido no seletor de agendamento (`GET /patients`). */
export type AppointmentProcessOption = {
  processoId: string;
  status: string;
  direcionadoPara: ProfessionalType | null;
  classificacaoRisco: AppointmentRiskLevel | null;
  abertoEm: string;
  vitimaNome: string;
  vitimaCampus: string;
  totalConsultas: number;
};

export type CreateAppointmentInput = {
  processoId: string;
  tipoProfissional: ProfessionalType;
  profissionalId: string;
  dataHora: string;
  /**
   * Fim do atendimento (ISO 8601). O back ainda não persiste a coluna
   * (Zod ignora o campo extra), mas o front já envia para compatibilidade
   * futura e usa para checar ocupação por intervalo.
   */
  dataHoraFim?: string | null;
  observacoes?: string | null;
  linkMeet?: string | null;
  modalidade?: AppointmentModality | null;
};

export type UpdateAppointmentInput = {
  observacoes?: string | null;
  linkMeet?: string | null;
  modalidade?: AppointmentModality | null;
  /** Término ISO 8601. Ausente = mantém; null = limpa (volta ao +30min legado). */
  dataHoraFim?: string | null;
};

export type AppointmentFormData = {
  processoId: string;
  tipoProfissional: ProfessionalType | "";
  profissionalId: string;
  dataLocal: string;
  /** Término livre no formato `AAAA-MM-DDTHH:mm` (hora local). */
  dataFim: string;
  modalidade: AppointmentModality | "";
  linkMeet: string;
  observacoes: string;
};

export type AppointmentFormErrors = Partial<
  Record<keyof AppointmentFormData, string>
>;

/** Dados mínimos de consulta usados pelo calendário (ocupação por profissional). */
export type CalendarAppointmentInfo = {
  dataHora: string;
  /** Fim do atendimento (ISO). Ausente em consultas antigas (assume +30 min). */
  dataHoraFim?: string | null;
  profissionalId: string;
  status: AppointmentStatus;
  /** Enriquecimento para a lista do dia (opcional, vem do loader). */
  processoId?: string;
  tipoProfissional?: ProfessionalType;
  vitimaNome?: string | null;
  vitimaCampus?: string | null;
};

/** Intervalo ocupado [start, end) em ms (imune a fuso). */
export type OccupiedInterval = {
  start: number;
  end: number;
};

/** Duração assumida quando a consulta não tem `dataHoraFim` (legado). */
export const LEGACY_APPOINTMENT_MINUTES = 30;

/** Grade de horários do calendário de agendamento (8h–21h30, 30 min). */
export const SLOT_START_HOUR = 8;
export const SLOT_END_HOUR = 22;
export const SLOT_MINUTES = 30;

/** Chave `AAAA-MM-DD` local de um ISO (para agrupar por dia). */
export function toLocalDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return toDayKey(date);
}

/**
 * Converte consultas AGENDADAS em intervalos de ocupação [início, fim).
 * Consultas sem `dataHoraFim` (legado/back atual) assumem 30 min.
 */
export function toOccupiedIntervals(
  appointments: CalendarAppointmentInfo[],
): OccupiedInterval[] {
  const intervals: OccupiedInterval[] = [];
  for (const appointment of appointments) {
    if (appointment.status !== "AGENDADA") continue;
    const start = new Date(appointment.dataHora).getTime();
    if (Number.isNaN(start)) continue;
    const rawEnd = appointment.dataHoraFim
      ? new Date(appointment.dataHoraFim).getTime()
      : Number.NaN;
    const end = Number.isNaN(rawEnd)
      ? start + LEGACY_APPOINTMENT_MINUTES * 60 * 1000
      : rawEnd;
    if (end <= start) continue;
    intervals.push({ start, end });
  }
  return intervals;
}

/** Primeiro intervalo ocupado que sobrepõe [start, end), ou null. */
export function findOverlappingInterval(
  intervals: OccupiedInterval[],
  start: number,
  end: number,
): OccupiedInterval | null {
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return (
    intervals.find(
      (interval) => interval.start < end && interval.end > start,
    ) ?? null
  );
}

export type TimeSlot = {
  /** Valor no formato aceito por `<input type="datetime-local">`. */
  value: string;
  label: string;
  disabled: boolean;
  occupied: boolean;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Gera os slots do dia (8h–21h30, de 30 em 30 min). Um slot fica indisponível
 * quando está no passado ou sobrepõe um intervalo ocupado
 * (`intervalo.start < slotEnd && intervalo.end > slotStart`, imune a fuso).
 */
export function buildDaySlots(
  day: Date,
  occupiedIsoDates: string[],
  now: number = Date.now(),
): TimeSlot[] {
  const intervals = toOccupiedIntervals(
    occupiedIsoDates.map((dataHora) => ({
      dataHora,
      profissionalId: "",
      status: "AGENDADA" as AppointmentStatus,
    })),
  );
  return buildDaySlotsWithIntervals(day, intervals, now);
}

/** Variante de `buildDaySlots` que recebe intervalos [início, fim). */
export function buildDaySlotsWithIntervals(
  day: Date,
  intervals: OccupiedInterval[],
  now: number = Date.now(),
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hours = SLOT_START_HOUR; hours < SLOT_END_HOUR; hours++) {
    for (let minutes = 0; minutes < 60; minutes += SLOT_MINUTES) {
      const start = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        hours,
        minutes,
        0,
        0,
      );
      const end = start.getTime() + SLOT_MINUTES * 60 * 1000;
      const isPast = start.getTime() <= now;
      const isOccupied =
        !isPast &&
        intervals.some(
          (interval) =>
            interval.start < end && interval.end > start.getTime(),
        );
      slots.push({
        value: `${toDayKey(start)}T${pad2(hours)}:${pad2(minutes)}`,
        label: `${pad2(hours)}:${pad2(minutes)}`,
        disabled: isPast || isOccupied,
        occupied: isOccupied,
      });
    }
  }
  return slots;
}

export type AppointmentDetailsFormData = {
  linkMeet: string;
  modalidade: AppointmentModality | "";
  observacoes: string;
  /** Término em `AAAA-MM-DDTHH:mm` (hora local). Vazio = manter o atual. */
  dataFim: string;
};

export type AppointmentDetailsErrors = Partial<
  Record<keyof AppointmentDetailsFormData, string>
>;

export type AppointmentActionData =
  | {
      ok: true;
      action: "agendar" | "editar" | "status" | "confirmar";
      id: string;
      status?: AppointmentStatus;
    }
  | { ok?: false; error: string; fieldErrors?: Record<string, string> };

export const EMPTY_APPOINTMENT_FORM: AppointmentFormData = {
  processoId: "",
  tipoProfissional: "",
  profissionalId: "",
  dataLocal: "",
  dataFim: "",
  modalidade: "",
  linkMeet: "",
  observacoes: "",
};

export const EMPTY_APPOINTMENT_DETAILS: AppointmentDetailsFormData = {
  linkMeet: "",
  modalidade: "",
  observacoes: "",
  dataFim: "",
};

export type AppointmentStatusFilter = "ALL" | AppointmentStatus;
export type AppointmentTypeFilter = "ALL" | ProfessionalType;

export type AppointmentFilters = {
  from: string;
  to: string;
  tipoProfissional: AppointmentTypeFilter;
  status: AppointmentStatusFilter;
  processoId: string;
  search: string;
};

export const EMPTY_APPOINTMENT_FILTERS: AppointmentFilters = {
  from: "",
  to: "",
  tipoProfissional: "ALL",
  status: "ALL",
  processoId: "",
  search: "",
};

export function parseAppointmentFilters(
  searchParams: URLSearchParams,
): AppointmentFilters {
  const rawStatus = (searchParams.get("status") ?? "ALL").toUpperCase();
  const status = (APPOINTMENT_STATUSES as string[]).includes(rawStatus)
    ? (rawStatus as AppointmentStatus)
    : "ALL";
  const rawType = (searchParams.get("tipo") ?? "ALL").toUpperCase();
  const tipoProfissional = (PROFESSIONAL_TYPES as string[]).includes(rawType)
    ? (rawType as ProfessionalType)
    : "ALL";
  return {
    from: searchParams.get("de")?.trim() || "",
    to: searchParams.get("ate")?.trim() || "",
    tipoProfissional,
    status,
    processoId: searchParams.get("processoId")?.trim() || "",
    search: searchParams.get("q")?.trim() || "",
  };
}

export function getProfessionalTypeLabel(
  tipo: ProfessionalType | null | undefined,
): string {
  return tipo ? PROFESSIONAL_TYPE_LABELS[tipo] : "—";
}

export function getAppointmentStatusLabel(status: AppointmentStatus): string {
  return APPOINTMENT_STATUS_LABELS[status] ?? status;
}

export function getModalityLabel(
  modalidade: AppointmentModality | null | undefined,
): string {
  return modalidade ? MODALITY_LABELS[modalidade] : "—";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// Re-exporta os formatadores centralizados (fonte única em shared/utils/date).
export {
  formatDate,
  formatDateTime,
  formatInterval,
  formatTime,
} from "../../shared/utils/date";

/** Converte um valor de `<input type="datetime-local">` em ISO 8601 (UTC). */
export function toApiDateTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Converte ISO em valor aceito por `<input type="datetime-local">` (hora local). */
export function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Limite inferior inclusivo (início do dia) para filtros `de`. */
export function toDayStartIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** Limite superior inclusivo (fim do dia) para filtros `ate`. */
export function toDayEndIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value.length === 10 ? `${value}T23:59:59.999` : value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** Converte ISO em `AAAA-MM-DD` (hora local) para os inputs de data. */
export function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

export function getProcessOptionLabel(process: AppointmentProcessOption): string {
  const name = process.vitimaNome?.trim() || "Sem nome";
  const campus = process.vitimaCampus?.trim();
  const id = process.processoId.slice(0, 8);
  return campus ? `${name} · ${campus} · ${id}` : `${name} · ${id}`;
}

/**
 * Processo que ainda pode receber a consulta de triagem (status ABERTO).
 * O back-end só aceita TRIAGEM em processo ABERTO ou EM_TRIAGEM.
 */
export function isTriageProcessOption(
  process: AppointmentProcessOption,
): boolean {
  return process.status === "ABERTO" || process.status === "EM_TRIAGEM";
}

/**
 * Processo ABERTO (triagem ainda não registrada). Selecionar um processo
 * ABERTO no formulário sugere o tipo TRIAGEM; EM_TRIAGEM/ENCAMINHADO
 * aceitam acompanhamento (agendar com o profissional encaminha).
 * TRIAGEM designada ou própria é válida em ABERTO/EM_TRIAGEM (back 30/10).
 */
export function isAwaitingTriageProcess(
  process: AppointmentProcessOption,
): boolean {
  return process.status === "ABERTO";
}

/** Perfis que podem conduzir a triagem (própria do gestor ou designada). */
export const TRIAGEM_PERFIS: Array<ProfessionalType | "GESTOR"> = [
  "GESTOR",
  "PSICOLOGO",
  "ASSISTENTE_SOCIAL",
];

/**
 * Opção do gestor para o seletor de responsável da triagem.
 * A triagem abre pré-preenchida com o gestor (fluxo original) e permite
 * trocar para psicólogo/assistente social (designada, back 30/10).
 */
export function toGestorProfessionalOption(gestor: {
  id: string;
  nome: string;
}): ProfessionalOption {
  return {
    id: gestor.id,
    nome: gestor.nome,
    email: "",
    perfil: "TRIAGEM",
    ativo: true,
    registro: null,
  };
}

export function buildProcessMap(
  processes: AppointmentProcessOption[],
): Map<string, AppointmentProcessOption> {
  return new Map(processes.map((process) => [process.processoId, process]));
}

/** Enriquece consultas com nome/campus da vítima, quando disponíveis. */
export function attachProcessInfo(
  appointments: ManagerAppointmentItem[],
  processes: Map<string, AppointmentProcessOption>,
): ManagerAppointmentItem[] {
  return appointments.map((appointment) => {
    const process = processes.get(appointment.processoId);
    if (!process) return appointment;
    return {
      ...appointment,
      vitimaNome: process.vitimaNome,
      vitimaCampus: process.vitimaCampus,
    };
  });
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function matchesSearch(
  appointment: ManagerAppointmentItem,
  search: string,
): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    appointment.processoId,
    appointment.vitimaNome,
    appointment.vitimaCampus,
    appointment.profissionalId,
    getProfessionalTypeLabel(appointment.tipoProfissional),
    getAppointmentStatusLabel(appointment.status),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return query.split(/\s+/).every((token) => haystack.includes(token));
}

export function matchesAppointmentFilters(
  appointment: ManagerAppointmentItem,
  filters: AppointmentFilters,
): boolean {
  if (
    filters.status !== "ALL" &&
    appointment.status !== filters.status
  ) {
    return false;
  }
  if (
    filters.tipoProfissional !== "ALL" &&
    appointment.tipoProfissional !== filters.tipoProfissional
  ) {
    return false;
  }
  if (filters.processoId && appointment.processoId !== filters.processoId) {
    return false;
  }
  if (filters.from || filters.to) {
    const time = new Date(appointment.dataHora).getTime();
    if (!Number.isNaN(time)) {
      const from = toDayStartIso(filters.from);
      const to = toDayEndIso(filters.to);
      if (from && time < new Date(from).getTime()) return false;
      if (to && time > new Date(to).getTime()) return false;
    }
  }
  return matchesSearch(appointment, filters.search);
}

export function filterAppointments(
  appointments: ManagerAppointmentItem[],
  filters: AppointmentFilters,
): ManagerAppointmentItem[] {
  return appointments.filter((appointment) =>
    matchesAppointmentFilters(appointment, filters),
  );
}

/** Próximas primeiro (mais próximas antes), depois as passadas (recentes antes). */
export function sortAppointments(
  appointments: ManagerAppointmentItem[],
  now: number = Date.now(),
): ManagerAppointmentItem[] {
  return [...appointments].sort((a, b) => {
    const timeA = new Date(a.dataHora).getTime();
    const timeB = new Date(b.dataHora).getTime();
    const upcomingA = timeA >= now;
    const upcomingB = timeB >= now;
    if (upcomingA !== upcomingB) return upcomingA ? -1 : 1;
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
      return upcomingA ? timeA - timeB : timeB - timeA;
    }
    return a.id.localeCompare(b.id);
  });
}

export const APPOINTMENTS_PER_PAGE = 20;

export type PaginatedAppointments = {
  items: ManagerAppointmentItem[];
  page: number;
  totalPages: number;
  total: number;
};

export function parseAppointmentPage(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("page") ?? 1);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.floor(raw);
}

export function paginateAppointments(
  appointments: ManagerAppointmentItem[],
  page: number,
  perPage: number = APPOINTMENTS_PER_PAGE,
): PaginatedAppointments {
  const total = appointments.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    items: appointments.slice(start, start + perPage),
    page: safePage,
    totalPages,
    total,
  };
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateAppointmentForm(
  data: AppointmentFormData,
  now: number = Date.now(),
): AppointmentFormErrors {
  const errors: AppointmentFormErrors = {};

  if (!data.processoId) {
    errors.processoId = "Selecione o processo.";
  }
  if (!data.tipoProfissional) {
    errors.tipoProfissional = "Selecione o tipo de profissional.";
  }
  if (!data.profissionalId) {
    errors.profissionalId = "Selecione o profissional.";
  }

  if (!data.dataLocal.trim()) {
    errors.dataLocal = "Informe a data e a hora.";
  } else {
    const when = new Date(data.dataLocal).getTime();
    if (Number.isNaN(when)) {
      errors.dataLocal = "Data/hora inválida.";
    } else if (when <= now) {
      errors.dataLocal = "A data/hora deve ser futura.";
    }
  }

  if (!data.dataFim.trim()) {
    errors.dataFim = "Informe a hora de término.";
  } else {
    const start = new Date(data.dataLocal).getTime();
    const end = new Date(data.dataFim).getTime();
    if (Number.isNaN(end)) {
      errors.dataFim = "Término inválido.";
    } else if (!Number.isNaN(start) && end <= start) {
      errors.dataFim = "O término deve ser posterior ao início.";
    } else if (end <= now) {
      errors.dataFim = "O término deve ser futuro.";
    }
  }

  const link = data.linkMeet.trim();
  if (!data.modalidade) {
    errors.modalidade = "Informe a modalidade (Presencial ou Online).";
    if (link && !isValidUrl(link)) {
      errors.linkMeet = "Informe uma URL completa e válida.";
    }
  } else if (data.modalidade === "ONLINE") {
    if (!link) {
      errors.linkMeet = "Informe o link da sala (ex.: Google Meet).";
    } else if (!isValidUrl(link)) {
      errors.linkMeet = "Informe uma URL completa e válida.";
    }
  } else if (link) {
    // PRESENCIAL: link da sala não se aplica.
    errors.linkMeet =
      "Link da sala não deve ser preenchido para atendimento presencial.";
  }

  const observacoes = data.observacoes.trim();
  if (observacoes && observacoes.length < 3) {
    errors.observacoes = "Observação muito curta (mín. 3 caracteres).";
  } else if (data.observacoes.length > 2000) {
    errors.observacoes = "Observação deve ter no máximo 2000 caracteres.";
  }

  return errors;
}

export function toCreateAppointmentInput(
  data: AppointmentFormData,
): CreateAppointmentInput | null {
  const dataHora = toApiDateTime(data.dataLocal);
  const dataHoraFim = toApiDateTime(data.dataFim);
  if (!dataHora || !dataHoraFim) return null;
  if (!data.processoId || !data.tipoProfissional || !data.profissionalId) {
    return null;
  }
  return {
    processoId: data.processoId,
    tipoProfissional: data.tipoProfissional,
    profissionalId: data.profissionalId,
    dataHora,
    dataHoraFim,
    observacoes: data.observacoes.trim() || null,
    linkMeet: data.linkMeet.trim() || null,
    modalidade: data.modalidade || null,
  };
}

export function formFromAppointment(
  appointment: ManagerAppointmentItem,
): AppointmentFormData {
  return {
    processoId: appointment.processoId,
    tipoProfissional: appointment.tipoProfissional,
    profissionalId: appointment.profissionalId,
    dataLocal: toDateTimeLocalValue(appointment.dataHora),
    dataFim: appointment.dataHoraFim
      ? toDateTimeLocalValue(appointment.dataHoraFim)
      : "",
    modalidade: appointment.modalidade ?? "",
    linkMeet: appointment.linkMeet ?? "",
    observacoes: appointment.observacoes ?? "",
  };
}

export function detailsFromAppointment(
  appointment: ManagerAppointmentItem,
): AppointmentDetailsFormData {
  return {
    linkMeet: appointment.linkMeet ?? "",
    modalidade: appointment.modalidade ?? "",
    observacoes: appointment.observacoes ?? "",
    dataFim: appointment.dataHoraFim
      ? toDateTimeLocalValue(appointment.dataHoraFim)
      : "",
  };
}

/** Duração máxima aceita pelo back no PATCH (8h). */
export const MAX_APPOINTMENT_DURATION_MS = 8 * 60 * 60 * 1000;

export function validateAppointmentDetails(
  data: AppointmentDetailsFormData,
  inicioIso?: string,
): AppointmentDetailsErrors {
  const errors: AppointmentDetailsErrors = {};
  const link = data.linkMeet.trim();
  if (link && !isValidUrl(link)) {
    errors.linkMeet = "Informe uma URL completa e válida.";
  }
  const observacoes = data.observacoes.trim();
  if (observacoes && observacoes.length < 3) {
    errors.observacoes = "Observação muito curta (mín. 3 caracteres).";
  } else if (data.observacoes.length > 2000) {
    errors.observacoes = "Observação deve ter no máximo 2000 caracteres.";
  }
  const fimRaw = data.dataFim.trim();
  if (fimRaw) {
    const fim = new Date(fimRaw).getTime();
    if (Number.isNaN(fim)) {
      errors.dataFim = "Término inválido.";
    } else if (fim <= Date.now()) {
      errors.dataFim = "O término deve ser futuro.";
    } else if (inicioIso) {
      const inicio = new Date(inicioIso).getTime();
      if (!Number.isNaN(inicio)) {
        if (fim <= inicio) {
          errors.dataFim = "O término deve ser posterior ao início.";
        } else if (fim - inicio > MAX_APPOINTMENT_DURATION_MS) {
          errors.dataFim = "Duração máxima de 8 horas.";
        }
      }
    }
  }
  return errors;
}

export function toUpdateAppointmentInput(
  data: AppointmentDetailsFormData,
): UpdateAppointmentInput {
  const dataFim = data.dataFim.trim();
  // Vazio = mantém o término atual (chave omitida no JSON). Inválido =
  // repassa o valor bruto para o back devolver 400 com field error.
  const dataHoraFim = dataFim ? (toApiDateTime(dataFim) ?? dataFim) : undefined;
  return {
    linkMeet: data.linkMeet.trim() || null,
    modalidade: data.modalidade || null,
    observacoes: data.observacoes.trim() || null,
    ...(dataHoraFim !== undefined ? { dataHoraFim } : {}),
  };
}
