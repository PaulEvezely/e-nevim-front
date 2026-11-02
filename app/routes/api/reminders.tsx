import { getOptionalUser } from "../../../features/auth/require-user.server";
import { apiFetchJson } from "../../../features/auth/apiFetch.server";
import type { AppointmentReminder } from "../../../features/notifications/types";

const REMINDER_WINDOW_MS = 12 * 60 * 60 * 1000;

type BackendAppointment = {
  id: string;
  tipoProfissional: string;
  dataHora: string;
  status: string;
  modalidade: string | null;
  linkMeet: string | null;
};

function toReminder(item: BackendAppointment): AppointmentReminder {
  return {
    id: item.id,
    tipoProfissional: item.tipoProfissional,
    dataHora: item.dataHora,
    modalidade: item.modalidade ?? null,
    linkMeet: item.linkMeet ?? null,
  };
}

function filterWindow(items: BackendAppointment[]): AppointmentReminder[] {
  const now = Date.now();
  const limit = now + REMINDER_WINDOW_MS;
  return items
    .filter((item) => {
      if (item.status !== "AGENDADA") return false;
      const time = new Date(item.dataHora).getTime();
      return Number.isFinite(time) && time >= now && time <= limit;
    })
    .sort(
      (a, b) =>
        new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime(),
    )
    .map(toReminder);
}

export async function loader({ request }: { request: Request }) {
  const user = await getOptionalUser(request);
  if (!user) {
    return Response.json({ error: "Sessão expirada." }, { status: 401 });
  }

  if (user.role === "admin" || user.role === "manager") {
    return Response.json([] satisfies AppointmentReminder[]);
  }

  try {
    if (user.role === "user") {
      const items = await apiFetchJson<BackendAppointment[]>(
        request,
        "/appointments/minhas",
        undefined,
        "Não foi possível carregar as consultas.",
      );
      return Response.json(filterWindow(items));
    }

    const now = new Date();
    const limit = new Date(now.getTime() + REMINDER_WINDOW_MS);
    const params = new URLSearchParams({
      de: now.toISOString(),
      ate: limit.toISOString(),
    });
    const items = await apiFetchJson<BackendAppointment[]>(
      request,
      `/appointments?${params.toString()}`,
      undefined,
      "Não foi possível carregar as consultas.",
    );
    return Response.json(filterWindow(items));
  } catch {
    return Response.json(
      { error: "Não foi possível carregar as consultas." },
      { status: 502 },
    );
  }
}
