import { apiFetchJson } from "../auth/apiFetch.server";
import type { MyAppointment } from "./consultasUtils";

const DEFAULT_ERROR =
  "Não foi possível carregar suas consultas. Tente novamente em instantes.";

export const consultasApi = {
  /** Próximas consultas AGENDADAS da própria vítima (campos mínimos, LGPD). */
  async listMine(request: Request): Promise<MyAppointment[]> {
    return apiFetchJson<MyAppointment[]>(
      request,
      "/appointments/minhas",
      undefined,
      DEFAULT_ERROR,
    );
  },

  /** Confirma a presença da vítima (idempotente). */
  async confirm(request: Request, id: string): Promise<MyAppointment> {
    return apiFetchJson<MyAppointment>(
      request,
      `/appointments/${encodeURIComponent(id)}/confirmar`,
      { method: "POST" },
      "Não foi possível confirmar a consulta. Tente novamente em instantes.",
    );
  },

  /** Recusa a consulta (motivo opcional); o gestor será avisado para reagendar. */
  async refuse(
    request: Request,
    id: string,
    motivo: string | null,
  ): Promise<MyAppointment> {
    return apiFetchJson<MyAppointment>(
      request,
      `/appointments/${encodeURIComponent(id)}/recusar`,
      {
        method: "POST",
        body: JSON.stringify(motivo ? { motivo } : {}),
      },
      "Não foi possível recusar a consulta. Tente novamente em instantes.",
    );
  },
};
