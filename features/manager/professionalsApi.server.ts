import { apiFetchJson } from "../auth/apiFetch.server";
import { ApiError } from "../../libs/api.server";
import type {
  CreateProfessionalInput,
  ManagedProfessional,
  ProfessionalFilters,
  ProfessionalProfile,
} from "./professionalsUtils";
import { PROFESSIONAL_PROFILES } from "./professionalsUtils";

const DEFAULT_LIST_ERROR =
  "Não foi possível carregar os profissionais. Tente novamente em instantes.";
const DEFAULT_CREATE_ERROR =
  "Não foi possível cadastrar o profissional. Tente novamente em instantes.";
const DEFAULT_ACTIVE_ERROR =
  "Não foi possível atualizar o profissional. Tente novamente em instantes.";

type BackendProfessional = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  criadoEm: string;
  psicologo?: { id: string; crp: string } | null;
  assistenteSocial?: { id: string; cress: string } | null;
  assessorJuridico?: { id: string; oab: string } | null;
};

type BackendProfessionalPage = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  usuarios: BackendProfessional[];
};

function getRegistro(user: BackendProfessional): string | null {
  if (user.perfil === "PSICOLOGO") return user.psicologo?.crp ?? null;
  if (user.perfil === "ASSISTENTE_SOCIAL")
    return user.assistenteSocial?.cress ?? null;
  if (user.perfil === "ASSESSOR_JURIDICO")
    return user.assessorJuridico?.oab ?? null;
  return null;
}

function toManaged(user: BackendProfessional): ManagedProfessional {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil as ProfessionalProfile,
    registro: getRegistro(user),
    ativo: user.ativo,
    criadoEm: user.criadoEm,
  };
}

export type ProfessionalListResult = {
  professionals: ManagedProfessional[];
  total: number;
  page: number;
  totalPages: number;
  counts: Record<ProfessionalProfile, number>;
};

export type CreateProfessionalResult = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  /** Retornado pelo back quando o e-mail de convite for implementado. */
  notificationStatus?: string | null;
};

async function fetchProfessionalPage(
  request: Request,
  perfil: ProfessionalProfile | undefined,
  search: string,
  page: number,
  limit: number,
): Promise<BackendProfessionalPage> {
  const params = new URLSearchParams();
  if (perfil) params.set("perfil", perfil);
  if (search) params.set("q", search);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return apiFetchJson<BackendProfessionalPage>(
    request,
    `/users?${params.toString()}`,
    undefined,
    DEFAULT_LIST_ERROR,
  );
}

/**
 * Lista profissionais (só os 3 perfis) com busca server-side e paginação.
 * Traz contagens por perfil para os chips (requisições leves, limit=1).
 */
export async function listProfessionals(
  request: Request,
  filters: ProfessionalFilters,
  page: number,
  limit: number,
): Promise<ProfessionalListResult> {
  const perfil =
    filters.perfil === "ALL" ? undefined : (filters.perfil as ProfessionalProfile);
  const [list, ...counts] = await Promise.all([
    fetchProfessionalPage(request, perfil, filters.search, page, limit),
    ...PROFESSIONAL_PROFILES.map((p) =>
      fetchProfessionalPage(request, p, filters.search, 1, 1).catch(
        () => ({ total: 0 }) as Partial<BackendProfessionalPage>,
      ),
    ),
  ]);
  const totals: Record<ProfessionalProfile, number> = {
    PSICOLOGO: 0,
    ASSISTENTE_SOCIAL: 0,
    ASSESSOR_JURIDICO: 0,
  };
  PROFESSIONAL_PROFILES.forEach((p, index) => {
    totals[p] = counts[index]?.total ?? 0;
  });
  return {
    professionals: (list.usuarios ?? [])
      .filter((user) =>
        (PROFESSIONAL_PROFILES as string[]).includes(user.perfil),
      )
      .map(toManaged),
    total: list.total,
    page: list.page,
    totalPages: Math.max(1, list.totalPages || 1),
    counts: totals,
  };
}

/** Mapeia 409 do back (email/registro duplicado) para erro de campo. */
export function mapCreateFieldError(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.status !== 409) return {};
  const message = (err.message || "").toLowerCase();
  if (message.includes("email")) {
    return { email: "Este e-mail já está cadastrado." };
  }
  if (
    message.includes("crp") ||
    message.includes("cress") ||
    message.includes("oab") ||
    message.includes("registro")
  ) {
    return { registro: "Este registro já está cadastrado." };
  }
  return {};
}

export async function createProfessional(
  request: Request,
  input: CreateProfessionalInput,
): Promise<CreateProfessionalResult> {
  const payload = await apiFetchJson<CreateProfessionalResult>(
    request,
    "/auth/register-professional",
    {
      method: "POST",
      body: JSON.stringify({
        nome: input.nome,
        email: input.email,
        senha: input.senha,
        perfil: input.perfil,
        registro: input.registro,
      }),
    },
    DEFAULT_CREATE_ERROR,
  );
  return payload;
}

export async function toggleProfessionalActive(
  request: Request,
  id: string,
  ativo: boolean,
): Promise<{ id: string; ativo: boolean }> {
  return apiFetchJson<{ id: string; ativo: boolean }>(
    request,
    `/users/${encodeURIComponent(id)}/ativo`,
    {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    },
    DEFAULT_ACTIVE_ERROR,
  );
}
