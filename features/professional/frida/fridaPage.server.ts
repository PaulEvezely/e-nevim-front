import { data } from "react-router";
import { ApiError } from "../../../libs/api.server";
import { requireUser } from "../../auth/require-user.server";
import type { User } from "../../auth/types/login";
import { appointmentApi } from "../../manager/appointmentApi.server";
import type { ManagerAppointmentDetail } from "../../manager/appointmentUtils";
import { createFrida, getProcessFrida, updateFrida } from "./fridaApi.server";
import {
  parseFridaRespostas,
  type FridaDraft,
  type FridaRecord,
  type FridaRespostasPayload,
  type RiskLevel,
} from "./fridaTypes";
import type {
  FridaActionData,
  FridaPageData,
  FridaPageMode,
  FridaPageRole,
} from "./fridaPageTypes";
import { validateFridaDraft } from "./fridaValidation";

const LOAD_ERROR =
  "Não foi possível carregar o FRIDA. Tente novamente em instantes.";
const SAVE_ERROR =
  "Não foi possível salvar o FRIDA. Tente novamente em instantes.";

const RISK_LEVELS: readonly RiskLevel[] = ["BAIXO", "MEDIO", "ELEVADO"];

function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === "string" && RISK_LEVELS.includes(value as RiskLevel);
}

function friendlyLoadError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return "Consulta não encontrada.";
    if (err.status === 403) {
      return "Você não tem permissão para acessar esta consulta.";
    }
    if (err.message) return err.message;
  }
  return LOAD_ERROR;
}

function draftFromFrida(frida: FridaRecord, consultaId: string): FridaDraft {
  const respostas = parseFridaRespostas(frida.respostas);
  return {
    consultaId,
    answers: respostas.answers,
    subanswers: respostas.subanswers,
    assessment: respostas.assessment,
    updatedAt: frida.criadoEm,
  };
}

function createBlockReason(
  user: User,
  appointment: ManagerAppointmentDetail,
  role: FridaPageRole,
): string | null {
  // Alinhado ao back-end (frida.routes.ts): FRIDA pode ser preenchido durante
  // o atendimento — AGENDADA ou REALIZADA. Só CANCELADA/FALTOU bloqueiam.
  const blockedStatuses = ["CANCELADA", "FALTOU"] as const;
  if (
    blockedStatuses.includes(
      appointment.status as (typeof blockedStatuses)[number],
    )
  ) {
    return "O FRIDA não pode ser preenchido em consulta cancelada ou com falta registrada.";
  }

  if (role === "manager") {
    // Gestor pode preencher FRIDA de triagem (feita por ele) e de psicologia
    if (appointment.tipoProfissional !== "TRIAGEM" && appointment.tipoProfissional !== "PSICOLOGO") {
      return "O FRIDA só é preenchido em consultas de triagem ou de psicologia.";
    }
    // Para triagem, apenas o gestor que agendou pode preencher
    if (appointment.tipoProfissional === "TRIAGEM" && appointment.profissionalId !== user.id) {
      return "Somente o gestor responsável pela triagem pode preencher este FRIDA.";
    }
    // Para psicologia, qualquer gestor pode preencher/visualizar
    return null;
  }

  const isPsicologo = user.speciality === "psicologo";
  const isAssistente = user.speciality === "assistente_social";
  if (!isPsicologo && !isAssistente) {
    return "Apenas psicólogas(os) ou assistentes sociais podem preencher o FRIDA.";
  }
  // Assistente social só atua em triagem designada (não em psicologia).
  if (isAssistente) {
    if (appointment.tipoProfissional !== "TRIAGEM") {
      return "Assistente social só preenche FRIDA em triagem designada.";
    }
  } else if (
    appointment.tipoProfissional !== "PSICOLOGO" &&
    appointment.tipoProfissional !== "TRIAGEM"
  ) {
    return "O FRIDA deve ser preenchido em uma consulta de psicologia ou triagem.";
  }
  if (appointment.profissionalId !== user.id) {
    return "Somente o profissional responsável pela consulta pode preencher este FRIDA.";
  }
  return null;
}

function resolveMode(
  user: User,
  appointment: ManagerAppointmentDetail,
  frida: FridaRecord | null,
  role: FridaPageRole,
): { mode: FridaPageMode; blockReason: string | null } {
  if (frida) {
    // Edição liberada em AGENDADA ou REALIZADA (back-end PATCH /frida/:id
    // não verifica status da consulta). Gestor edita qualquer FRIDA;
    // assistente social também edita qualquer FRIDA (inclusive de
    // gestor/psicólogo); psicólogo edita só se for dono da consulta.
    if (role === "manager") return { mode: "edit", blockReason: null };
    if (user.speciality === "assistente_social") {
      return { mode: "edit", blockReason: null };
    }
    if (user.speciality !== "psicologo") {
      return { mode: "read", blockReason: null };
    }
    if (appointment.profissionalId === user.id) {
      return { mode: "edit", blockReason: null };
    }
    return { mode: "read", blockReason: null };
  }

  const blockReason = createBlockReason(user, appointment, role);
  if (blockReason) return { mode: "blocked", blockReason };
  return { mode: "create", blockReason: null };
}

export async function loadFridaPage(
  request: Request,
  consultaId: string,
  role: FridaPageRole,
): Promise<FridaPageData> {
  const user = await requireUser(request, [role]);
  const id = consultaId.trim();
  if (!id) {
    return { ok: false, loadError: "Consulta não encontrada." };
  }

  let appointment: ManagerAppointmentDetail;
  try {
    appointment = await appointmentApi.getAppointment(request, id);
  } catch (err) {
    return { ok: false, loadError: friendlyLoadError(err) };
  }

  let frida: FridaRecord | null = null;
  try {
    const processFrida = await getProcessFrida(request, appointment.processoId);
    frida = processFrida.frida;
  } catch (err) {
    return { ok: false, loadError: friendlyLoadError(err) };
  }

  const { mode, blockReason } = resolveMode(user, appointment, frida, role);

  return {
    ok: true,
    appointment,
    frida,
    mode,
    blockReason,
    initialDraft: frida ? draftFromFrida(frida, appointment.id) : null,
  };
}

export async function handleFridaAction(
  request: Request,
  consultaId: string,
  role: FridaPageRole,
) {
  await requireUser(request, [role]);
  const id = consultaId.trim();
  if (!id) {
    return data<FridaActionData>(
      { ok: false, error: "Consulta inválida." },
      { status: 400 },
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return data<FridaActionData>(
      { ok: false, error: "Não foi possível concluir a ação." },
      { status: 400 },
    );
  }

  const intent = String(form.get("intent") ?? "");
  const respostasRaw = String(form.get("respostas") ?? "");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(respostasRaw);
  } catch {
    return data<FridaActionData>(
      { ok: false, error: "Respostas inválidas. Revise o formulário." },
      { status: 400 },
    );
  }

  const parsed = parseFridaRespostas(parsedJson);
  const draft: FridaDraft = {
    consultaId: id,
    answers: parsed.answers,
    subanswers: parsed.subanswers,
    assessment: parsed.assessment,
    updatedAt: new Date().toISOString(),
  };
  const validation = validateFridaDraft(draft);
  if (!validation.valid) {
    return data<FridaActionData>(
      {
        ok: false,
        error: "Corrija os campos obrigatórios antes de salvar o FRIDA.",
      },
      { status: 400 },
    );
  }

  const nivelRisco = draft.assessment.nivelRiscoProfissional;
  if (!isRiskLevel(nivelRisco)) {
    return data<FridaActionData>(
      { ok: false, error: "Selecione o nível de risco atribuído." },
      { status: 400 },
    );
  }

  const respostas: FridaRespostasPayload = {
    version: 1,
    answers: draft.answers,
    subanswers: draft.subanswers,
    assessment: draft.assessment,
  };

  try {
    if (intent === "create") {
      const created = await createFrida(request, {
        consultaId: id,
        respostas,
        nivelRisco,
      });
      return data<FridaActionData>({
        ok: true,
        fridaId: created.id,
        mode: "create",
      });
    }

    if (intent === "update") {
      const fridaId = String(form.get("fridaId") ?? "").trim();
      if (!fridaId) {
        return data<FridaActionData>(
          { ok: false, error: "FRIDA inválido." },
          { status: 400 },
        );
      }
      const updated = await updateFrida(request, fridaId, {
        respostas,
        nivelRisco,
      });
      return data<FridaActionData>({
        ok: true,
        fridaId: updated.id,
        mode: "update",
      });
    }

    return data<FridaActionData>(
      { ok: false, error: "Ação inválida." },
      { status: 400 },
    );
  } catch (err) {
    const message =
      err instanceof ApiError && err.message ? err.message : SAVE_ERROR;
    const status = err instanceof ApiError ? err.status : 500;
    return data<FridaActionData>(
      { ok: false, error: message },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}
