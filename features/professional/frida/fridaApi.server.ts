import { apiFetchJson } from "../../auth/apiFetch.server";
import type {
  CreateFridaPayload,
  FridaRecord,
  ProcessFridaResponse,
  UpdateFridaPayload,
} from "./fridaTypes";

const LOAD_ERROR =
  "Não foi possível carregar o FRIDA. Tente novamente em instantes.";
const CREATE_ERROR =
  "Não foi possível salvar o FRIDA. Tente novamente em instantes.";
const UPDATE_ERROR =
  "Não foi possível atualizar o FRIDA. Tente novamente em instantes.";

/** Cria o FRIDA de uma consulta `REALIZADA` (autor: psicólogo ou gestor). */
export async function createFrida(
  request: Request,
  payload: CreateFridaPayload,
): Promise<FridaRecord> {
  return apiFetchJson<FridaRecord>(
    request,
    "/frida-forms",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    CREATE_ERROR,
  );
}

/** Busca um FRIDA pelo id (autor ou gestor). */
export async function getFrida(
  request: Request,
  fridaId: string,
): Promise<FridaRecord> {
  return apiFetchJson<FridaRecord>(
    request,
    `/frida-forms/${fridaId}`,
    { method: "GET" },
    LOAD_ERROR,
  );
}

/** Atualiza respostas e/ou nível de risco (autor ou gestor). */
export async function updateFrida(
  request: Request,
  fridaId: string,
  payload: UpdateFridaPayload,
): Promise<FridaRecord> {
  return apiFetchJson<FridaRecord>(
    request,
    `/frida-forms/${fridaId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    UPDATE_ERROR,
  );
}

/** FRIDA vinculado ao processo (retorna `{ frida: null }` quando não existe). */
export async function getProcessFrida(
  request: Request,
  processoId: string,
): Promise<ProcessFridaResponse> {
  return apiFetchJson<ProcessFridaResponse>(
    request,
    `/processes/${processoId}/frida`,
    { method: "GET" },
    LOAD_ERROR,
  );
}
