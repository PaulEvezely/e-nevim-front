import type { speciality } from "../auth/types/login";

/**
 * Selo do cabeçalho por papel do profissional (maiúsculas, mesmo padrão de
 * GESTOR/ADMIN). Fallback genérico quando a speciality é desconhecida.
 */
export function getProfessionalHeaderLabel(
  value: speciality | null | undefined,
): string {
  switch (value) {
    case "psicologo":
      return "PSICÓLOGO";
    case "assistente_social":
      return "ASSISTENTE SOCIAL";
    case "assessor_juridico":
      return "ASSESSOR JURÍDICO";
    default:
      return "PROFISSIONAL";
  }
}

/** FRIDA é restrito a psicólogo (RFF07) — demais perfis só leem. */
export function isPsicologo(
  value: speciality | null | undefined,
): boolean {
  return value === "psicologo";
}

/**
 * Quem pode escrever FRIDA: psicólogo (psicologia + triagem própria) e
 * assistente social (triagem designada; edita qualquer FRIDA, inclusive de
 * gestor/psicólogo). Demais perfis só leem.
 */
export function isFridaWriter(
  value: speciality | null | undefined,
): boolean {
  return value === "psicologo" || value === "assistente_social";
}
