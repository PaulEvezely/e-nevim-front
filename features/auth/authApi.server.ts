import {
  getApiBaseUrl,
  parseApiError,
  toFriendlyMessage,
} from "../../libs/api.server";
import { apiFetchJson } from "./apiFetch.server";

export type UsuarioBackend = {
  id: string;
  email: string;
  profile?: string;
  perfil?: string;
  nome?: string;
};

export type LoginSuccessResponse = {
  token: string;
  usuario: UsuarioBackend;
};

export type CurrentUser = UsuarioBackend & {
  ativo?: boolean;
  vitima?: unknown;
  psicologo?: unknown;
  assistenteSocial?: unknown;
  assessorJuridico?: unknown;
};

export type UpdateProfilePayload = Partial<{
  nome: string;
  campus: string;
  curso: string;
  matricula: string;
  estadoCivil: string;
  sexo: string;
  genero: string;
  etnia: string;
  escolaridade: string;
  cotista: boolean;
  endereco: string;
  cidade: string;
  cep: string;
}>;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao serviço. Tente novamente em instantes.",
    );
  }
  if (!res.ok) {
    const err = await parseApiError(res);
    throw new Error(err.message || toFriendlyMessage(err.status));
  }
  return (await res.json()) as T;
}

export const authApi = {
  async login(email: string, senha: string): Promise<LoginSuccessResponse> {
    return postJson<LoginSuccessResponse>("/auth/login", { email, senha });
  },

  /** Retorna o usuário autenticado (`GET /auth/me`). Exige `Request` p/ token. */
  async me(request: Request): Promise<CurrentUser> {
    return apiFetchJson<CurrentUser>(
      request,
      "/auth/me",
      undefined,
      "Não foi possível carregar seus dados. Tente novamente em instantes.",
    );
  },

  /** Atualiza dados do próprio perfil (`PATCH /auth/me`). */
  async updateMe(
    request: Request,
    payload: UpdateProfilePayload,
  ): Promise<CurrentUser> {
    return apiFetchJson<CurrentUser>(
      request,
      "/auth/me",
      { method: "PATCH", body: JSON.stringify(payload) },
      "Não foi possível atualizar seus dados. Tente novamente em instantes.",
    );
  },

  /** Troca a própria senha (`PATCH /auth/me/password`). */
  async updatePassword(
    request: Request,
    payload: {
      senhaAtual: string;
      novaSenha: string;
      confirmarNovaSenha: string;
    },
  ): Promise<{ ok: true }> {
    return apiFetchJson<{ ok: true }>(
      request,
      "/auth/me/password",
      { method: "PATCH", body: JSON.stringify(payload) },
      "Não foi possível alterar sua senha. Tente novamente em instantes.",
    );
  },
};
