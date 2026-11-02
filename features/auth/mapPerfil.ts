import type { Role, speciality, User } from "./types/login";
import type { PayloadToken } from "./require-user.server";

const PROFISSIONAL_ENUMS = [
  "PSICOLOGO",
  "ASSISTENTE_SOCIAL",
  "ASSESSOR_JURIDICO",
] as const;

const ROLE_MAP: Record<string, Role> = {
  VITIMA: "user",
  GESTOR: "manager",
  ADMIN: "admin",
  PSICOLOGO: "professional",
  ASSISTENTE_SOCIAL: "professional",
  ASSESSOR_JURIDICO: "professional",
};

const SPECIALITY_MAP: Record<string, speciality> = {
  PSICOLOGO: "psicologo",
  ASSISTENTE_SOCIAL: "assistente_social",
  ASSESSOR_JURIDICO: "assessor_juridico",
};

export function mapPerfilParaUser(payload: PayloadToken): User {
  const raw = payload.profile ?? payload.perfil ?? "";
  const normalized = raw.trim().toUpperCase();
  const perfilBackend = normalized;

  const role: Role = ROLE_MAP[normalized] ?? (normalized.toLowerCase() as Role);

  const isProfissional = (PROFISSIONAL_ENUMS as readonly string[]).includes(perfilBackend);
  const speciality: speciality = isProfissional
    ? (SPECIALITY_MAP[perfilBackend] ?? (perfilBackend.toLowerCase() as speciality))
    : null;

  const name = payload.name ?? payload.nome ?? "";

  return {
    id: payload.sub,
    email: payload.email,
    name,
    role,
    speciality,
  };
}
