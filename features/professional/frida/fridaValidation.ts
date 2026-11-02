import { FRIDA_QUESTIONS } from "./fridaQuestions";
import { calculateRiskLevel } from "./fridaScoring";
import type { FridaDraft, StructuredAssessment } from "./fridaTypes";

export type FridaFieldErrors = Record<string, string>;

export type FridaValidationResult = {
  valid: boolean;
  questionErrors: FridaFieldErrors;
  assessmentErrors: FridaFieldErrors;
};

const REQUIRED_ASSESSMENT_TEXT: ReadonlyArray<
  [keyof StructuredAssessment, string]
> = [
  ["percepcaoRisco", "Descreva a percepção de risco da usuária."],
  ["outrasInformacoes", "Registre outras informações relevantes."],
  ["estadoFisicoEmocional", "Descreva o estado físico e emocional."],
  ["riscoSuicidio", "Informe sobre o risco de suicídio."],
  ["resideComAgressor", "Explique a situação de residência/acesso do agressor."],
  ["outrasCircunstancias", "Descreva outras circunstâncias de risco."],
  ["encaminhamentos", "Informe os encaminhamentos sugeridos."],
];

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function validateFridaDraft(draft: FridaDraft): FridaValidationResult {
  const questionErrors: FridaFieldErrors = {};

  for (const question of FRIDA_QUESTIONS) {
    if (draft.answers[question.id] === undefined) {
      questionErrors[question.id] = "Selecione uma opção.";
    }
  }

  const assessmentErrors: FridaFieldErrors = {};
  const assessment = draft.assessment;

  for (const [key, message] of REQUIRED_ASSESSMENT_TEXT) {
    const value = assessment[key];
    if (typeof value !== "string" || isBlank(value)) {
      assessmentErrors[key] = message;
    }
  }

  if (!assessment.nivelRiscoProfissional) {
    assessmentErrors.nivelRiscoProfissional =
      "Selecione o nível de risco atribuído.";
  }

  if (isBlank(assessment.justificativa)) {
    assessmentErrors.justificativa = "Justifique o nível de risco atribuído.";
  }

  if (!assessment.concordouEncaminhamentos) {
    assessmentErrors.concordouEncaminhamentos =
      "Informe se a usuária concordou com os encaminhamentos.";
  } else if (
    assessment.concordouEncaminhamentos === "NAO" &&
    isBlank(assessment.concordouJustificativa)
  ) {
    assessmentErrors.concordouJustificativa =
      "Explique o motivo da discordância.";
  }

  if (!assessment.interesseAderir) {
    assessmentErrors.interesseAderir =
      "Informe se a usuária demonstra interesse em aderir.";
  } else if (
    assessment.interesseAderir === "NAO" &&
    isBlank(assessment.interesseJustificativa)
  ) {
    assessmentErrors.interesseJustificativa =
      "Explique o motivo da falta de interesse.";
  }

  const valid =
    Object.keys(questionErrors).length === 0 &&
    Object.keys(assessmentErrors).length === 0;

  return { valid, questionErrors, assessmentErrors };
}

/**
 * O profissional pode divergir do cálculo automático, mas a justificativa
 * (obrigatória) precisa explicar a diferença.
 */
export function isDivergentRisk(draft: FridaDraft): boolean {
  if (!draft.assessment.nivelRiscoProfissional) return false;
  return (
    draft.assessment.nivelRiscoProfissional !== calculateRiskLevel(draft.answers)
  );
}
