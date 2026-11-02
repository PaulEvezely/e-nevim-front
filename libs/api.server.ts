/**
 * Central de acesso ao back-end NEVIM (server-side).
 * Todos os módulos `*.server.ts` devem usar `getApiBaseUrl()` e `ApiError`
 * em vez de replicar `process.env.API_URL` e parsing de erro.
 */

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];

  constructor(
    message: string,
    opts?: {
      status?: number;
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts?.status ?? 500;
    this.fieldErrors = opts?.fieldErrors ?? {};
    this.formErrors = opts?.formErrors ?? [];
  }
}

export function getApiBaseUrl(): string {
  const raw = process.env.API_URL ?? "";
  if (!raw) {
    throw new ApiError("Serviço indisponível. Tente novamente em instantes.", {
      status: 503,
    });
  }
  return raw.replace(/\/+$/, "");
}

/** Mensagem amigável genérica (RFF17) — nunca expõe detalhe técnico. */
export function toFriendlyMessage(status: number): string {
  if (status === 401)
    return "Sessão expirada. Entre novamente para continuar.";
  if (status === 403)
    return "Você não tem permissão para realizar esta ação.";
  if (status === 404) return "Registro não encontrado.";
  if (status === 409) return "Este registro já existe.";
  if (status === 410)
    return "Este link expirou ou já foi utilizado. Solicite um novo ao NEVIM.";
  if (status === 422 || status === 400)
    return "Corrija os campos destacados antes de enviar.";
  if (status >= 500 || status === 503)
    return "Não foi possível concluir agora. Tente novamente em instantes.";
  return "Não foi possível concluir agora. Tente novamente em instantes.";
}

type BackendErrorBody = {
  error?: string;
  message?: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[]>;
  };
} | null;

/** Extrai `{ message, fieldErrors, formErrors }` do corpo de erro do back. */
export async function parseApiError(
  res: Response,
  fallbackMessage?: string,
): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as BackendErrorBody;
  const message =
    body?.error ??
    body?.message ??
    fallbackMessage ??
    toFriendlyMessage(res.status);
  return new ApiError(message, {
    status: res.status,
    fieldErrors: body?.details?.fieldErrors ?? {},
    formErrors: body?.details?.formErrors ?? [],
  });
}
