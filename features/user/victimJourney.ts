import type { MyDemandStatus } from "./demandsApi.server";

export type JourneyStepState = "done" | "current" | "todo";

export interface JourneyStep {
  key: "registrada" | "analise" | "analisada" | "triagem" | "acompanhamento";
  label: string;
  state: JourneyStepState;
}

/**
 * Etapas da jornada da vítima a partir do status da demanda.
 * Fonte única usada no painel (stepper horizontal) e no processo
 * (linha do tempo vertical). Espelha a regra do back: APROVADA segue
 * para triagem; REJEITADA encerra na análise.
 */
export function getVictimJourneySteps(status: MyDemandStatus): JourneyStep[] {
  if (status === "REJEITADA") {
    return [
      { key: "registrada", label: "Demanda registrada", state: "done" },
      { key: "analisada", label: "Demanda analisada", state: "current" },
    ];
  }
  const approved = status === "APROVADA";
  return [
    { key: "registrada", label: "Demanda registrada", state: "done" },
    {
      key: "analise",
      label: "Em análise",
      state: approved ? "done" : "current",
    },
    {
      key: "triagem",
      label: "Triagem",
      state: approved ? "current" : "todo",
    },
    { key: "acompanhamento", label: "Acompanhamento", state: "todo" },
  ];
}
