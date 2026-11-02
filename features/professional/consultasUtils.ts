import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
  type AppointmentStatusFilter,
  type ManagerAppointmentItem,
} from "../manager/appointmentUtils";

export type { AppointmentStatusFilter } from "../manager/appointmentUtils";

export type ProfessionalAppointment = ManagerAppointmentItem;

export type ProfessionalActionData =
  | {
      ok: true;
      action: "editar" | "status" | "confirmar";
      id: string;
      status?: AppointmentStatus;
    }
  | { ok?: false; error: string; fieldErrors?: Record<string, string> };

export const PROFESSIONAL_STATUS_OPTIONS: {
  value: AppointmentStatusFilter;
  label: string;
}[] = [
  { value: "ALL", label: "Todas" },
  { value: "AGENDADA", label: "Agendadas" },
  { value: "REALIZADA", label: "Realizadas" },
  { value: "CANCELADA", label: "Canceladas" },
  { value: "FALTOU", label: "Faltou" },
];

export const EMPTY_STATUS_COUNTS: Record<AppointmentStatusFilter, number> = {
  ALL: 0,
  AGENDADA: 0,
  REALIZADA: 0,
  CANCELADA: 0,
  FALTOU: 0,
};

export function parseProfessionalStatusFilter(
  searchParams: URLSearchParams,
): AppointmentStatusFilter {
  const raw = (searchParams.get("status") ?? "ALL").toUpperCase();
  return (APPOINTMENT_STATUSES as string[]).includes(raw)
    ? (raw as AppointmentStatus)
    : "ALL";
}

export function countByStatus(
  appointments: ProfessionalAppointment[],
): Record<AppointmentStatusFilter, number> {
  const counts: Record<AppointmentStatusFilter, number> = {
    ...EMPTY_STATUS_COUNTS,
  };
  for (const appointment of appointments) {
    counts.ALL += 1;
    counts[appointment.status] += 1;
  }
  return counts;
}

export function filterByStatus(
  appointments: ProfessionalAppointment[],
  status: AppointmentStatusFilter,
): ProfessionalAppointment[] {
  if (status === "ALL") return appointments;
  return appointments.filter((appointment) => appointment.status === status);
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
