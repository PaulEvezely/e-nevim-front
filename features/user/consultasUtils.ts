import {
  MODALITY_LABELS,
  PROFESSIONAL_TYPE_LABELS,
  formatDate,
  formatTime,
  type AppointmentModality,
  type AppointmentStatus,
  type ConfirmationStatus,
  type ProfessionalType,
} from "../manager/appointmentUtils";

export type MyAppointment = {
  id: string;
  tipoProfissional: ProfessionalType;
  dataHora: string;
  modalidade: AppointmentModality | null;
  status: AppointmentStatus;
  linkMeet: string | null;
  confirmacaoProfissional: ConfirmationStatus;
  confirmacaoVitima: ConfirmationStatus;
};

export type ConsultaActionData =
  | { ok: true; action: "confirmar" | "recusar"; id: string }
  | { ok?: false; error: string };

export function getTypeLabel(tipo: ProfessionalType): string {
  return PROFESSIONAL_TYPE_LABELS[tipo] ?? tipo;
}

export function getModalityLabel(
  modalidade: AppointmentModality | null,
): string {
  return modalidade ? MODALITY_LABELS[modalidade] : "A definir";
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getDayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffDays = Math.round(
    (startOfDay(date) - startOfDay(now)) / 86_400_000,
  );
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  return formatDate(iso);
}

export function getAppointmentTime(iso: string): string {
  return formatTime(iso);
}

export function isConfirmedByVictim(appointment: MyAppointment): boolean {
  return appointment.confirmacaoVitima === "CONFIRMADO";
}

export function isOnline(appointment: MyAppointment): boolean {
  return appointment.modalidade === "ONLINE";
}

/** Motivo de recusa é opcional; se informado, deve ter 3–500 caracteres. */
export function validateRefusalReason(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length < 3) {
    return "Descreva o motivo em pelo menos 3 caracteres.";
  }
  if (trimmed.length > 500) {
    return "O motivo deve ter no máximo 500 caracteres.";
  }
  return null;
}
