import { useCallback, useEffect, useRef, useState } from "react";
import type { Role } from "../auth/types/login";
import { fetchAppointmentRemindersClient } from "./notificationsApi.client";
import {
  formatSaoPauloDayLabel,
  formatSaoPauloTime,
  hoursUntil,
} from "./format";
import type { AppointmentReminder } from "./types";

/** Mesmo ritmo do refresh de notificações (near-real-time). */
const POLL_INTERVAL_MS = 60 * 1000;
const STORAGE_PREFIX = "nevim:reminder:";
const AUTO_DISMISS_MS = 10_000;

const PROFESSIONAL_LABEL: Record<string, string> = {
  TRIAGEM: "Triagem",
  PSICOLOGO: "Psicologia",
  ASSISTENTE_SOCIAL: "Assistente Social",
  ASSESSOR_JURIDICO: "Jurídico",
};

export interface AppointmentReminderToast {
  id: string;
  title: string;
  message: string;
  /** Agenda correspondente (mesmo destino das notificações de consulta). */
  route: string | null;
}

function buildToast(
  role: Role | null,
  reminder: AppointmentReminder,
): AppointmentReminderToast {
  const tipo = PROFESSIONAL_LABEL[reminder.tipoProfissional] ?? "atendimento";
  const day = formatSaoPauloDayLabel(reminder.dataHora);
  const time = formatSaoPauloTime(reminder.dataHora);
  const hours = hoursUntil(reminder.dataHora);

  const message =
    role === "user"
      ? `Sua consulta de ${tipo} é ${day} às ${time}.`
      : `Consulta de ${tipo} ${day} às ${time}.`;

  return {
    id: `${reminder.id}:${reminder.dataHora}`,
    title: `Consulta em ${hours} h`,
    message,
    route:
      role === "user"
        ? "/user/consultas"
        : role === "professional"
          ? "/professional/appointments"
          : null,
  };
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function useAppointmentReminders(enabled: boolean, role: Role | null) {
  const [reminders, setReminders] = useState<AppointmentReminderToast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setReminders((current) => current.filter((item) => item.id !== id));
  }, []);

  const check = useCallback(async () => {
    // Gestor (e o legado "admin", que o back nunca emite) não recebe
    // lembretes voláteis — espelha GET /api/reminders.
    if (!enabled || !role || role === "admin" || role === "manager") return;

    try {
      const items = await fetchAppointmentRemindersClient();
      for (const item of items) {
        const key = `${STORAGE_PREFIX}${item.id}`;
        if (readStored(key) === item.dataHora) continue;
        writeStored(key, item.dataHora);

        const toast = buildToast(role, item);
        setReminders((current) =>
          current.some((entry) => entry.id === toast.id)
            ? current
            : [...current, toast],
        );

        const timer = window.setTimeout(
          () => dismiss(toast.id),
          AUTO_DISMISS_MS,
        );
        timersRef.current.set(toast.id, timer);
      }
    } catch {
      return;
    }
  }, [enabled, role, dismiss]);

  useEffect(() => {
    if (!enabled) return;
    void check();
    const interval = window.setInterval(() => {
      void check();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [enabled, check]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return { reminders, dismiss };
}
