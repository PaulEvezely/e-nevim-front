import { apiFetchJson } from "../auth/apiFetch.server";

const DEFAULT_ERROR =
  "Não foi possível carregar seus dados. Tente novamente em instantes.";

export type MyDemandStatus = "PENDENTE" | "APROVADA" | "REJEITADA";

export type MyDemand = {
  id: string;
  status: MyDemandStatus;
  tipoViolencia: string | null;
  criadoEm: string;
  /** Processo vinculado (pode ser null se ainda não criado). Back já expõe para vítima. */
  processo: { id: string; status: string } | null;
};

type MyDemandsPage = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  demandas: MyDemand[];
};

/** Demandas da própria vítima (visão parcial, sem motivo de rejeição). */
export async function listMyDemands(request: Request): Promise<MyDemand[]> {
  const payload = await apiFetchJson<MyDemandsPage>(
    request,
    "/demands",
    undefined,
    DEFAULT_ERROR,
  );
  return payload.demandas ?? [];
}
