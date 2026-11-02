import { FRIDA_QUESTIONS } from "./fridaQuestions";
import type { FridaAnswers, RiskLevel } from "./fridaTypes";

export type FridaAnswerSummary = {
  sim: number;
  nao: number;
  naoSei: number;
  naoSeAplica: number;
  answered: number;
  total: number;
  isComplete: boolean;
};

/**
 * Grelha de cotação oficial (Sim × NS/NA).
 * Linhas: 0-2, 3, 4, 5, 6, 7, 8, 9, 10-19.
 * Colunas: 0..10 e 11-19.
 */
const RISK_GRID: readonly (readonly RiskLevel[])[] = [
  ["BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "MEDIO"],
  ["BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "BAIXO", "MEDIO", "MEDIO", "MEDIO", "MEDIO"],
  ["BAIXO", "BAIXO", "BAIXO", "BAIXO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO"],
  ["MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "ELEVADO", "MEDIO"],
  ["MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "ELEVADO", "ELEVADO", "ELEVADO", "MEDIO"],
  ["MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "MEDIO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "MEDIO"],
  ["MEDIO", "MEDIO", "MEDIO", "MEDIO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "MEDIO"],
  ["MEDIO", "MEDIO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "MEDIO"],
  ["ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO", "ELEVADO"],
];

/** Índice da linha para 0..9 respostas "Sim"; 10+ cai na última linha. */
const SIM_TO_ROW = [0, 0, 0, 1, 2, 3, 4, 5, 6, 7] as const;

function simRowIndex(simCount: number): number {
  return simCount >= 10 ? 8 : SIM_TO_ROW[simCount];
}

function nsNaColumnIndex(nsNaCount: number): number {
  return Math.min(Math.max(nsNaCount, 0), 11);
}

export function summarizeAnswers(answers: FridaAnswers): FridaAnswerSummary {
  let sim = 0;
  let nao = 0;
  let naoSei = 0;
  let naoSeAplica = 0;

  for (const question of FRIDA_QUESTIONS) {
    const value = answers[question.id];
    if (value === undefined) continue;

    switch (value) {
      case "SIM":
        sim += 1;
        break;
      case "NAO":
        nao += 1;
        break;
      case "NAO_SEI":
        naoSei += 1;
        break;
      case "NAO_SE_APLICA":
        naoSeAplica += 1;
        break;
    }
  }

  const answered = sim + nao + naoSei + naoSeAplica;
  const total = FRIDA_QUESTIONS.length;

  return {
    sim,
    nao,
    naoSei,
    naoSeAplica,
    answered,
    total,
    isComplete: answered === total,
  };
}

/**
 * Aplica as regras automáticas antes da grelha:
 * - 10+ "Sim" → Elevado;
 * - mais de 10 "NS/NA" → Médio;
 * - caso contrário, consulta a grelha combinatória.
 */
export function riskLevelFromCounts(
  simCount: number,
  nsNaCount: number,
): RiskLevel {
  if (simCount >= 10) return "ELEVADO";
  if (nsNaCount > 10) return "MEDIO";
  return RISK_GRID[simRowIndex(simCount)][nsNaColumnIndex(nsNaCount)];
}

/** Nível de risco calculado a partir das respostas já preenchidas. */
export function calculateRiskLevel(answers: FridaAnswers): RiskLevel {
  const summary = summarizeAnswers(answers);
  return riskLevelFromCounts(summary.sim, summary.naoSei + summary.naoSeAplica);
}

/**
 * Mantém o nível atribuído pelo profissional em dia com o cálculo automático
 * enquanto ele não for sobrescrito manualmente.
 */
export function resolveAttributedRisk(
  current: RiskLevel | "",
  previousCalculated: RiskLevel,
  nextCalculated: RiskLevel,
): RiskLevel {
  if (!current || current === previousCalculated) return nextCalculated;
  return current;
}
