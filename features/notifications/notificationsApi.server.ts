import { apiFetchJson } from "../auth/apiFetch.server";
import type { NotificationsResponse } from "./types";

const DEFAULT_LIST_ERROR =
  "Não foi possível carregar as notificações. Tente novamente em instantes.";

export async function fetchNotificationsPage(
  request: Request,
  params?: { limit?: number; offset?: number; lida?: boolean },
): Promise<NotificationsResponse> {
  const search = new URLSearchParams();
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.offset !== undefined) search.set("offset", String(params.offset));
  if (params?.lida !== undefined) search.set("lida", String(params.lida));
  const query = search.toString();
  return apiFetchJson<NotificationsResponse>(
    request,
    `/notifications${query ? `?${query}` : ""}`,
    undefined,
    DEFAULT_LIST_ERROR,
  );
}

export async function markNotificationRead(
  request: Request,
  id: string,
): Promise<void> {
  await apiFetchJson<unknown>(
    request,
    `/notifications/${encodeURIComponent(id)}/ler`,
    { method: "PATCH" },
    "Não foi possível marcar a notificação como lida.",
  );
}

export async function markAllNotificationsRead(
  request: Request,
): Promise<void> {
  await apiFetchJson<unknown>(
    request,
    "/notifications/ler-todas",
    { method: "PATCH" },
    "Não foi possível marcar as notificações como lidas.",
  );
}
