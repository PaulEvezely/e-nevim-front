/** Tipos e fábricas puras do FRIDA (compartilhados entre loader e componente). */

export type FridaAnswerValue = "SIM" | "NAO" | "NAO_SEI" | "NAO_SE_APLICA";

export type RiskLevel = "BAIXO" | "MEDIO" | "ELEVADO";

export type FridaCategory = "escalada" | "vitima" | "agressor" | "contexto";

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ELEVADO: "Elevado",
};

export const RISK_LEVEL_ORDER: readonly RiskLevel[] = [
  "BAIXO",
  "MEDIO",
  "ELEVADO",
];

export const FRIDA_ANSWER_LABELS: Record<FridaAnswerValue, string> = {
  SIM: "Sim",
  NAO: "Não",
  NAO_SEI: "Não sabe",
  NAO_SE_APLICA: "Não se aplica",
};

export const FRIDA_ANSWER_ORDER: readonly FridaAnswerValue[] = [
  "SIM",
  "NAO",
  "NAO_SEI",
  "NAO_SE_APLICA",
];

export const FRIDA_CATEGORY_LABELS: Record<FridaCategory, string> = {
  escalada: "Escalada da violência",
  vitima: "Características da vítima",
  agressor: "Comportamento e história do agressor",
  contexto: "Contexto da violência",
};

export type FridaSubquestion = {
  id: string;
  label: string;
};

export type FridaQuestion = {
  /** Identificador estável usado como chave em `answers`/`subanswers`. */
  id: string;
  /** Número exibido no formulário (1..19). */
  number: number;
  category: FridaCategory;
  prompt: string;
  helper?: string;
  /** Detalhes complementares que não entram na contagem de risco. */
  subquestions?: FridaSubquestion[];
};

export type FridaAnswers = Partial<Record<string, FridaAnswerValue>>;

export type FridaSubanswers = Partial<Record<string, string[]>>;

export type YesNo = "SIM" | "NAO";

/** Parte 2 — avaliação estruturada descritiva (obrigatória). */
export type StructuredAssessment = {
  percepcaoRisco: string;
  outrasInformacoes: string;
  estadoFisicoEmocional: string;
  riscoSuicidio: string;
  resideComAgressor: string;
  outrasCircunstancias: string;
  nivelRiscoProfissional: RiskLevel | "";
  justificativa: string;
  encaminhamentos: string;
  concordouEncaminhamentos: YesNo | "";
  concordouJustificativa: string;
  interesseAderir: YesNo | "";
  interesseJustificativa: string;
};

/** Estado editável local (rascunho). */
export type FridaDraft = {
  consultaId: string;
  answers: FridaAnswers;
  subanswers: FridaSubanswers;
  assessment: StructuredAssessment;
  updatedAt: string;
};

/** Envelope persistido em `FormularioFrida.respostas` (JSON livre no back-end). */
export type FridaRespostasPayload = {
  version: 1;
  answers: FridaAnswers;
  subanswers: FridaSubanswers;
  assessment: StructuredAssessment;
};

export type CreateFridaPayload = {
  consultaId: string;
  respostas: FridaRespostasPayload;
  nivelRisco: RiskLevel;
};

export type UpdateFridaPayload = {
  respostas?: FridaRespostasPayload;
  nivelRisco?: RiskLevel;
};

/** Registro retornado pelo back-end (`GET/POST/PATCH /frida-forms`). */
export type FridaRecord = {
  id: string;
  consultaId: string;
  psicologoId: string | null;
  assistenteSocialId?: string | null;
  gestorId: string | null;
  respostas: unknown;
  nivelRisco: RiskLevel;
  criadoEm: string;
};

/** Resposta de `GET /processes/:id/frida`. */
export type ProcessFridaResponse = {
  processoId: string;
  frida: FridaRecord | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Lê o envelope de `respostas` gravado no back-end (JSON livre).
 * Tolerante a formatos legados/ausentes para não quebrar a visualização.
 */
export function parseFridaRespostas(
  raw: unknown,
): FridaRespostasPayload {
  const empty: FridaRespostasPayload = {
    version: 1,
    answers: {},
    subanswers: {},
    assessment: createEmptyStructuredAssessment(),
  };

  if (!isRecord(raw)) return empty;

  const answers = isRecord(raw.answers)
    ? (raw.answers as FridaAnswers)
    : {};
  const subanswers = isRecord(raw.subanswers)
    ? (raw.subanswers as FridaSubanswers)
    : {};
  const assessment = isRecord(raw.assessment)
    ? ({
        ...createEmptyStructuredAssessment(),
        ...raw.assessment,
      } as StructuredAssessment)
    : createEmptyStructuredAssessment();

  return { version: 1, answers, subanswers, assessment };
}

export function createEmptyStructuredAssessment(): StructuredAssessment {
  return {
    percepcaoRisco: "",
    outrasInformacoes: "",
    estadoFisicoEmocional: "",
    riscoSuicidio: "",
    resideComAgressor: "",
    outrasCircunstancias: "",
    nivelRiscoProfissional: "",
    justificativa: "",
    encaminhamentos: "",
    concordouEncaminhamentos: "",
    concordouJustificativa: "",
    interesseAderir: "",
    interesseJustificativa: "",
  };
}

export function createEmptyFridaDraft(consultaId: string): FridaDraft {
  return {
    consultaId,
    answers: {},
    subanswers: {},
    assessment: createEmptyStructuredAssessment(),
    updatedAt: new Date().toISOString(),
  };
}
