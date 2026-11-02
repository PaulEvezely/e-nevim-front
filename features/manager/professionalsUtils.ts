/** Tipos e helpers puros da tela de cadastro de profissionais do gestor. */

export type ProfessionalProfile =
  | "PSICOLOGO"
  | "ASSISTENTE_SOCIAL"
  | "ASSESSOR_JURIDICO";

export const PROFESSIONAL_PROFILES: ProfessionalProfile[] = [
  "PSICOLOGO",
  "ASSISTENTE_SOCIAL",
  "ASSESSOR_JURIDICO",
];

export const PROFESSIONAL_PROFILE_LABELS: Record<ProfessionalProfile, string> = {
  PSICOLOGO: "Psicologia",
  ASSISTENTE_SOCIAL: "Assistência social",
  ASSESSOR_JURIDICO: "Jurídico",
};

/** Rótulo do registro profissional por perfil (CRP/CRESS/OAB). */
export const PROFESSIONAL_REGISTRO_LABELS: Record<ProfessionalProfile, string> = {
  PSICOLOGO: "CRP",
  ASSISTENTE_SOCIAL: "CRESS",
  ASSESSOR_JURIDICO: "OAB",
};

export function getRegistroLabel(
  perfil: ProfessionalProfile | "" | null | undefined,
): string {
  if (perfil === "PSICOLOGO") return "CRP";
  if (perfil === "ASSISTENTE_SOCIAL") return "CRESS";
  if (perfil === "ASSESSOR_JURIDICO") return "OAB";
  return "Registro profissional";
}

export function getProfessionalProfileLabel(
  perfil: string | null | undefined,
): string {
  if (perfil === "PSICOLOGO") return PROFESSIONAL_PROFILE_LABELS.PSICOLOGO;
  if (perfil === "ASSISTENTE_SOCIAL")
    return PROFESSIONAL_PROFILE_LABELS.ASSISTENTE_SOCIAL;
  if (perfil === "ASSESSOR_JURIDICO")
    return PROFESSIONAL_PROFILE_LABELS.ASSESSOR_JURIDICO;
  return perfil?.trim() || "—";
}

export type ManagedProfessional = {
  id: string;
  nome: string;
  email: string;
  perfil: ProfessionalProfile;
  registro: string | null;
  ativo: boolean;
  criadoEm: string;
};

export type ProfessionalProfileFilter = "ALL" | ProfessionalProfile;

export type ProfessionalFilters = {
  search: string;
  perfil: ProfessionalProfileFilter;
};

export const PROFESSIONALS_PER_PAGE = 20;

const VALID_PROFILES: ProfessionalProfileFilter[] = [
  "ALL",
  "PSICOLOGO",
  "ASSISTENTE_SOCIAL",
  "ASSESSOR_JURIDICO",
];

export function parseProfessionalFilters(
  searchParams: URLSearchParams,
): ProfessionalFilters {
  const rawPerfil = (searchParams.get("perfil") ?? "ALL").toUpperCase();
  const perfil = VALID_PROFILES.includes(rawPerfil as ProfessionalProfileFilter)
    ? (rawPerfil as ProfessionalProfileFilter)
    : "ALL";
  return {
    search: searchParams.get("q")?.trim() || "",
    perfil,
  };
}

export function parseProfessionalPage(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("page") ?? 1);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.floor(raw);
}

export type ProfessionalCounts = Record<ProfessionalProfileFilter, number>;

export type ProfessionalFormData = {
  nome: string;
  email: string;
  perfil: ProfessionalProfile | "";
  registro: string;
  senha: string;
  confirmarSenha: string;
};

export type ProfessionalFormErrors = Partial<
  Record<keyof ProfessionalFormData, string>
>;

export const EMPTY_PROFESSIONAL_FORM: ProfessionalFormData = {
  nome: "",
  email: "",
  perfil: "",
  registro: "",
  senha: "",
  confirmarSenha: "",
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateProfessionalForm(
  data: ProfessionalFormData,
): ProfessionalFormErrors {
  const errors: ProfessionalFormErrors = {};
  const nome = data.nome.trim();
  if (!nome) {
    errors.nome = "Informe o nome.";
  } else if (nome.length < 3) {
    errors.nome = "Nome deve ter ao menos 3 caracteres.";
  } else if (data.nome.length > 120) {
    errors.nome = "Nome deve ter no máximo 120 caracteres.";
  }
  const email = data.email.trim();
  if (!email) {
    errors.email = "Informe o e-mail.";
  } else if (!isValidEmail(email)) {
    errors.email = "Informe um e-mail válido.";
  }
  if (!data.perfil) {
    errors.perfil = "Selecione o perfil.";
  }
  const registro = data.registro.trim();
  if (!registro) {
    errors.registro = "Informe o registro profissional.";
  } else if (registro.length < 3) {
    errors.registro = "Registro deve ter ao menos 3 caracteres.";
  } else if (data.registro.length > 30) {
    errors.registro = "Registro deve ter no máximo 30 caracteres.";
  }
  if (!data.senha) {
    errors.senha = "Informe a senha inicial.";
  } else if (data.senha.length < 8) {
    errors.senha = "Senha deve ter ao menos 8 caracteres.";
  }
  if (!data.confirmarSenha) {
    errors.confirmarSenha = "Confirme a senha inicial.";
  } else if (data.confirmarSenha !== data.senha) {
    errors.confirmarSenha = "As senhas não conferem.";
  }
  return errors;
}

export type CreateProfessionalInput = {
  nome: string;
  email: string;
  perfil: ProfessionalProfile;
  registro: string;
  senha: string;
};

export function toCreateProfessionalInput(
  data: ProfessionalFormData,
): CreateProfessionalInput | null {
  if (!data.perfil) return null;
  const errors = validateProfessionalForm(data);
  if (Object.keys(errors).length > 0) return null;
  return {
    nome: data.nome.trim(),
    email: data.email.trim(),
    perfil: data.perfil,
    registro: data.registro.trim(),
    senha: data.senha,
  };
}

export type ProfessionalActionData =
  | {
      ok: true;
      action: "cadastrar";
      id: string;
      nome: string;
      email: string;
      notificationStatus?: string | null;
    }
  | { ok: true; action: "ativo"; id: string; ativo: boolean }
  | { ok?: false; error: string; fieldErrors?: Record<string, string> };
