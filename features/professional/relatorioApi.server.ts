import { apiFetchJson } from "../auth/apiFetch.server";

export type RelatorioConsulta = {
  id: string;
  consultaId: string;
  autorId: string;
  conteudo: string;
  criadoEm: string;
  atualizadoEm: string;
};

const LOAD_ERROR =
  "Não foi possível carregar o relatório. Tente novamente em instantes.";
const SAVE_ERROR =
  "Não foi possível salvar o relatório. Tente novamente em instantes.";
const UPDATE_ERROR =
  "Não foi possível atualizar o relatório. Tente novamente em instantes.";

/**
 * Relatório sigiloso da consulta (só o autor lê/escreve — 404 quando não
 * existe, 403 para não-autor). Segue o padrão de fridaApi.server.ts.
 */
export async function getRelatorio(
  request: Request,
  consultaId: string,
): Promise<RelatorioConsulta> {
  return apiFetchJson<RelatorioConsulta>(
    request,
    `/appointments/${encodeURIComponent(consultaId)}/relatorio`,
    { method: "GET" },
    LOAD_ERROR,
  );
}

export async function createRelatorio(
  request: Request,
  consultaId: string,
  conteudo: string,
): Promise<RelatorioConsulta> {
  return apiFetchJson<RelatorioConsulta>(
    request,
    `/appointments/${encodeURIComponent(consultaId)}/relatorio`,
    { method: "POST", body: JSON.stringify({ conteudo }) },
    SAVE_ERROR,
  );
}

export async function updateRelatorio(
  request: Request,
  consultaId: string,
  conteudo: string,
): Promise<RelatorioConsulta> {
  return apiFetchJson<RelatorioConsulta>(
    request,
    `/appointments/${encodeURIComponent(consultaId)}/relatorio`,
    { method: "PATCH", body: JSON.stringify({ conteudo }) },
    UPDATE_ERROR,
  );
}

/** Regra do back (criarRelatorioSchema/atualizarRelatorioSchema): 10–10000. */
export function validateRelatorioConteudo(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 10) {
    return "Descreva a evolução com pelo menos 10 caracteres.";
  }
  if (trimmed.length > 10000) {
    return "O relatório deve ter no máximo 10.000 caracteres.";
  }
  return null;
}
