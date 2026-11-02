import type { AppointmentReminder, NotificationsResponse } from "./types";

const LIST_URL = "/api/notifications";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Não foi possível concluir a operação.");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchNotificationsClient(params?: {
  limit?: number;
  offset?: number;
  lida?: boolean;
}): Promise<NotificationsResponse> {
  const search = new URLSearchParams();
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.offset !== undefined) search.set("offset", String(params.offset));
  if (params?.lida !== undefined) search.set("lida", String(params.lida));
  const query = search.toString();
  return requestJson<NotificationsResponse>(
    `${LIST_URL}${query ? `?${query}` : ""}`,
  );
}

export async function markNotificationReadClient(id: string): Promise<void> {
  await requestJson<unknown>(LIST_URL, {
    method: "POST",
    body: JSON.stringify({ intent: "read", id }),
  });
}

export async function markAllNotificationsReadClient(): Promise<void> {
  await requestJson<unknown>(LIST_URL, {
    method: "POST",
    body: JSON.stringify({ intent: "read-all" }),
  });
}

export async function fetchAppointmentRemindersClient(): Promise<
  AppointmentReminder[]
> {
  return requestJson<AppointmentReminder[]>("/api/reminders");
}
