import { useEffect, useState } from "react";
import {
  data,
  useFetcher,
  useNavigate,
  useRevalidator,
} from "react-router";
import type { Route } from "./+types/minhas-triagens";
import { requireUser } from "../../../features/auth/require-user.server";
import { appointmentApi } from "../../../features/manager/appointmentApi.server";
import {
  attachProcessInfo,
  buildProcessMap,
  filterAppointments,
  getAppointmentStatusLabel,
  paginateAppointments,
  parseAppointmentFilters,
  parseAppointmentPage,
  sortAppointments,
  toCreateAppointmentInput,
  toDayEndIso,
  toDayStartIso,
  toUpdateAppointmentInput,
  validateAppointmentDetails,
  validateAppointmentForm,
  type AppointmentActionData,
  type AppointmentDetailsFormData,
  type AppointmentFilters as AppointmentFilterValues,
  type AppointmentFormData,
  type AppointmentProcessOption,
  type AppointmentStatus,
  type AppointmentStatusFilter,
  type CalendarAppointmentInfo,
  type ManagerAppointmentItem,
  type ProfessionalOption,
} from "../../../features/manager/appointmentUtils";
import { getProcessFrida } from "../../../features/professional/frida/fridaApi.server";
import { getProcessReport } from "../../../features/manager/processReportApi.server";
import { AppointmentFilters } from "../../../features/manager/components/AppointmentFilters";
import { ManagerTriagemCard } from "../../../features/manager/components/ManagerTriagemCard";
import { AppointmentForm } from "../../../features/manager/components/AppointmentForm";
import { AppointmentEditForm } from "../../../features/manager/components/AppointmentEditForm";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { Pagination } from "../../../shared/components/Pagination";
import { SkeletonCard } from "../../../shared/components/LoadingOverlay";
import { Toast } from "../../../shared/components/Toast";
import { useToast } from "../../../shared/hooks/useToast";
import { ApiError } from "../../../libs/api.server";

type TriagensLoaderData = {
  appointments: ManagerAppointmentItem[];
  page: number;
  totalPages: number;
  filteredCount: number;
  totalCount: number;
  statusCounts: Record<AppointmentStatusFilter, number>;
  filters: AppointmentFilterValues;
  triageProcessOptions: AppointmentProcessOption[];
  /** Consultas existentes (para a ocupação no calendário do form). */
  calendarAppointments: CalendarAppointmentInfo[];
  gestor: { id: string; nome: string };
  professionals: ProfessionalOption[];
  /** Processo a agendar (deep-link da fila de triagem do painel). */
  triageToSchedule: string | null;
  /** processoId -> FRIDA existente (só REALIZADA com FRIDA). */
  fridaPorProcesso: Record<string, boolean>;
  fridaCheckFailed: boolean;
  loadError: string | null;
};

type StatusTransition = Exclude<AppointmentStatus, "AGENDADA">;

const STATUS_TRANSITIONS: StatusTransition[] = [
  "REALIZADA",
  "CANCELADA",
  "FALTOU",
];

const EMPTY_STATUS_COUNTS: Record<AppointmentStatusFilter, number> = {
  ALL: 0,
  AGENDADA: 0,
  REALIZADA: 0,
  CANCELADA: 0,
  FALTOU: 0,
};

function mapBackendFieldErrors(
  backendFields: Record<string, string[]>,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  const keys = [
    "processoId",
    "tipoProfissional",
    "profissionalId",
    "modalidade",
    "linkMeet",
    "observacoes",
  ] as const;
  for (const key of keys) {
    const message = backendFields[key]?.[0];
    if (message) fieldErrors[key] = message;
  }
  const dataHora = backendFields.dataHora?.[0];
  if (dataHora) fieldErrors.dataLocal = dataHora;
  const dataHoraFim = backendFields.dataHoraFim?.[0];
  if (dataHoraFim) fieldErrors.dataFim = dataHoraFim;
  return fieldErrors;
}

function actionError(
  err: unknown,
  fallback: string,
  includeFields = false,
) {
  const message =
    err instanceof ApiError && err.message ? err.message : fallback;
  const status = err instanceof ApiError ? err.status : 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  let fieldErrors: Record<string, string> =
    includeFields && err instanceof ApiError
      ? mapBackendFieldErrors(err.fieldErrors)
      : {};
  // 409 de triagem duplicada (back antigo ou corrida): sem fieldErrors, mas com
  // mensagem clara — mapeia para o campo de processo para aparecer no form.
  if (
    Object.keys(fieldErrors).length === 0 &&
    err instanceof ApiError &&
    err.status === 409 &&
    message.toLowerCase().includes("triagem")
  ) {
    fieldErrors = {
      processoId:
        "Este processo já possui triagem ativa (agendada ou realizada)",
    };
  }
  if (Object.keys(fieldErrors).length > 0) {
    return data<AppointmentActionData>(
      { error: "Corrija os campos destacados antes de enviar.", fieldErrors },
      { status: safeStatus },
    );
  }
  return data<AppointmentActionData>({ error: message }, { status: safeStatus });
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, ["manager"]);
  const url = new URL(request.url);
  const filters = parseAppointmentFilters(url.searchParams);
  // Tela de triagens do próprio gestor: ignora tipo vindo da URL.
  filters.tipoProfissional = "TRIAGEM";
  const requestedPage = parseAppointmentPage(url.searchParams);
  // Deep-link da fila de triagem: ?agendarTriagem=<processoId>
  const triageToSchedule = url.searchParams.get("agendarTriagem")?.trim() || null;

  const de = toDayStartIso(filters.from);
  const ate = toDayEndIso(filters.to);

  try {
    const [
      appointments,
      processes,
      triageProcesses,
      emTriagemProcesses,
      gestor,
      professionals,
    ] = await Promise.all([
      appointmentApi.listMyTriagemAppointments(request, user.id),
      appointmentApi.listProcessOptions(request).catch(() => []),
      appointmentApi.listTriageProcessOptions(request).catch(() => []),
      appointmentApi.listEmTriagemProcessOptions(request).catch(() => []),
      appointmentApi.getGestor(request, user.id).catch(() => ({
        id: user.id,
        nome: user.name || "Gestor",
      })),
      appointmentApi.listProfessionals(request).catch(() => []),
    ]);

    // Mapa para nome/campus da vítima (triagem pode estar em processo
    // ABERTO, EM_TRIAGEM ou já ENCAMINHADO).
    const processMap = buildProcessMap([
      ...processes,
      ...triageProcesses,
      ...emTriagemProcesses,
    ]);
    let enriched = attachProcessInfo(appointments, processMap);

    // Fallback: quando o mapa não resolve (ex.: processo ABERTO recém-revertido
    // após CANCELADA), busca o nome/campus direto do report — sem filtrar a lista.
    const missingIds = [
      ...new Set(
        enriched
          .filter((appointment) => !appointment.vitimaNome)
          .map((appointment) => appointment.processoId),
      ),
    ];
    if (missingIds.length > 0) {
      const reports = await Promise.allSettled(
        missingIds.map((id) =>
          getProcessReport(request, id).catch(() => null),
        ),
      );
      const nameMap = new Map<string, { nome: string; campus: string }>();
      for (const result of reports) {
        if (
          result.status === "fulfilled" &&
          result.value &&
          result.value.vitima
        ) {
          nameMap.set(result.value.processo.id, {
            nome: result.value.vitima.nome ?? "",
            campus: result.value.vitima.campus ?? "",
          });
        }
      }
      if (nameMap.size > 0) {
        enriched = enriched.map((appointment) => {
          const hit = nameMap.get(appointment.processoId);
          if (!hit) return appointment;
          return {
            ...appointment,
            vitimaNome: appointment.vitimaNome ?? hit.nome,
            vitimaCampus: appointment.vitimaCampus ?? hit.campus,
          };
        });
      }
    }

    const statusCounts: Record<AppointmentStatusFilter, number> = {
      ...EMPTY_STATUS_COUNTS,
    };
    for (const appointment of enriched) {
      statusCounts.ALL += 1;
      statusCounts[appointment.status] += 1;
    }

    const filtered = filterAppointments(enriched, filters);
    const paginated = paginateAppointments(
      sortAppointments(filtered),
      requestedPage,
    );

    const fridaTargets = [
      ...new Set(
        paginated.items
          .filter((appointment) => appointment.status === "AGENDADA")
          .map((appointment) => appointment.processoId),
      ),
    ];
    const fridaResults = await Promise.allSettled(
      fridaTargets.map(async (processoId) => {
        const res = await getProcessFrida(request, processoId);
        return { processoId, hasFrida: res.frida !== null };
      }),
    );
    const fridaPorProcesso: Record<string, boolean> = {};
    let fridaCheckFailed = false;
    for (const result of fridaResults) {
      if (result.status === "fulfilled") {
        fridaPorProcesso[result.value.processoId] = result.value.hasFrida;
      } else {
        fridaCheckFailed = true;
      }
    }

    return {
      appointments: paginated.items,
      page: paginated.page,
      totalPages: paginated.totalPages,
      filteredCount: paginated.total,
      totalCount: enriched.length,
      statusCounts,
      filters,
      triageProcessOptions: triageProcesses,
      calendarAppointments: enriched.map((appointment) => ({
        dataHora: appointment.dataHora,
        dataHoraFim: appointment.dataHoraFim ?? null,
        profissionalId: appointment.profissionalId,
        status: appointment.status,
        processoId: appointment.processoId,
        tipoProfissional: appointment.tipoProfissional,
        vitimaNome: appointment.vitimaNome ?? null,
        vitimaCampus: appointment.vitimaCampus ?? null,
      })),
      gestor,
      professionals,
      triageToSchedule,
      fridaPorProcesso,
      fridaCheckFailed,
      loadError: null,
    } satisfies TriagensLoaderData;
  } catch {
    return {
      appointments: [],
      page: 1,
      totalPages: 1,
      filteredCount: 0,
      totalCount: 0,
      statusCounts: EMPTY_STATUS_COUNTS,
      filters,
      triageProcessOptions: [],
      calendarAppointments: [],
      gestor: { id: user.id, nome: user.name || "Gestor" },
      professionals: [],
      triageToSchedule,
      fridaPorProcesso: {} as Record<string, boolean>,
      fridaCheckFailed: false,
      loadError:
        "Não foi possível carregar suas triagens. Tente novamente em instantes.",
    } satisfies TriagensLoaderData;
  }
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request, ["manager"]);
  const form = await request.formData().catch(() => null);
  if (!form) {
    return data<AppointmentActionData>(
      { error: "Não foi possível concluir a ação." },
      { status: 400 },
    );
  }

  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "");

  if (intent === "agendar") {
    // Tela de triagens do gestor: tipo e profissional sempre do gestor.
    const formData: AppointmentFormData = {
      processoId: String(form.get("processoId") ?? ""),
      tipoProfissional: "TRIAGEM",
      profissionalId: user.id,
      dataLocal: String(form.get("dataLocal") ?? ""),
      dataFim: String(form.get("dataFim") ?? ""),
      modalidade: String(
        form.get("modalidade") ?? "",
      ) as AppointmentFormData["modalidade"],
      linkMeet: String(form.get("linkMeet") ?? ""),
      observacoes: String(form.get("observacoes") ?? ""),
    };

    const validationErrors = validateAppointmentForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      return data<AppointmentActionData>(
        {
          error: "Corrija os campos destacados antes de enviar.",
          fieldErrors: validationErrors as Record<string, string>,
        },
        { status: 400 },
      );
    }

    const payload = toCreateAppointmentInput(formData);
    if (!payload) {
      return data<AppointmentActionData>(
        { error: "Dados inválidos. Revise o formulário." },
        { status: 400 },
      );
    }

    try {
      const created = await appointmentApi.createAppointment(request, payload);
      return data<AppointmentActionData>(
        { ok: true, action: "agendar", id: created.id },
        { status: 201 },
      );
    } catch (err) {
      return actionError(
        err,
        "Não foi possível agendar a triagem. Tente novamente em instantes.",
        true,
      );
    }
  }

  if (intent === "editar") {
    if (!id) {
      return data<AppointmentActionData>(
        { error: "Consulta inválida." },
        { status: 400 },
      );
    }
    const details: AppointmentDetailsFormData = {
      linkMeet: String(form.get("linkMeet") ?? ""),
      modalidade: String(
        form.get("modalidade") ?? "",
      ) as AppointmentDetailsFormData["modalidade"],
      observacoes: String(form.get("observacoes") ?? ""),
      dataFim: String(form.get("dataFim") ?? ""),
    };
    const inicioIso = await appointmentApi
      .getAppointment(request, id)
      .then((detail) => detail.dataHora)
      .catch(() => undefined);
    const validationErrors = validateAppointmentDetails(details, inicioIso);
    if (Object.keys(validationErrors).length > 0) {
      return data<AppointmentActionData>(
        {
          error: "Corrija os campos destacados antes de enviar.",
          fieldErrors: validationErrors as Record<string, string>,
        },
        { status: 400 },
      );
    }
    try {
      await appointmentApi.updateAppointment(
        request,
        id,
        toUpdateAppointmentInput(details),
      );
      return data<AppointmentActionData>({ ok: true, action: "editar", id });
    } catch (err) {
      return actionError(
        err,
        "Não foi possível atualizar a triagem. Tente novamente em instantes.",
        true,
      );
    }
  }

  if (intent === "confirmar") {
    if (!id) {
      return data<AppointmentActionData>(
        { error: "Consulta inválida." },
        { status: 400 },
      );
    }
    try {
      await appointmentApi.confirmAppointment(request, id);
      return data<AppointmentActionData>({
        ok: true,
        action: "confirmar",
        id,
      });
    } catch (err) {
      return actionError(
        err,
        "Não foi possível confirmar a triagem. Tente novamente em instantes.",
      );
    }
  }

  if (intent === "status") {
    const status = String(form.get("status") ?? "") as StatusTransition;
    if (!id || !STATUS_TRANSITIONS.includes(status)) {
      return data<AppointmentActionData>(
        { error: "Status inválido." },
        { status: 400 },
      );
    }
    // REALIZADA exige FRIDA preenchido antes (a UI só oferece o atalho
    // quando há FRIDA; a action é a trava definitiva).
    if (status === "REALIZADA") {
      try {
        const detail = await appointmentApi.getAppointment(request, id);
        if (detail.profissionalId !== user.id) {
          return data<AppointmentActionData>(
            { error: "Você só pode alterar suas próprias triagens." },
            { status: 403 },
          );
        }
        const processFrida = await getProcessFrida(
          request,
          detail.processoId,
        );
        if (!processFrida.frida) {
          return data<AppointmentActionData>(
            {
              error:
                "Preencha o FRIDA antes de marcar como realizada. O formulário pode ser preenchido com a consulta agendada.",
            },
            { status: 400 },
          );
        }
      } catch (err) {
        return actionError(
          err,
          "Não foi possível verificar o FRIDA. Tente novamente em instantes.",
        );
      }
    }
    try {
      await appointmentApi.updateAppointmentStatus(request, id, status);
      return data<AppointmentActionData>({
        ok: true,
        action: "status",
        id,
        status,
      });
    } catch (err) {
      return actionError(
        err,
        "Não foi possível atualizar o status da triagem. Tente novamente em instantes.",
      );
    }
  }

  return data<AppointmentActionData>(
    { error: "Ação inválida." },
    { status: 400 },
  );
}

export default function ManagerMinhasTriagens({
  loaderData,
}: Route.ComponentProps) {
  const {
    appointments,
    page,
    totalPages,
    filteredCount,
    totalCount,
    statusCounts,
    filters,
    triageProcessOptions,
    calendarAppointments,
    gestor,
    professionals,
    triageToSchedule,
    fridaPorProcesso,
    fridaCheckFailed,
    loadError,
  } = loaderData;
  const revalidator = useRevalidator();
  const reloading = revalidator.state !== "idle";
  const [formOpen, setFormOpen] = useState(triageToSchedule !== null);
  const [editing, setEditing] = useState<ManagerAppointmentItem | null>(null);

  const triageInitialOption = triageToSchedule
    ? triageProcessOptions.find((o) => o.processoId === triageToSchedule) ?? null
    : null;
  const [pendingStatus, setPendingStatus] = useState<{
    appointment: ManagerAppointmentItem;
    status: StatusTransition;
  } | null>(null);
  const [fridaPendente, setFridaPendente] =
    useState<ManagerAppointmentItem | null>(null);
  const navigate = useNavigate();
  const statusFetcher = useFetcher<AppointmentActionData>();
  const statusBusy = statusFetcher.state !== "idle";
  const { toast, showToast } = useToast();

  // Deep-link da fila de triagem: abre o formulário já com o processo pronto.
  useEffect(() => {
    if (!triageToSchedule) return;
    setFormOpen(true);
  }, [triageToSchedule]);

  const canSchedule = triageProcessOptions.length > 0;

  useEffect(() => {
    const result = statusFetcher.data;
    if (statusFetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok) {
      const label = result.status
        ? getAppointmentStatusLabel(result.status).toLowerCase()
        : "atualizada";
      showToast(`Triagem marcada como ${label}.`, "success");
      setPendingStatus(null);
      revalidator.revalidate();
    } else if ("error" in result && result.error) {
      showToast(result.error, "error");
      setPendingStatus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFetcher.data, statusFetcher.state]);

  function handleFridaRequired(appointment: ManagerAppointmentItem) {
    setFridaPendente(appointment);
  }

  function handleConfirmStatus() {
    if (!pendingStatus) return;
    // Bloqueio antecipado (a action valida de novo): sem FRIDA, nem envia.
    if (
      pendingStatus.status === "REALIZADA" &&
      fridaPorProcesso[pendingStatus.appointment.processoId] === false
    ) {
      showToast(
        "Preencha o FRIDA antes de marcar como realizada. O formulário pode ser preenchido com a consulta agendada.",
        "error",
      );
      return;
    }
    statusFetcher.submit(
      {
        intent: "status",
        id: pendingStatus.appointment.id,
        status: pendingStatus.status,
      },
      { method: "post" },
    );
  }

  const emptyMessage =
    filters.status === "ALL"
      ? "Nenhuma triagem agendada no momento."
      : "Nenhuma triagem com este status.";

  return (
    <section className="mx-auto max-w-4xl" aria-label="Minhas triagens">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            Minhas triagens
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Triagens realizadas por você. Preencha o FRIDA e conclua cada
            atendimento.
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {totalCount === 0
              ? "Nenhuma triagem agendada até o momento."
              : `${filteredCount} de ${totalCount} triagens exibidas.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          disabled={!canSchedule}
          title={
            canSchedule
              ? undefined
              : "Nenhum processo aguardando triagem"
          }
          className="rounded-xl bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Nova triagem
        </button>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => revalidator.revalidate()}
            disabled={reloading}
            className="text-xs font-semibold underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
          >
            {reloading ? "Carregando…" : "Tentar novamente"}
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        <AppointmentFilters
          filters={filters}
          counts={statusCounts}
          processOptions={triageProcessOptions}
          action="/manager/minhas-triagens"
          fixedTipo="TRIAGEM"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">
            Triagens agendadas
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Próximas primeiro, depois as já realizadas.
            {totalPages > 1 ? ` Página ${page} de ${totalPages}.` : ""}
          </p>
        </div>
        {reloading && appointments.length === 0 ? (
          <div className="mt-4 grid gap-3" aria-hidden="true">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </div>
        ) : appointments.length === 0 && !loadError ? (
          <div className="px-4 py-10 text-center">
            <div
              aria-hidden="true"
              className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#E6F1FB] text-[#0C447C]"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 11h18" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-800">
              {emptyMessage}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Agende pelo botão acima ou pela fila de triagem no painel.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-3 p-4">
              {appointments.map((appointment) => (
                <ManagerTriagemCard
                  key={appointment.id}
                  appointment={appointment}
                  busy={statusBusy}
                  onEdit={(item) => setEditing(item)}
                  onStatus={(item, status) =>
                    setPendingStatus({ appointment: item, status })
                  }
                  onFridaRequired={handleFridaRequired}
                  hasFrida={fridaPorProcesso[appointment.processoId] ?? null}
                  fridaHref={
                    appointment.status === "AGENDADA" ||
                    appointment.status === "REALIZADA"
                      ? `/manager/frida/${appointment.id}`
                      : null
                  }
                />
              ))}
            </ul>
            <div className="border-t border-stone-200">
              <Pagination page={page} totalPages={totalPages} />
            </div>
          </>
        )}
      </div>

      {editing ? (
        <AppointmentEditForm
          appointment={editing}
          onClose={() => setEditing(null)}
          showToast={showToast}
        />
      ) : null}

      <AppointmentForm
        open={formOpen}
        processOptions={[]}
        triageProcessOptions={triageProcessOptions}
        professionals={professionals}
        calendarAppointments={calendarAppointments}
        gestor={gestor}
        initialProcessoId={triageToSchedule ?? undefined}
        initialProcessOption={triageInitialOption}
        initialTipo={triageToSchedule ? "TRIAGEM" : undefined}
        lockTipo="TRIAGEM"
        title="Nova triagem"
        onClose={() => setFormOpen(false)}
        showToast={showToast}
      />

      <ConfirmModal
        open={pendingStatus !== null}
        title="Alterar status da triagem?"
        description={
          pendingStatus
            ? `A triagem será marcada como ${getAppointmentStatusLabel(pendingStatus.status).toLowerCase()}. Esta ação não pode ser desfeita.`
            : ""
        }
        consequences={
          pendingStatus?.status === "CANCELADA"
            ? "A vítima e o profissional serão notificados sobre o cancelamento."
            : undefined
        }
        confirmLabel={
          pendingStatus
            ? `Marcar como ${getAppointmentStatusLabel(pendingStatus.status)}`
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
        open={fridaPendente !== null}
        title="FRIDA pendente"
        description="Preencha o formulário FRIDA antes de marcar como realizada. Ele pode ser preenchido com a consulta agendada."
        confirmLabel="Preencher FRIDA"
        confirmVariant="primary"
        cancelLabel="Voltar"
        onConfirm={() => {
          const id = fridaPendente?.id;
          setFridaPendente(null);
          if (id) navigate(`/manager/frida/${id}`);
        }}
        onCancel={() => setFridaPendente(null)}
      />

      <Toast toast={toast} />
    </section>
  );
}
