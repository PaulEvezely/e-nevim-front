import { useEffect, useState } from "react";
import { data, Link, useFetcher, useRevalidator } from "react-router";
import type { Route } from "./+types/processo-detalhe";
import { requireUser } from "../../../features/auth/require-user.server";
import { appointmentApi } from "../../../features/manager/appointmentApi.server";
import {
  encaminharParaOrgaoExterno,
  encerrarProcesso,
  getProcessReport,
  type ProcessReport,
} from "../../../features/manager/processReportApi.server";
import {
  isExternalReferralDestino,
  validateExternalReferralForm,
  type ExternalReferralDestino,
} from "../../../features/manager/externalReferral";
import { shortId } from "../../../features/manager/managerUtils";
import {
  getPatientBondLabel,
  getPatientRiskBadgeLabel,
  getPatientTriageLabel,
  getProcessStatusHint,
  getProcessStatusLabel,
  type PatientTriageStatus,
} from "../../../features/manager/patientUtils";
import {
  formatDate,
  formatDateTime,
  formatTime,
  getAppointmentStatusLabel,
  getModalityLabel,
  getProfessionalTypeLabel,
} from "../../../features/manager/appointmentUtils";
import { ApiError } from "../../../libs/api.server";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { Toast } from "../../../shared/components/Toast";
import { useToast } from "../../../shared/hooks/useToast";
import { EncaminharExternoModal } from "../../../features/manager/components/EncaminharExternoModal";
import { AppointmentForm } from "../../../features/manager/components/AppointmentForm";
import { type AppointmentProcessOption } from "../../../features/manager/appointmentUtils";

type ProcessDetailLoaderData =
  | {
      report: ProcessReport;
      professionalNames: Record<string, string>;
      triageStatus: PatientTriageStatus;
      triageProcessOptions: AppointmentProcessOption[];
      processOptions: AppointmentProcessOption[];
      professionals: { id: string; nome: string; perfil: string; registro?: string | null }[];
      gestor: { id: string; nome: string };
      calendarAppointments: { profissionalId: string; dataHora: string; dataHoraFim?: string | null; status: string; processoId?: string; tipoProfissional?: string; vitimaNome?: string | null; vitimaCampus?: string | null }[];
      loadError: null;
    }
  | {
      report: null;
      professionalNames: Record<string, string>;
      triageStatus: null;
      triageProcessOptions: [];
      processOptions: [];
      professionals: [];
      gestor: { id: string; nome: string };
      calendarAppointments: [];
      loadError: string;
    };

type ProcessDetailActionData =
  | { ok: true; action: "encaminhar-externo" }
  | {
      ok: true;
      action: "encerrar";
      consultasCanceladas?: number;
    }
  | { ok?: false; error: string; fieldErrors?: Record<string, string> };

function deriveTriageStatus(status: string): PatientTriageStatus {
  switch (status.toUpperCase()) {
    case "EM_TRIAGEM":
      return "EM_TRIAGEM";
    case "ENCAMINHADO":
      return "ENCAMINHADO";
    case "ENCERRADO":
      return "ENCERRADO";
    default:
      return "SEM_TRIAGEM";
  }
}

function toFriendlyLoadError(status?: number): string {
  if (status === 404) return "Processo não encontrado.";
  if (status === 403) return "Você não tem permissão para ver este processo.";
  return "Não foi possível carregar o processo. Tente novamente em instantes.";
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request, ["manager"]);
  const id = params.id?.trim() ?? "";
  if (!id) {
    return {
      report: null,
      professionalNames: {},
      triageStatus: null,
      triageProcessOptions: [],
      processOptions: [],
      professionals: [],
      gestor: { id: "", nome: "Gestor" },
      calendarAppointments: [],
      loadError: "Processo não encontrado.",
    } satisfies ProcessDetailLoaderData;
  }
  try {
    const user = await requireUser(request, ["manager"]);
    const [
      report,
      professionals,
      triageProcessOptions,
      processOptions,
      gestor,
      calendarAppointments,
    ] = await Promise.all([
      getProcessReport(request, id),
      appointmentApi.listProfessionals(request).catch(() => []),
      appointmentApi.listTriageProcessOptions(request).catch(() => []),
      appointmentApi.listProcessOptions(request).catch(() => []),
      appointmentApi.getGestor(request, user.id).catch(() => ({
        id: user.id,
        nome: user.name || "Gestor",
      })),
      appointmentApi.listAppointments(request).catch(() => []),
    ]);
    const professionalNames: Record<string, string> = {};
    for (const professional of professionals) {
      professionalNames[professional.id] = professional.nome;
    }
    return {
      report,
      professionalNames,
      triageStatus: deriveTriageStatus(report.processo.status),
      triageProcessOptions,
      processOptions,
      professionals,
      gestor,
      calendarAppointments,
      loadError: null,
    } satisfies ProcessDetailLoaderData;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : undefined;
    return {
      report: null,
      professionalNames: {},
      triageStatus: null,
      triageProcessOptions: [],
      processOptions: [],
      professionals: [],
      gestor: { id: "", nome: "Gestor" },
      calendarAppointments: [],
      loadError: toFriendlyLoadError(status),
    } satisfies ProcessDetailLoaderData;
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request, ["manager"]);
  const id = params.id?.trim() ?? "";
  if (!id) {
    return data<ProcessDetailActionData>(
      { error: "Processo inválido." },
      { status: 404 },
    );
  }
  const form = await request.formData().catch(() => null);
  const intent = String(form?.get("intent") ?? "");

  if (intent === "encerrar") {
    try {
      const result = await encerrarProcesso(request, id);
      return data<ProcessDetailActionData>({
        ok: true,
        action: "encerrar",
        consultasCanceladas: result.consultasCanceladas ?? 0,
      });
    } catch (err) {
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : "Não foi possível encerrar o processo. Tente novamente em instantes.";
      const status =
        err instanceof ApiError && err.status >= 400 && err.status < 600
          ? err.status
          : 500;
      return data<ProcessDetailActionData>({ error: message }, { status });
    }
  }

  if (!form || intent !== "encaminhar-externo") {
    return data<ProcessDetailActionData>(
      { error: "Ação inválida." },
      { status: 400 },
    );
  }
  const destinoRaw = String(form.get("destino") ?? "").trim();
  const detalhes = String(form.get("detalhes") ?? "");
  if (!isExternalReferralDestino(destinoRaw)) {
    return data<ProcessDetailActionData>(
      {
        error: "Corrija os campos destacados antes de enviar.",
        fieldErrors: { destino: "Selecione o órgão de destino." },
      },
      { status: 400 },
    );
  }
  const destino: ExternalReferralDestino = destinoRaw;
  const validationErrors = validateExternalReferralForm({
    destino,
    detalhes,
  });
  if (Object.keys(validationErrors).length > 0) {
    return data<ProcessDetailActionData>(
      {
        error: "Corrija os campos destacados antes de enviar.",
        fieldErrors: validationErrors as Record<string, string>,
      },
      { status: 400 },
    );
  }
  try {
    await encaminharParaOrgaoExterno(request, id, {
      destinoExterno: destino,
      detalhesExterno: detalhes.trim(),
    });
    return data<ProcessDetailActionData>({
      ok: true,
      action: "encaminhar-externo",
    });
  } catch (err) {
    if (err instanceof ApiError) {
      const fieldErrors: Record<string, string> = {};
      for (const [key, messages] of Object.entries(err.fieldErrors ?? {})) {
        if (messages[0]) fieldErrors[key] = messages[0];
      }
      const message =
        err.message ||
        "Não foi possível registrar o encaminhamento. Tente novamente em instantes.";
      const status = err.status >= 400 && err.status < 600 ? err.status : 500;
      if (Object.keys(fieldErrors).length > 0) {
        return data<ProcessDetailActionData>(
          { error: "Corrija os campos destacados antes de enviar.", fieldErrors },
          { status },
        );
      }
      return data<ProcessDetailActionData>({ error: message }, { status });
    }
    return data<ProcessDetailActionData>(
      { error: "Não foi possível registrar o encaminhamento. Tente novamente em instantes." },
      { status: 500 },
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

export default function ManagerProcessoDetalhe({
  loaderData,
}: Route.ComponentProps) {
  const {
    report,
    professionalNames,
    triageStatus,
    triageProcessOptions,
    processOptions,
    professionals,
    gestor,
    calendarAppointments,
    loadError,
  } = loaderData;

  if (!report || !triageStatus) {
    return (
      <section
        className="mx-auto max-w-3xl p-4 lg:p-6"
        aria-label="Detalhe do processo"
      >
        <Link
          to="/manager/pacientes"
          className="text-xs font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
        >
          ← Voltar aos pacientes
        </Link>
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]"
        >
          {loadError ?? "Processo não encontrado."}
        </div>
      </section>
    );
  }

  const processo = report.processo;
  const processStatus = getProcessStatusLabel(processo.status);
  const riskLabel = getPatientRiskBadgeLabel(processo.classificacaoRisco);
  const fridaByConsulta = new Map(
    report.frida.map((item) => [item.consultaId, item]),
  );
  // Só oferece agendar triagem se o processo ainda está na fila de opções
  // (triageProcessOptions já exclui processos com triagem AGENDADA).
  const canScheduleTriage =
    processo.status.toUpperCase() === "ABERTO" &&
    triageProcessOptions.some((option) => option.processoId === processo.id);
  const canScheduleFollowUp =
    processo.status.toUpperCase() === "EM_TRIAGEM" ||
    processo.status.toUpperCase() === "ENCAMINHADO";
  // Encaminhamento externo exige processo em acompanhamento.
  const canForwardExternal = canScheduleFollowUp;
  const isEncerrado = processo.status.toUpperCase() === "ENCERRADO";

  const revalidator = useRevalidator();
  const { toast, showToast } = useToast();
  const forwardFetcher = useFetcher<ProcessDetailActionData>();
  const forwardBusy = forwardFetcher.state !== "idle";
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardFieldErrors, setForwardFieldErrors] = useState<
    Record<string, string>
  >({});
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const closeFetcher = useFetcher<ProcessDetailActionData>();
  const closeBusy = closeFetcher.state !== "idle";

  const [agendarTriagemId, setAgendarTriagemId] = useState<string | null>(null);
  const [agendarConsultaId, setAgendarConsultaId] = useState<string | null>(null);

  // Opção inicial para o combobox vir preenchido (detalhe → Marcar consulta)
  const currentProcessOption: AppointmentProcessOption = {
    processoId: processo.id,
    status: processo.status,
    direcionadoPara: processo.direcionadoPara,
    classificacaoRisco: processo.classificacaoRisco,
    abertoEm: processo.abertoEm,
    vitimaNome: report.vitima.nome ?? "",
    vitimaCampus: report.vitima.campus ?? "",
    totalConsultas: report.consultas.length,
  };

  function handleAgendarTriagem() {
    setAgendarTriagemId(processo.id);
  }

  function handleAgendarConsulta() {
    setAgendarConsultaId(processo.id);
  }

  function handleAgendarClose() {
    setAgendarTriagemId(null);
    setAgendarConsultaId(null);
  }

  function handleAgendarSuccess() {
    showToast("Consulta agendada com sucesso.", "success");
    revalidator.revalidate();
    handleAgendarClose();
  }

  useEffect(() => {
    const result = forwardFetcher.data;
    if (forwardFetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok) {
      showToast("Encaminhamento registrado com sucesso.", "success");
      setForwardOpen(false);
      setForwardFieldErrors({});
      setForwardError(null);
      revalidator.revalidate();
      return;
    }
    if ("error" in result && result.error) {
      setForwardFieldErrors(
        "fieldErrors" in result && result.fieldErrors
          ? result.fieldErrors
          : {},
      );
      setForwardError(result.error);
      showToast(result.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forwardFetcher.data, forwardFetcher.state]);

  useEffect(() => {
    const result = closeFetcher.data;
    if (closeFetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok) {
      const canceladas =
        result.action === "encerrar" ? (result.consultasCanceladas ?? 0) : 0;
      showToast(
        canceladas > 0
          ? `Processo encerrado. ${canceladas} ${canceladas === 1 ? "consulta futura cancelada" : "consultas futuras canceladas"}.`
          : "Processo encerrado.",
        "success",
      );
      setCloseOpen(false);
      revalidator.revalidate();
      return;
    }
    if ("error" in result && result.error) {
      showToast(result.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeFetcher.data, closeFetcher.state]);

  function handleConfirmForward(destino: ExternalReferralDestino, detalhes: string) {
    setForwardFieldErrors({});
    setForwardError(null);
    forwardFetcher.submit(
      { intent: "encaminhar-externo", destino, detalhes },
      { method: "post" },
    );
  }

  return (
    <section
      className="mx-auto max-w-3xl p-4 lg:p-6"
      aria-label="Detalhe do processo"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/manager/pacientes"
          className="text-xs font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
        >
          ← Voltar aos pacientes
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={getPatientTriageLabel(triageStatus)} />
          <span title={getProcessStatusHint(processo.status)}>
            <StatusBadge status={processStatus} />
          </span>
          {riskLabel ? <StatusBadge status={riskLabel} /> : null}
        </div>
      </div>

      <h1 className="mt-3 text-xl font-semibold text-gray-800 lg:text-2xl">
        Processo {shortId(processo.id)}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Aberto em {formatDateTime(processo.abertoEm)}
        {processo.triadoEm
          ? ` · Triagem em ${formatDateTime(processo.triadoEm)}`
          : ""}
      </p>

      <div className="mt-4 space-y-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm lg:p-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Vítima</h2>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            <Definition
              label="Nome"
              value={report.vitima.nome?.trim() || "—"}
            />
            <Definition
              label="Vínculo"
              value={getPatientBondLabel(report.vitima.vinculo)}
            />
            <Definition
              label="Campus"
              value={report.vitima.campus?.trim() || "—"}
            />
            <Definition
              label="Curso"
              value={report.vitima.curso?.trim() || "—"}
            />
          </dl>
        </div>

        <div className="border-t border-stone-200 pt-4">
          <h2 className="text-sm font-semibold text-gray-800">Processo</h2>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            <Definition
              label="Área atual"
              value={
                processo.direcionadoPara
                  ? getProfessionalTypeLabel(
                      processo.direcionadoPara as
                        | "PSICOLOGO"
                        | "ASSISTENTE_SOCIAL"
                        | "ASSESSOR_JURIDICO",
                    )
                  : canScheduleTriage
                    ? "Triagem (gestor)"
                    : "—"
              }
            />
            <Definition
              label="Encerrado em"
              value={
                processo.encerradoEm
                  ? formatDateTime(processo.encerradoEm)
                  : "—"
              }
            />
            <Definition
              label="Total de consultas"
              value={String(report.consultas.length)}
            />
          </dl>
          {processo.observacaoTriagem ? (
            <div className="mt-3">
              <Definition
                label="Observação da triagem"
                value={processo.observacaoTriagem}
              />
            </div>
          ) : null}
        </div>

        <div className="border-t border-stone-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800">Demanda</h2>
            {report.demanda?.id ? (
              <Link
                to={`/manager/demandas/${encodeURIComponent(report.demanda.id)}`}
                aria-label={`Abrir demanda ${shortId(report.demanda.id)}`}
                className="inline-flex rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0C447C] hover:bg-[#E6F1FB]"
              >
                Abrir demanda
              </Link>
            ) : null}
          </div>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            <Definition
              label="Tipo de violência"
              value={report.demanda.tipoViolencia?.trim() || "—"}
            />
          </dl>
          <div className="mt-3">
            <Definition
              label="Descrição"
              value={report.demanda.descricao?.trim() || "—"}
            />
          </div>
        </div>

        <div className="border-t border-stone-200 pt-4">
          <h2 className="text-sm font-semibold text-gray-800">
            Consultas ({report.consultas.length})
          </h2>
          {report.consultas.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Nenhuma consulta registrada neste processo.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-150 border-collapse">
                <caption className="sr-only">
                  Consultas do processo, mais recentes primeiro
                </caption>
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Data / Hora
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Tipo
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Profissional
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-semibold"
                    >
                      FRIDA
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[#E6F1FB]/40">
                  {report.consultas.map((consulta) => {
                    const frida = fridaByConsulta.get(consulta.id);
                    const showFrida =
                      consulta.tipoProfissional === "TRIAGEM" ||
                      consulta.tipoProfissional === "PSICOLOGO";
                    return (
                      <tr
                        key={consulta.id}
                        className="border-t border-stone-200 first:border-t-0"
                      >
                        <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-gray-700">
                          {formatDate(consulta.dataHora)}{" "}
                          {formatTime(consulta.dataHora)}
                          <span className="block text-[11px] text-gray-500">
                            {getModalityLabel(
                              consulta.modalidade as
                                | "PRESENCIAL"
                                | "ONLINE"
                                | null,
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-gray-700">
                          {getProfessionalTypeLabel(
                            consulta.tipoProfissional as
                              | "TRIAGEM"
                              | "PSICOLOGO"
                              | "ASSISTENTE_SOCIAL"
                              | "ASSESSOR_JURIDICO",
                          )}
                        </td>
                        <td className="max-w-44 truncate px-3 py-3 align-top text-xs text-gray-700">
                          {professionalNames[consulta.profissionalId] || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-gray-700">
                          {getAppointmentStatusLabel(
                            consulta.status as
                              | "AGENDADA"
                              | "REALIZADA"
                              | "CANCELADA"
                              | "FALTOU",
                          )}
                          {frida ? (
                            <span className="block text-[11px] text-[#27500A]">
                              Risco: {frida.nivelRisco}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                          {showFrida ? (
                            <Link
                              to={`/manager/frida/${consulta.id}`}
                              className="inline-flex rounded-lg bg-[#378ADD] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#0C447C]"
                            >
                              FRIDA
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-stone-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800">
              Encaminhamentos ({report.encaminhamentos.length})
            </h2>
            {canForwardExternal ? (
              <button
                type="button"
                onClick={() => {
                  setForwardFieldErrors({});
                  setForwardError(null);
                  setForwardOpen(true);
                }}
                className="rounded-xl bg-[#378ADD] px-3 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C]"
              >
                Encaminhar para órgão externo
              </button>
            ) : null}
          </div>
          {report.encaminhamentos.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Nenhum encaminhamento registrado.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {report.encaminhamentos.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-gray-800">
                    {item.destino}
                  </p>
                  {item.detalhes ? (
                    <p className="mt-0.5 text-sm text-gray-600">
                      {item.detalhes}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {formatDateTime(item.criadoEm)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-stone-200 pt-4">
          <h2 className="text-sm font-semibold text-gray-800">Histórico</h2>
          {report.historicoAtividades.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Nenhuma atividade registrada.
            </p>
          ) : (
            <ol className="mt-2 space-y-2">
              {report.historicoAtividades.map((item, index) => (
                <li
                  key={`${item.titulo}-${item.data}-${index}`}
                  className="flex flex-wrap items-baseline gap-x-2 text-sm"
                >
                  <span className="font-semibold text-gray-800">
                    {item.titulo}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(item.data)} · {item.profissional}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {canScheduleTriage ? (
          <button
            type="button"
            onClick={handleAgendarTriagem}
            className="inline-block rounded-xl bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C]"
          >
            Agendar triagem
          </button>
        ) : null}
        {canScheduleFollowUp ? (
          <button
            type="button"
            onClick={handleAgendarConsulta}
            className="inline-block rounded-xl bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C]"
          >
            Marcar consulta
          </button>
        ) : null}
        <Link
          to={`/manager/consultas?processoId=${encodeURIComponent(processo.id)}`}
          className="inline-block rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-[#0C447C] hover:bg-[#E6F1FB]"
        >
          Ver consultas
        </Link>
        {report.demanda?.id ? (
          <Link
            to={`/manager/demandas/${encodeURIComponent(report.demanda.id)}`}
            aria-label={`Abrir demanda ${shortId(report.demanda.id)}`}
            className="inline-block rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-[#0C447C] hover:bg-[#E6F1FB]"
          >
            Abrir demanda
          </Link>
        ) : null}
        {!isEncerrado ? (
          <button
            type="button"
            onClick={() => setCloseOpen(true)}
            className="inline-block rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-[#791F1F] hover:bg-[#FCEBEB]"
          >
            Encerrar processo
          </button>
        ) : null}
      </div>

      <EncaminharExternoModal
        open={forwardOpen}
        loading={forwardBusy}
        fieldErrors={forwardFieldErrors}
        serverError={forwardError}
        onClose={() => {
          if (!forwardBusy) setForwardOpen(false);
        }}
        onConfirm={handleConfirmForward}
      />

      <ConfirmModal
        open={closeOpen}
        title="Encerrar processo?"
        description={`O processo de ${report.vitima.nome?.trim() || "esta vítima"} será marcado como encerrado.`}
        consequences="O processo sairá das filas ativas. As consultas futuras agendadas deste processo serão canceladas automaticamente e vítima/profissional serão avisados. Esta ação não pode ser desfeita — um novo atendimento exigiria um novo processo."
        confirmLabel={closeBusy ? "Encerrando…" : "Encerrar processo"}
        confirmVariant="danger"
        cancelLabel="Voltar"
        loading={closeBusy}
        onConfirm={() => {
          closeFetcher.submit({ intent: "encerrar" }, { method: "post" });
        }}
        onCancel={() => {
          if (!closeBusy) setCloseOpen(false);
        }}
      />
      <AppointmentForm
        open={!!agendarTriagemId}
        processOptions={[]}
        triageProcessOptions={triageProcessOptions}
        professionals={professionals}
        calendarAppointments={calendarAppointments.map((a) => ({
          profissionalId: a.profissionalId,
          dataHora: a.dataHora,
          dataHoraFim: a.dataHoraFim ?? null,
          status: a.status,
          processoId: a.processoId,
          tipoProfissional: a.tipoProfissional,
          vitimaNome: a.vitimaNome ?? null,
          vitimaCampus: a.vitimaCampus ?? null,
        }))}
        gestor={gestor}
        initialProcessoId={agendarTriagemId ?? undefined}
        initialProcessOption={currentProcessOption}
        initialTipo="TRIAGEM"
        lockTipo="TRIAGEM"
        title="Nova triagem"
        onClose={handleAgendarClose}
        showToast={showToast}
      />
      <AppointmentForm
        open={!!agendarConsultaId}
        processOptions={processOptions}
        triageProcessOptions={triageProcessOptions}
        professionals={professionals}
        calendarAppointments={calendarAppointments.map((a) => ({
          profissionalId: a.profissionalId,
          dataHora: a.dataHora,
          dataHoraFim: a.dataHoraFim ?? null,
          status: a.status,
          processoId: a.processoId,
          tipoProfissional: a.tipoProfissional,
          vitimaNome: a.vitimaNome ?? null,
          vitimaCampus: a.vitimaCampus ?? null,
        }))}
        gestor={gestor}
        initialProcessoId={agendarConsultaId ?? undefined}
        initialProcessOption={currentProcessOption}
        initialTipo={undefined}
        lockTipo={undefined}
        title="Nova consulta"
        onClose={handleAgendarClose}
        showToast={showToast}
      />
      <Toast toast={toast} />
    </section>
  );
}
