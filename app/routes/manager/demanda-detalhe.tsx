import { useEffect, useState } from "react";
import { data, Link, useFetcher, useRevalidator } from "react-router";
import type { Route } from "./+types/demanda-detalhe";
import { requireUser } from "../../../features/auth/require-user.server";
import { managerApi } from "../../../features/manager/managerApi.server";
import {
  isDentroCampusItem,
  shortId,
  type ManagerDemandDetail,
} from "../../../features/manager/managerUtils";
import { ApiError } from "../../../libs/api.server";
import { Button } from "../../../shared/components/Button";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { LoadingOverlay } from "../../../shared/components/LoadingOverlay";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { Toast } from "../../../shared/components/Toast";
import { useToast } from "../../../shared/hooks/useToast";
import { formatDateTime } from "../../../shared/utils/date";

type DetailLoaderData =
  | { demand: ManagerDemandDetail; loadError: null }
  | { demand: null; loadError: string };

type DetailActionData =
  | { ok: true; action: "aprovar" | "rejeitar" | "reenviar"; notificationStatus?: string }
  | { ok?: false; error: string; fieldErrors?: { motivoRejeicao?: string } };

function notificationFeedback(
  action: "aprovar" | "reenviar",
  notificationStatus?: string,
): { message: string; type: "success" | "error" } {
  if (notificationStatus === "failed") {
    return {
      type: "error",
      message:
        action === "aprovar"
          ? "Demanda aprovada, mas não foi possível notificar a solicitante. Use \"Reenviar convite\" para tentar novamente."
          : "Não foi possível reenviar o convite. Tente novamente em instantes.",
    };
  }
  if (notificationStatus === "skipped") {
    return {
      type: "error",
      message:
        action === "aprovar"
          ? "Demanda aprovada. A solicitante não possui telefone nem e-mail para receber a notificação."
          : "Convite gerado, mas a solicitante não possui telefone nem e-mail para receber a notificação.",
    };
  }
  return {
    type: "success",
    message:
      action === "aprovar"
        ? "Demanda aprovada. A solicitante será notificada por e-mail."
        : "Convite reenviado. A solicitante será notificada por e-mail.",
  };
}

function statusLabel(status: string): "Pendente" | "Ativo" | "Inativo" | "Encerrado" {
  if (status === "PENDENTE") return "Pendente";
  if (status === "APROVADA") return "Ativo";
  if (status === "REJEITADA") return "Encerrado";
  return "Inativo";
}

function toFriendlyLoadError(status?: number): string {
  if (status === 404) return "Demanda não encontrada.";
  if (status === 403) return "Você não tem permissão para ver esta demanda.";
  return "Não foi possível carregar os dados da demanda. Tente novamente em instantes.";
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request, ["manager"]);
  const id = params.id?.trim() ?? "";
  if (!id) {
    throw data(
      { demand: null, loadError: "Demanda não encontrada." } satisfies DetailLoaderData,
      { status: 404 },
    );
  }
  try {
    const demand = await managerApi.getDemandDetail(request, id);
    return { demand, loadError: null } satisfies DetailLoaderData;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : undefined;
    throw data(
      { demand: null, loadError: toFriendlyLoadError(status) } satisfies DetailLoaderData,
      { status: status && status >= 400 && status < 600 ? status : 500 },
    );
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request, ["manager"]);
  const id = params.id?.trim() ?? "";
  if (!id) {
    return data<DetailActionData>({ error: "Demanda não encontrada." }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const intent = form?.get("intent");

  try {
    if (intent === "aprovar") {
      const result = await managerApi.approveDemand(request, id);
      return data<DetailActionData>(
        {
          ok: true,
          action: "aprovar",
          notificationStatus: result.notificationStatus,
        },
        { status: 200 },
      );
    }
    if (intent === "reenviar") {
      const result = await managerApi.resendInvite(request, id);
      return data<DetailActionData>(
        {
          ok: true,
          action: "reenviar",
          notificationStatus: result.notificationStatus,
        },
        { status: 200 },
      );
    }
    if (intent === "rejeitar") {
      const motivo = String(form?.get("motivoRejeicao") ?? "").trim();
      if (motivo.length < 10) {
        return data<DetailActionData>(
          {
            error: "Corrija os campos destacados antes de enviar.",
            fieldErrors: {
              motivoRejeicao: "Informe o motivo com ao menos 10 caracteres.",
            },
          },
          { status: 400 },
        );
      }
      if (motivo.length > 2000) {
        return data<DetailActionData>(
          {
            error: "Corrija os campos destacados antes de enviar.",
            fieldErrors: {
              motivoRejeicao: "Motivo deve ter no máximo 2000 caracteres.",
            },
          },
          { status: 400 },
        );
      }
      await managerApi.rejectDemand(request, id, motivo);
      return data<DetailActionData>({ ok: true, action: "rejeitar" }, { status: 200 });
    }
    return data<DetailActionData>({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof ApiError && err.message
        ? err.message
        : "Não foi possível concluir agora. Tente novamente em instantes.";
    const status = err instanceof ApiError ? err.status : 500;
    return data<DetailActionData>(
      { error: message },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-800 break-words">{value}</dd>
    </div>
  );
}

export default function ManagerDemandDetail({ loaderData }: Route.ComponentProps) {
  const { demand, loadError } = loaderData;
  const fetcher = useFetcher<DetailActionData>();
  const revalidator = useRevalidator();
  const { toast, showToast } = useToast();
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [motivo, setMotivo] = useState("");

  const busy = fetcher.state !== "idle";
  const actionData = fetcher.data;

  useEffect(() => {
    if (fetcher.state !== "idle" || !actionData) return;
    if ("ok" in actionData && actionData.ok) {
      if (actionData.action === "aprovar") {
        const feedback = notificationFeedback(
          "aprovar",
          actionData.notificationStatus,
        );
        showToast(feedback.message, feedback.type);
        setConfirmApprove(false);
      } else if (actionData.action === "reenviar") {
        const feedback = notificationFeedback(
          "reenviar",
          actionData.notificationStatus,
        );
        showToast(feedback.message, feedback.type);
      } else {
        showToast("Demanda rejeitada.", "success");
        setConfirmReject(false);
        setMotivo("");
      }
      revalidator.revalidate();
      return;
    }
    if ("error" in actionData && actionData.error) {
      showToast(actionData.error, "error");
      setConfirmApprove(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  if (!demand) {
    return (
      <section className="max-w-3xl mx-auto p-4 lg:p-6" aria-label="Detalhe da demanda">
        <Link
          to="/manager"
          className="text-xs font-semibold text-[#378ADD] hover:text-[#0C447C] underline underline-offset-2"
        >
          ← Voltar ao painel
        </Link>
        <div
          role="alert"
          className="mt-4 bg-[#FCEBEB] border border-red-200 text-[#791F1F] text-sm px-4 py-3 rounded-xl"
        >
          {loadError ?? "Demanda não encontrada."}
        </div>
      </section>
    );
  }

  const dentroCampus = isDentroCampusItem(demand);
  const localOcorrencia = demand.solicitanteLocalOcorrencia?.trim() || null;
  const localLegado = localOcorrencia == null && demand.localOcorrenciaConfiavel === false;
  const isPendente = demand.status === "PENDENTE";
  const isAprovada = demand.status === "APROVADA";
  const rejectFieldError =
    actionData && "fieldErrors" in actionData
      ? actionData.fieldErrors?.motivoRejeicao
      : undefined;

  return (
    <section className="max-w-3xl mx-auto p-4 lg:p-6" aria-label="Detalhe da demanda">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/manager"
          className="text-xs font-semibold text-[#378ADD] hover:text-[#0C447C] underline underline-offset-2"
        >
          ← Voltar ao painel
        </Link>
        <StatusBadge status={statusLabel(demand.status)} />
      </div>

      <h1 className="mt-3 text-xl lg:text-2xl font-semibold text-gray-800">
        Demanda {shortId(demand.id)}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Registrada em {formatDateTime(demand.criadoEm)}
      </p>

      {dentroCampus ? (
        <p
          role="alert"
          className="mt-3 text-sm bg-[#FCEBEB] border border-red-200 text-[#791F1F] px-3 py-2.5 rounded-lg leading-snug"
        >
          Alerta: local da ocorrência dentro do campus. Verifique com prioridade.
        </p>
      ) : null}

      <div className="mt-4 bg-white rounded-2xl border border-stone-200 shadow-sm p-4 lg:p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Solicitante</h2>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            <Definition label="Nome" value={demand.solicitanteNome?.trim() || "—"} />
            <Definition label="E-mail" value={demand.solicitanteEmail?.trim() || "—"} />
            <Definition label="Telefone" value={demand.solicitantePhone?.trim() || "—"} />
            <Definition label="Cidade" value={demand.solicitanteCidade?.trim() || "—"} />
          </dl>
        </div>

        <div className="border-t border-stone-200 pt-4">
          <h2 className="text-sm font-semibold text-gray-800">Ocorrência</h2>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            <Definition label="Campus" value={demand.solicitanteCampus?.trim() || "—"} />
            <Definition label="Vínculo" value={demand.solicitanteVinculo?.trim() || "—"} />
            <Definition
              label="Local da ocorrência"
              value={localOcorrencia ?? "—"}
            />
            <div className="sm:col-span-2">
              <Definition label="Tipo de violência" value={demand.tipoViolencia?.trim() || "—"} />
            </div>
          </dl>
          {localLegado ? (
            <p className="mt-2 text-xs text-gray-500">
              Local recuperado de registro antigo (revisar).
            </p>
          ) : null}
        </div>

        <div className="border-t border-stone-200 pt-4">
          <h2 className="text-sm font-semibold text-gray-800">Descrição</h2>
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-line break-words [overflow-wrap:anywhere] leading-relaxed">
            {demand.descricao?.trim() || "—"}
          </p>
        </div>

        {demand.status === "REJEITADA" && demand.motivoRejeicao ? (
          <div className="border-t border-stone-200 pt-4">
            <div className="bg-[#EAF3DE] border border-[#D4E8C4] text-[#27500A] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[#27500A] mb-2">Motivo da rejeição</h3>
              <p className="text-sm text-[#27500A] whitespace-pre-line">{demand.motivoRejeicao}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {isPendente ? (
          <>
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => setConfirmApprove(true)}
            >
              Aprovar demanda
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmReject(true)}
              className="bg-white"
            >
              Rejeitar
            </Button>
          </>
        ) : null}
        {isAprovada ? (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="reenviar" />
            <Button type="submit" variant="outline" disabled={busy} className="bg-white">
              {busy ? "Enviando…" : "Reenviar convite"}
            </Button>
          </fetcher.Form>
        ) : null}
      </div>

      <Toast toast={toast} />
      <LoadingOverlay open={busy} message="Processando…" />

      <ConfirmModal
        open={confirmApprove}
        title="Aprovar demanda?"
        description="A demanda será marcada como aprovada e a solicitante receberá o link de cadastro (válido por 48h) por e-mail."
        consequences="Se a notificação falhar, a demanda continua aprovada e você pode usar “Reenviar convite” para tentar novamente."
        confirmLabel={busy ? "Aprovando…" : "Aprovar"}
        confirmVariant="primary"
        loading={busy}
        onCancel={() => {
          if (!busy) setConfirmApprove(false);
        }}
        onConfirm={() => {
          fetcher.submit({ intent: "aprovar" }, { method: "post" });
        }}
      />

      <ConfirmModal
        open={confirmReject}
        title="Rejeitar demanda?"
        description="A demanda será marcada como rejeitada e sairá da fila de pendentes. Digite o motivo abaixo — ele fica registrado no histórico da demanda."
        confirmLabel={busy ? "Rejeitando…" : "Rejeitar"}
        loading={busy}
        onCancel={() => {
          if (busy) return;
          setConfirmReject(false);
          setMotivo("");
        }}
        onConfirm={() => {
          if (motivo.trim().length < 10) {
            showToast(
              "Informe o motivo da rejeição com ao menos 10 caracteres.",
              "error",
            );
            return;
          }
          fetcher.submit(
            { intent: "rejeitar", motivoRejeicao: motivo.trim() },
            { method: "post" },
          );
        }}
      >
        <label
          htmlFor="motivoRejeicao"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Motivo da rejeição <span className="text-red-600">*</span>
        </label>
        <textarea
          id="motivoRejeicao"
          rows={4}
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Descreva o motivo (mínimo 10 caracteres)"
          aria-invalid={Boolean(rejectFieldError)}
          aria-describedby={rejectFieldError ? "error-motivo" : "hint-motivo"}
          className={`w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all placeholder:text-gray-400 resize-none ${
            rejectFieldError
              ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
              : "border-stone-300 focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
          }`}
        />
        {rejectFieldError ? (
          <p id="error-motivo" className="text-red-700 text-xs mt-1.5">
            {rejectFieldError}
          </p>
        ) : (
          <p id="hint-motivo" className="text-xs text-gray-500 mt-1.5">
            Mínimo 10 e máximo 2000 caracteres.
          </p>
        )}
      </ConfirmModal>
    </section>
  );
}
