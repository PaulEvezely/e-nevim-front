import { useEffect, useState } from "react";
import {
  data,
  Link,
  useFetcher,
  useNavigate,
  useRevalidator,
} from "react-router";
import type { Route } from "./+types/appointment-detail";
import { requireUser } from "../../../features/auth/require-user.server";
import { appointmentApi } from "../../../features/manager/appointmentApi.server";
import {
  getProcessReport,
  type ProcessReport,
} from "../../../features/manager/processReportApi.server";
import { getProcessFrida } from "../../../features/professional/frida/fridaApi.server";
import {
  createRelatorio,
  getRelatorio,
  updateRelatorio,
  validateRelatorioConteudo,
  type RelatorioConsulta,
} from "../../../features/professional/relatorioApi.server";
import {
  getAppointmentStatusLabel,
  getModalityLabel,
  getProfessionalTypeLabel,
  type AppointmentStatus,
  type ManagerAppointmentDetail,
} from "../../../features/manager/appointmentUtils";
import { shortId } from "../../../features/manager/managerUtils";
import { getPatientBondLabel } from "../../../features/manager/patientUtils";
import type { ProfessionalActionData } from "../../../features/professional/consultasUtils";
import { AppointmentStatusBadge } from "../../../features/manager/components/AppointmentTable";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { Toast } from "../../../shared/components/Toast";
import { useToast } from "../../../shared/hooks/useToast";
import { ApiError } from "../../../libs/api.server";
import {
  formatDate,
  formatDateTime,
  formatTime,
} from "../../../shared/utils/date";

type DetailLoaderData =
  | {
      appointment: ManagerAppointmentDetail;
      report: ProcessReport | null;
      hasFrida: boolean | null;
      relatorio: RelatorioConsulta | null;
      relatorioIndisponivel: boolean;
      loadError: null;
    }
  | {
      appointment: null;
      report: null;
      hasFrida: null;
      relatorio: null;
      relatorioIndisponivel: boolean;
      loadError: string;
    };

type StatusTransition = Exclude<AppointmentStatus, "AGENDADA">;

const STATUS_TRANSITIONS: StatusTransition[] = [
  "REALIZADA",
  "CANCELADA",
  "FALTOU",
];

function toFriendlyLoadError(status?: number): string {
  if (status === 404) return "Consulta não encontrada.";
  if (status === 403) return "Você não tem permissão para ver esta consulta.";
  return "Não foi possível carregar a consulta. Tente novamente em instantes.";
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request, ["professional"]);
  const id = params.id?.trim() ?? "";
  if (!id) {
    return {
      appointment: null,
      report: null,
      hasFrida: null,
      relatorio: null,
      relatorioIndisponivel: false,
      loadError: "Consulta não encontrada.",
    } satisfies DetailLoaderData;
  }
  try {
    const appointment = await appointmentApi.getAppointment(request, id);
    const [report, processFrida, relatorioResult] = await Promise.all([
      getProcessReport(request, appointment.processoId).catch(() => null),
      getProcessFrida(request, appointment.processoId).catch(() => null),
      getRelatorio(request, id).then(
        (relatorio) => ({ ok: true as const, relatorio }),
        (err: unknown) => ({
          ok: false as const,
          forbidden: err instanceof ApiError && err.status === 403,
        }),
      ),
    ]);
    return {
      appointment,
      report,
      hasFrida: processFrida ? processFrida.frida !== null : null,
      relatorio: relatorioResult.ok ? relatorioResult.relatorio : null,
      relatorioIndisponivel: !relatorioResult.ok && relatorioResult.forbidden,
      loadError: null,
    } satisfies DetailLoaderData;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : undefined;
    return {
      appointment: null,
      report: null,
      hasFrida: null,
      relatorio: null,
      relatorioIndisponivel: false,
      loadError: toFriendlyLoadError(status),
    } satisfies DetailLoaderData;
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request, ["professional"]);
  const id = params.id?.trim() ?? "";
  if (!id) {
    return data<ProfessionalActionData>(
      { error: "Consulta inválida." },
      { status: 400 },
    );
  }
  const form = await request.formData().catch(() => null);
  if (!form) {
    return data<ProfessionalActionData>(
      { error: "Não foi possível concluir a ação." },
      { status: 400 },
    );
  }
  const intent = String(form.get("intent") ?? "");

  if (intent === "status") {
    const status = String(form.get("status") ?? "") as StatusTransition;
    if (!STATUS_TRANSITIONS.includes(status)) {
      return data<ProfessionalActionData>(
        { error: "Status inválido." },
        { status: 400 },
      );
    }
    if (status === "REALIZADA") {
      try {
        const detail = await appointmentApi.getAppointment(request, id);
        if (
          detail.tipoProfissional === "PSICOLOGO" ||
          detail.tipoProfissional === "TRIAGEM"
        ) {
          const processFrida = await getProcessFrida(
            request,
            detail.processoId,
          );
          if (!processFrida.frida) {
            return data<ProfessionalActionData>(
              {
                error:
                  "Preencha o FRIDA antes de marcar como realizada. O formulário pode ser preenchido com a consulta agendada.",
              },
              { status: 400 },
            );
          }
        }
      } catch (err) {
        const message =
          err instanceof ApiError && err.message
            ? err.message
            : "Não foi possível verificar o FRIDA. Tente novamente em instantes.";
        const statusCode =
          err instanceof ApiError && err.status >= 400 && err.status < 600
            ? err.status
            : 500;
        return data<ProfessionalActionData>(
          { error: message },
          { status: statusCode },
        );
      }
    }
    try {
      await appointmentApi.updateAppointmentStatus(request, id, status);
      return data<ProfessionalActionData>({
        ok: true,
        action: "status",
        id,
        status,
      });
    } catch (err) {
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : "Não foi possível atualizar o status da consulta. Tente novamente em instantes.";
      const statusCode =
        err instanceof ApiError && err.status >= 400 && err.status < 600
          ? err.status
          : 500;
      return data<ProfessionalActionData>(
        { error: message },
        { status: statusCode },
      );
    }
  }

  if (intent === "confirmar") {
    try {
      await appointmentApi.confirmAppointment(request, id);
      return data<ProfessionalActionData>({
        ok: true,
        action: "confirmar",
        id,
      });
    } catch (err) {
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : "Não foi possível confirmar a consulta. Tente novamente em instantes.";
      const statusCode =
        err instanceof ApiError && err.status >= 400 && err.status < 600
          ? err.status
          : 500;
      return data<ProfessionalActionData>(
        { error: message },
        { status: statusCode },
      );
    }
  }

  if (intent === "relatorio") {
    const conteudo = String(form.get("conteudo") ?? "");
    const validationError = validateRelatorioConteudo(conteudo);
    if (validationError) {
      return data<ProfessionalActionData>(
        { error: validationError },
        { status: 400 },
      );
    }
    try {
      const hasRelatorio = String(form.get("hasRelatorio") ?? "") === "true";
      if (hasRelatorio) {
        await updateRelatorio(request, id, conteudo.trim());
      } else {
        await createRelatorio(request, id, conteudo.trim());
      }
      return data<ProfessionalActionData>({
        ok: true,
        action: "editar",
        id,
      });
    } catch (err) {
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : "Não foi possível salvar o relatório. Tente novamente em instantes.";
      const statusCode =
        err instanceof ApiError && err.status >= 400 && err.status < 600
          ? err.status
          : 500;
      return data<ProfessionalActionData>(
        { error: message },
        { status: statusCode },
      );
    }
  }

  return data<ProfessionalActionData>(
    { error: "Ação inválida." },
    { status: 400 },
  );
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-gray-800">{value}</dd>
    </div>
  );
}

export default function ProfessionalAppointmentDetail({
  loaderData,
}: Route.ComponentProps) {
  const {
    appointment,
    report,
    hasFrida,
    relatorio,
    relatorioIndisponivel,
    loadError,
  } = loaderData;
  const revalidator = useRevalidator();
  const reloading = revalidator.state !== "idle";
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const fetcher = useFetcher<ProfessionalActionData>();
  const busy = fetcher.state !== "idle";
  const [pendingStatus, setPendingStatus] = useState<StatusTransition | null>(
    null,
  );
  const [fridaPendente, setFridaPendente] = useState(false);
  const [conteudo, setConteudo] = useState(relatorio?.conteudo ?? "");
  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok) {
      if (result.action === "status" && result.status) {
        showToast(
          `Consulta marcada como ${getAppointmentStatusLabel(
            result.status,
          ).toLowerCase()}.`,
          "success",
        );
      } else if (result.action === "confirmar") {
        showToast("Presença confirmada.", "success");
      } else {
        showToast("Relatório salvo com segurança.", "success");
      }
      setPendingStatus(null);
      revalidator.revalidate();
      return;
    }
    if ("error" in result && result.error) {
      showToast(result.error, "error");
      setPendingStatus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    setConteudo(relatorio?.conteudo ?? "");
  }, [relatorio?.conteudo, relatorio?.atualizadoEm]);

  if (!appointment) {
    return (
      <section
        className="mx-auto max-w-3xl p-4 lg:p-6"
        aria-label="Detalhe da consulta"
      >
        <Link
          to="/professional/appointments"
          className="text-xs font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
        >
          ← Voltar à agenda
        </Link>
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]"
        >
          {loadError ?? "Consulta não encontrada."}
        </div>
      </section>
    );
  }

  const editable = appointment.status === "AGENDADA";
  const isRealizada = appointment.status === "REALIZADA";
  const isTriagem = appointment.tipoProfissional === "TRIAGEM";
  const showFrida =
    (appointment.tipoProfissional === "PSICOLOGO" || isTriagem) &&
    (appointment.status === "AGENDADA" ||
      appointment.status === "REALIZADA");
  const confirmed = appointment.confirmacaoProfissional === "CONFIRMADO";
  const vitimaNome =
    report?.vitima.nome?.trim() ||
    appointment.vitimaNome?.trim() ||
    "Vítima não identificada";
  const processoStatus = report?.processo.status ?? null;
  const processoEncerrado = (processoStatus ?? "").toUpperCase() === "ENCERRADO";

  function requestStatus(next: StatusTransition) {
    if (
      next === "REALIZADA" &&
      hasFrida === false &&
      (appointment.tipoProfissional === "PSICOLOGO" || isTriagem)
    ) {
      setFridaPendente(true);
      return;
    }
    setPendingStatus(next);
  }

  return (
    <section
      className="mx-auto max-w-3xl p-4 lg:p-6"
      aria-label="Detalhe da consulta"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/professional/appointments"
          className="text-xs font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
        >
          ← Voltar à agenda
        </Link>
        <AppointmentStatusBadge status={appointment.status} />
      </div>

      <h1 className="mt-3 text-xl font-semibold text-gray-800 lg:text-2xl">
        Consulta de{" "}
        {getProfessionalTypeLabel(appointment.tipoProfissional).toLowerCase()}{" "}
        — {formatDate(appointment.dataHora)} às{" "}
        {formatTime(appointment.dataHora)}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {vitimaNome} · Processo{" "}
        <span className="font-mono" title={appointment.processoId}>
          {shortId(appointment.processoId)}
        </span>
      </p>

      <div className="mt-4 space-y-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm lg:p-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Atendimento</h2>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            <Definition
              label="Modalidade"
              value={getModalityLabel(appointment.modalidade)}
            />
            <Definition
              label="Sua confirmação"
              value={
                appointment.confirmacaoProfissional === "CONFIRMADO"
                  ? `Confirmada${appointment.confirmadoProfissionalEm ? ` em ${formatDateTime(appointment.confirmadoProfissionalEm)}` : ""}`
                  : "Pendente"
              }
            />
            <Definition
              label="Confirmação da vítima"
              value={
                appointment.confirmacaoVitima === "CONFIRMADO"
                  ? `Confirmada${appointment.confirmadoVitimaEm ? ` em ${formatDateTime(appointment.confirmadoVitimaEm)}` : ""}`
                  : "Pendente"
              }
            />
            {appointment.linkMeet ? (
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Sala
                </dt>
                <dd className="mt-0.5 text-sm">
                  <a
                    href={appointment.linkMeet}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
                  >
                    Entrar na sala
                  </a>
                </dd>
              </div>
            ) : (
              <Definition
                label="Sala"
                value={
                  appointment.modalidade === "ONLINE"
                    ? "Link ainda não disponível"
                    : "Atendimento presencial no NEVIM"
                }
              />
            )}
            {appointment.observacoes ? (
              <div className="sm:col-span-2">
                <Definition
                  label="Observações"
                  value={appointment.observacoes}
                />
              </div>
            ) : null}
            {appointment.motivoRecusa ? (
              <div className="sm:col-span-2">
                <Definition
                  label="Motivo da recusa"
                  value={appointment.motivoRecusa}
                />
              </div>
            ) : null}
          </dl>
          {processoEncerrado ? (
            <p className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-gray-600">
              Processo encerrado — confirmação bloqueada.
            </p>
          ) : editable && !confirmed ? (
            <div className="mt-3">
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="confirmar" />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex rounded-lg bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Confirmar presença
                </button>
              </fetcher.Form>
            </div>
          ) : null}
        </div>

        <div className="border-t border-stone-200 pt-4">
          <h2 className="text-sm font-semibold text-gray-800">
            Vítima / Processo
          </h2>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            <Definition label="Vítima" value={vitimaNome} />
            <Definition
              label="Vínculo"
              value={getPatientBondLabel(report?.vitima.vinculo ?? null)}
            />
            <Definition
              label="Campus"
              value={
                report?.vitima.campus?.trim() ||
                appointment.vitimaCampus?.trim() ||
                "—"
              }
            />
            <Definition
              label="Curso"
              value={report?.vitima.curso?.trim() || "—"}
            />
          </dl>
        </div>

        <div className="border-t border-stone-200 pt-4">
          <h2 className="text-sm font-semibold text-gray-800">FRIDA</h2>
          {showFrida ? (
            <>
              <p className="mt-1 text-sm text-gray-600">
                {hasFrida
                  ? "Formulário preenchido para este processo."
                  : "Formulário ainda não preenchido. Sem FRIDA, a opção “Realizada” fica bloqueada."}
              </p>
              <Link
                to={`/professional/frida/${appointment.id}`}
                className="mt-3 inline-flex rounded-lg bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C]"
              >
                {hasFrida ? "Abrir FRIDA" : "Preencher FRIDA"}
              </Link>
            </>
          ) : appointment.tipoProfissional === "PSICOLOGO" ? (
            <p className="mt-1 text-sm text-gray-600">
              O FRIDA fica disponível enquanto a consulta está agendada ou realizada.
            </p>
          ) : null}
        </div>

        <div className="border-t border-stone-200 pt-4" id="relatorio">
          <h2 className="text-sm font-semibold text-gray-800">
            Relatório sigiloso
          </h2>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-gray-600">
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            >
              <rect
                x="4"
                y="9"
                width="12"
                height="8"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M7 9V7a3 3 0 0 1 6 0v2"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
            <span>
              Acesso restrito a você (autor do atendimento). O texto é
              armazenado criptografado e nunca aparece para a vítima, outros
              profissionais ou gestores.
            </span>
          </p>
          {relatorioIndisponivel ? (
            <p className="mt-3 rounded-xl border border-[#FAEEDA] bg-[#FAEEDA]/40 px-4 py-3 text-sm text-[#854F0B]">
              Este relatório pertence a outro profissional e não pode ser
              exibido.
            </p>
          ) : !isRealizada && !relatorio ? (
            <p className="mt-3 text-sm text-gray-600">
              O relatório fica disponível após marcar a consulta como
              realizada.
            </p>
          ) : (
            <fetcher.Form method="post" className="mt-3">
              <input type="hidden" name="intent" value="relatorio" />
              <input
                type="hidden"
                name="hasRelatorio"
                value={relatorio ? "true" : "false"}
              />
              <label
                htmlFor="relatorio-conteudo"
                className="block text-xs font-semibold text-gray-700"
              >
                Evolução do caso nesta consulta{" "}
                <span className="font-normal text-gray-400">
                  (mín. 10, máx. 10.000 caracteres)
                </span>
              </label>
              <textarea
                id="relatorio-conteudo"
                name="conteudo"
                rows={5}
                maxLength={10000}
                value={conteudo}
                onChange={(event) => setConteudo(event.target.value)}
                placeholder="Descreva o essencial do atendimento: estado da vítima, intervenções realizadas, encaminhamentos sugeridos…"
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30"
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  {conteudo.length.toLocaleString("pt-BR")} / 10.000
                  caracteres
                </span>
                {relatorio ? (
                  <span className="text-[11px] text-gray-400">
                    Última atualização em {formatDateTime(relatorio.atualizadoEm)}
                  </span>
                ) : null}
              </div>
              <div className="mt-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-[#0C447C] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#061f3a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {relatorio ? "Atualizar relatório" : "Salvar relatório"}
                </button>
              </div>
            </fetcher.Form>
          )}
        </div>

        {processoEncerrado ? (
          <div className="border-t border-stone-200 pt-4">
            <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-gray-600">
              Processo encerrado — ações de status bloqueadas.
            </p>
          </div>
        ) : null}
        {editable && !processoEncerrado ? (
          <div className="border-t border-stone-200 pt-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Registrar resultado
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Ações disponíveis apenas enquanto a consulta está agendada. Esta
              ação não pode ser desfeita.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => requestStatus("REALIZADA")}
                disabled={busy}
                title={
                  hasFrida === false
                    ? "Preencha o FRIDA antes de marcar como realizada"
                    : "Marcar consulta como realizada"
                }
                className="rounded-lg border border-black/5 bg-[#EAF3DE] px-4 py-2 text-xs font-semibold text-[#27500A] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Realizada
              </button>
              <button
                type="button"
                onClick={() => requestStatus("CANCELADA")}
                disabled={busy}
                title="Marcar consulta como cancelada"
                className="rounded-lg border border-black/5 bg-[#F1EFE8] px-4 py-2 text-xs font-semibold text-[#5F5E5A] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelada
              </button>
              <button
                type="button"
                onClick={() => requestStatus("FALTOU")}
                disabled={busy}
                title="Marcar consulta como falta"
                className="rounded-lg border border-black/5 bg-[#FAEEDA] px-4 py-2 text-xs font-semibold text-[#854F0B] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Faltou
              </button>
            </div>
          </div>
        ) : null}
        {isRealizada && !processoEncerrado ? (
          <div className="border-t border-stone-200 pt-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Cancelar registro
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {appointment.tipoProfissional === "TRIAGEM"
                ? "A triagem será desfeita: o processo volta para ABERTO e uma nova triagem poderá ser agendada."
                : "O registro de realizada será desfeito. Relatórios existentes serão mantidos."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => requestStatus("CANCELADA")}
                disabled={busy}
                title="Cancelar consulta realizada"
                className="rounded-lg border border-black/5 bg-[#F1EFE8] px-4 py-2 text-xs font-semibold text-[#5F5E5A] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar consulta realizada
              </button>
            </div>
          </div>
        ) : null}

        <div className="border-t border-stone-200 pt-4">
          <h2 className="text-sm font-semibold text-gray-800">Histórico</h2>
          <ol className="mt-3 space-y-3">
            <li className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#378ADD]"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Consulta agendada pelo gestor
                </p>
                <p className="text-xs text-gray-500">
                  {formatDateTime(appointment.criadoEm)}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-gray-300"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {getAppointmentStatusLabel(appointment.status)} ·{" "}
                  {appointment.confirmacaoProfissional === "CONFIRMADO"
                    ? "você confirmou"
                    : "sua confirmação pendente"}
                  {" · "}
                  {appointment.confirmacaoVitima === "CONFIRMADO"
                    ? "vítima confirmou"
                    : "vítima pendente"}
                </p>
                <p className="text-xs text-gray-500">etapa atual</p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <ConfirmModal
        open={pendingStatus !== null}
        title="Registrar resultado da consulta?"
        description={
          pendingStatus
            ? `A consulta de ${vitimaNome} será marcada como ${getAppointmentStatusLabel(
                pendingStatus,
              ).toLowerCase()}. Esta ação não pode ser desfeita.`
            : ""
        }
        consequences={
          pendingStatus === "CANCELADA" && isRealizada
            ? appointment.tipoProfissional === "TRIAGEM"
              ? "A triagem será desfeita (processo volta para ABERTO). A vítima será notificada."
              : "O registro de realizada será desfeito (relatórios mantidos). A vítima será notificada."
            : pendingStatus === "CANCELADA"
              ? "A vítima será notificada sobre o cancelamento."
              : undefined
        }
        confirmLabel={
          pendingStatus
            ? `Marcar como ${getAppointmentStatusLabel(pendingStatus)}`
            : "Confirmar"
        }
        cancelLabel="Voltar"
        loading={busy}
        onConfirm={() => {
          if (!pendingStatus) return;
          fetcher.submit(
            { intent: "status", status: pendingStatus },
            { method: "post" },
          );
        }}
        onCancel={() => {
          if (!busy) setPendingStatus(null);
        }}
      />

      <ConfirmModal
        open={fridaPendente}
        title="FRIDA pendente"
        description={`Preencha o formulário FRIDA de ${vitimaNome} antes de marcar a consulta como realizada. Ele pode ser preenchido com a consulta agendada.`}
        confirmLabel="Preencher FRIDA"
        confirmVariant="primary"
        cancelLabel="Voltar"
        onConfirm={() => {
          setFridaPendente(false);
          navigate(`/professional/frida/${appointment.id}`);
        }}
        onCancel={() => setFridaPendente(false)}
      />

      <Toast toast={toast} />
      {reloading ? (
        <p className="mt-2 text-xs text-gray-500" role="status">
          Atualizando…
        </p>
      ) : null}
    </section>
  );
}
