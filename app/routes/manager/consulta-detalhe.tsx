import { useEffect, useState } from "react";
import {
  data,
  Link,
  useFetcher,
  useNavigate,
  useRevalidator,
} from "react-router";
import type { Route } from "./+types/consulta-detalhe";
import { requireUser } from "../../../features/auth/require-user.server";
import { appointmentApi } from "../../../features/manager/appointmentApi.server";
import {
  getProcessReport,
  type ProcessReport,
} from "../../../features/manager/processReportApi.server";
import { getProcessFrida } from "../../../features/professional/frida/fridaApi.server";
import {
  getAppointmentStatusLabel,
  getModalityLabel,
  getProfessionalTypeLabel,
  type AppointmentStatus,
  type ManagerAppointmentDetail,
} from "../../../features/manager/appointmentUtils";
import { shortId } from "../../../features/manager/managerUtils";
import { getPatientBondLabel } from "../../../features/manager/patientUtils";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { AppointmentStatusBadge } from "../../../features/manager/components/AppointmentTable";
import { Toast } from "../../../shared/components/Toast";
import { useToast } from "../../../shared/hooks/useToast";
import { ApiError } from "../../../libs/api.server";
import {
  formatDate,
  formatDateTime,
  formatTime,
} from "../../../shared/utils/date";

type ConsultaDetailLoaderData =
  | {
      appointment: ManagerAppointmentDetail;
      report: ProcessReport | null;
      professionalName: string;
      hasFrida: boolean | null;
      loadError: null;
    }
  | {
      appointment: null;
      report: null;
      professionalName: string;
      hasFrida: null;
      loadError: string;
    };

type StatusTransition = Exclude<AppointmentStatus, "AGENDADA">;

const STATUS_TRANSITIONS: StatusTransition[] = [
  "REALIZADA",
  "CANCELADA",
  "FALTOU",
];

type ConsultaDetailActionData =
  | { ok: true; action: "status"; id: string; status: StatusTransition }
  | { ok?: false; error: string };

function toFriendlyLoadError(status?: number): string {
  if (status === 404) return "Consulta não encontrada.";
  if (status === 403) return "Você não tem permissão para ver esta consulta.";
  return "Não foi possível carregar a consulta. Tente novamente em instantes.";
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request, ["manager"]);
  const id = params.id?.trim() ?? "";
  if (!id) {
    return {
      appointment: null,
      report: null,
      professionalName: "—",
      hasFrida: null,
      loadError: "Consulta não encontrada.",
    } satisfies ConsultaDetailLoaderData;
  }
  try {
    const appointment = await appointmentApi.getAppointment(request, id);
    const [report, professionals, processFrida] = await Promise.all([
      getProcessReport(request, appointment.processoId).catch(() => null),
      appointmentApi.listProfessionals(request).catch(() => []),
      getProcessFrida(request, appointment.processoId).catch(() => null),
    ]);
    const professionalName =
      professionals.find((p) => p.id === appointment.profissionalId)?.nome ??
      "—";
    return {
      appointment,
      report,
      professionalName,
      hasFrida: processFrida ? processFrida.frida !== null : null,
      loadError: null,
    } satisfies ConsultaDetailLoaderData;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : undefined;
    return {
      appointment: null,
      report: null,
      professionalName: "—",
      hasFrida: null,
      loadError: toFriendlyLoadError(status),
    } satisfies ConsultaDetailLoaderData;
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request, ["manager"]);
  const id = params.id?.trim() ?? "";
  if (!id) {
    return data<ConsultaDetailActionData>(
      { error: "Consulta inválida." },
      { status: 400 },
    );
  }
  const form = await request.formData().catch(() => null);
  if (!form || String(form.get("intent") ?? "") !== "status") {
    return data<ConsultaDetailActionData>(
      { error: "Ação inválida." },
      { status: 400 },
    );
  }
  const status = String(form.get("status") ?? "") as StatusTransition;
  if (!STATUS_TRANSITIONS.includes(status)) {
    return data<ConsultaDetailActionData>(
      { error: "Status inválido." },
      { status: 400 },
    );
  }
  try {
    // Permissão alinhada ao back (dono ou GESTOR): qualquer gestor pode
    // alterar triagem própria ou designada a psico/assist.
    const detail = await appointmentApi.getAppointment(request, id);
    if (status === "REALIZADA") {
      const processFrida = await getProcessFrida(request, detail.processoId);
      if (!processFrida.frida) {
        return data<ConsultaDetailActionData>(
          {
            error:
              "Preencha o FRIDA antes de marcar como realizada. O formulário pode ser preenchido com a consulta agendada.",
          },
          { status: 400 },
        );
      }
    }
    await appointmentApi.updateAppointmentStatus(request, id, status);
    return data<ConsultaDetailActionData>({
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
    return data<ConsultaDetailActionData>(
      { error: message },
      { status: statusCode },
    );
  }
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

export default function ManagerConsultaDetalhe({
  loaderData,
}: Route.ComponentProps) {
  const { appointment, report, professionalName, hasFrida, loadError } =
    loaderData;
  const revalidator = useRevalidator();
  const reloading = revalidator.state !== "idle";
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const statusFetcher = useFetcher<ConsultaDetailActionData>();
  const statusBusy = statusFetcher.state !== "idle";
  const [pendingStatus, setPendingStatus] =
    useState<StatusTransition | null>(null);
  const [fridaPendente, setFridaPendente] = useState(false);

  useEffect(() => {
    const result = statusFetcher.data;
    if (statusFetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok) {
      showToast(
        `Consulta marcada como ${getAppointmentStatusLabel(result.status).toLowerCase()}.`,
        "success",
      );
      setPendingStatus(null);
      revalidator.revalidate();
      return;
    }
    if ("error" in result && result.error) {
      showToast(result.error, "error");
      setPendingStatus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFetcher.data, statusFetcher.state]);

  if (!appointment) {
    return (
      <section
        className="mx-auto max-w-3xl p-4 lg:p-6"
        aria-label="Detalhe da consulta"
      >
        <Link
          to="/manager/consultas"
          className="text-xs font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
        >
          ← Voltar às consultas
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
  const processoEncerrado =
    (report?.processo.status ?? appointment.processo?.status ?? "").toUpperCase() ===
    "ENCERRADO";
  const showFrida =
    appointment.tipoProfissional === "TRIAGEM" ||
    appointment.tipoProfissional === "PSICOLOGO";

  function requestStatus(next: StatusTransition) {
    if (next === "REALIZADA" && hasFrida === false) {
      setFridaPendente(true);
      return;
    }
    setPendingStatus(next);
  }

  function handleConfirmStatus() {
    if (!pendingStatus) return;
    statusFetcher.submit(
      { intent: "status", status: pendingStatus },
      { method: "post" },
    );
  }

  return (
    <section
      className="mx-auto max-w-3xl p-4 lg:p-6"
      aria-label="Detalhe da consulta"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/manager/consultas"
          className="text-xs font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
        >
          ← Voltar às consultas
        </Link>
        <AppointmentStatusBadge status={appointment.status} />
      </div>

      <h1 className="mt-3 text-xl font-semibold text-gray-800 lg:text-2xl">
        Consulta de {getProfessionalTypeLabel(appointment.tipoProfissional).toLowerCase()} — {formatDate(appointment.dataHora)} às{" "}
        {formatTime(appointment.dataHora)}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Vítima {report?.vitima.nome?.trim() || appointment.vitimaNome?.trim() || "—"} · Processo{" "}
        <span className="font-mono" title={appointment.processoId}>
          {shortId(appointment.processoId)}
        </span>
      </p>

      <div className="mt-4 space-y-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm lg:p-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Atendimento</h2>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            <Definition
              label="Profissional"
              value={professionalName?.trim() || "—"}
            />
            <Definition
              label="Modalidade"
              value={getModalityLabel(appointment.modalidade)}
            />
            <Definition
              label="Confirmado pelo profissional"
              value={
                appointment.confirmacaoProfissional === "CONFIRMADO"
                  ? `Sim${appointment.confirmadoProfissionalEm ? ` em ${formatDateTime(appointment.confirmadoProfissionalEm)}` : ""}`
                  : "Pendente"
              }
            />
            <Definition
              label="Confirmado pela vítima"
              value={
                appointment.confirmacaoVitima === "CONFIRMADO"
                  ? `Sim${appointment.confirmadoVitimaEm ? ` em ${formatDateTime(appointment.confirmadoVitimaEm)}` : ""}`
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
                    Abrir sala
                  </a>
                </dd>
              </div>
            ) : null}
            {appointment.observacoes ? (
              <div className="sm:col-span-2">
                <Definition label="Observações" value={appointment.observacoes} />
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
        </div>

        <div className="border-t border-stone-200 pt-4">
          <h2 className="text-sm font-semibold text-gray-800">Vítima / Processo</h2>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            <Definition
              label="Vítima"
              value={
                report?.vitima.nome?.trim() ||
                appointment.vitimaNome?.trim() ||
                "—"
              }
            />
            <Definition
              label="Vínculo"
              value={getPatientBondLabel(report?.vitima.vinculo ?? null)}
            />
            <Definition
              label="Campus"
              value={report?.vitima.campus?.trim() || "—"}
            />
            <Definition
              label="Curso"
              value={report?.vitima.curso?.trim() || "—"}
            />
          </dl>
          <div className="mt-3">
            <Link
              to={`/manager/processos/${encodeURIComponent(appointment.processoId)}`}
              className="text-xs font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
            >
              Ver processo completo
            </Link>
          </div>
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
            <h2 className="text-sm font-semibold text-gray-800">Situação</h2>
            <p className="mt-1 text-sm text-gray-600">
              Marque o resultado desta consulta. Esta ação não pode ser desfeita.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => requestStatus("REALIZADA")}
                disabled={statusBusy}
                title={
                  hasFrida === false
                    ? "Preencha o FRIDA antes de marcar como realizada"
                    : "Marcar consulta como realizada"
                }
                className="inline-flex rounded-lg border border-black/5 bg-[#EAF3DE] px-4 py-2 text-xs font-semibold text-[#27500A] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Realizada
              </button>
              <button
                type="button"
                onClick={() => requestStatus("CANCELADA")}
                disabled={statusBusy}
                title="Marcar consulta como cancelada"
                className="inline-flex rounded-lg border border-black/5 bg-[#F1EFE8] px-4 py-2 text-xs font-semibold text-[#5F5E5A] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelada
              </button>
              <button
                type="button"
                onClick={() => requestStatus("FALTOU")}
                disabled={statusBusy}
                title="Marcar consulta como falta"
                className="inline-flex rounded-lg border border-black/5 bg-[#FAEEDA] px-4 py-2 text-xs font-semibold text-[#854F0B] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Faltou
              </button>
              {showFrida ? (
                <Link
                  to={`/manager/frida/${appointment.id}`}
                  className="inline-flex rounded-lg bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C]"
                >
                  {hasFrida ? "Abrir FRIDA" : "Preencher FRIDA"}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
        {isRealizada && !processoEncerrado ? (
          <div className="border-t border-stone-200 pt-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Cancelar registro
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {isTriagem
                ? "A triagem será desfeita: o processo volta para ABERTO e uma nova triagem poderá ser agendada."
                : "O registro de realizada será desfeito. Relatórios existentes serão mantidos."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => requestStatus("CANCELADA")}
                disabled={statusBusy}
                title="Cancelar consulta realizada"
                className="inline-flex rounded-lg border border-black/5 bg-[#F1EFE8] px-4 py-2 text-xs font-semibold text-[#5F5E5A] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar consulta realizada
              </button>
            </div>
          </div>
        ) : null}
        {!editable && !isRealizada && showFrida ? (
          <div className="border-t border-stone-200 pt-4">
            <h2 className="text-sm font-semibold text-gray-800">FRIDA</h2>
            <div className="mt-3">
              <Link
                to={`/manager/frida/${appointment.id}`}
                className="inline-flex rounded-lg bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C]"
              >
                Abrir FRIDA
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmModal
        open={pendingStatus !== null}
        title="Alterar status da consulta?"
        description={
          pendingStatus
            ? `A consulta será marcada como ${getAppointmentStatusLabel(pendingStatus).toLowerCase()}. Esta ação não pode ser desfeita.`
            : ""
        }
        consequences={
          pendingStatus === "CANCELADA"
            ? appointment.status === "REALIZADA" && isTriagem
              ? "A triagem será desfeita (processo volta para ABERTO). A vítima e o profissional serão notificados."
              : appointment.status === "REALIZADA"
                ? "O registro de realizada será desfeito (relatórios mantidos). A vítima e o profissional serão notificados."
                : "A vítima e o profissional serão notificados sobre o cancelamento."
            : undefined
        }
        confirmLabel={
          pendingStatus
            ? `Marcar como ${getAppointmentStatusLabel(pendingStatus)}`
            : "Confirmar"
        }
        cancelLabel="Voltar"
        loading={statusBusy}
        onConfirm={handleConfirmStatus}
        onCancel={() => {
          if (!statusBusy) setPendingStatus(null);
        }}
      />

      <ConfirmModal
        open={fridaPendente}
        title="FRIDA pendente"
        description="Preencha o formulário FRIDA antes de marcar como realizada. Ele pode ser preenchido com a consulta agendada."
        confirmLabel="Preencher FRIDA"
        confirmVariant="primary"
        cancelLabel="Voltar"
        onConfirm={() => {
          setFridaPendente(false);
          navigate(`/manager/frida/${appointment.id}`);
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
