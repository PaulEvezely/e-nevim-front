import { getSession } from "./cookie.server";
import { getApiBaseUrl, parseApiError } from "../../libs/api.server";

/** Extrai o JWT da sessão (cookie `__nevim_session`). */
export async function getTokenFromRequest(
  request: Request,
): Promise<string | null> {
  const session = await getSession(request.headers.get("Cookie"));
  return session.get("token") ?? null;
}

/** Monta headers de autenticação para um token conhecido. */
export function getAuthHeaders(token: string | null): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Fetch autenticado contra o back-end.
 * Mantém compatibilidade com chamadas existentes: retorna `Response`.
 */
export async function apiFetch(
  request: Request,
  path: string,
  init?: RequestInit,
) {
  const token = await getTokenFromRequest(request);

  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const isFormData = init?.body instanceof FormData;
  if (!headers.has("Content-Type") && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });
}

/**
 * Variante tipada: faz `apiFetch`, lança `ApiError` amigável (RFF17)
 * em caso de falha e retorna o JSON já parseado em caso de sucesso.
 */
export async function apiFetchJson<T>(
  request: Request,
  path: string,
  init?: RequestInit,
  fallbackMessage?: string,
): Promise<T> {
  const res = await apiFetch(request, path, init);
  if (!res.ok) {
    throw await parseApiError(res, fallbackMessage);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
