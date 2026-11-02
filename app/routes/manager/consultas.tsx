import { useEffect, useMemo, useState } from "react";
import { data, useRevalidator } from "react-router";
import type { Route } from "./+types/consultas";
import { requireUser } from "../../../features/auth/require-user.server";
import { appointmentApi } from "../../../features/manager/appointmentApi.server";
import {
  attachProcessInfo,
  buildProcessMap,
  filterAppointments,
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
  type AppointmentFormData as AppointmentFormDataType,
  type AppointmentProcessOption,
  type AppointmentStatusFilter,
  type CalendarAppointmentInfo,
  type ManagerAppointmentItem,
  type ProfessionalOption,
} from "../../../features/manager/appointmentUtils";
import { AppointmentFilters } from "../../../features/manager/components/AppointmentFilters";
import { AppointmentTable } from "../../../features/manager/components/AppointmentTable";
import { AppointmentForm } from "../../../features/manager/components/AppointmentForm";
import { AppointmentEditForm } from "../../../features/manager/components/AppointmentEditForm";
import { Pagination } from "../../../shared/components/Pagination";
import { SkeletonCard } from "../../../shared/components/LoadingOverlay";
import { Toast } from "../../../shared/components/Toast";
import { useToast } from "../../../shared/hooks/useToast";
import { ApiError } from "../../../libs/api.server";
import { getProcessReport } from "../../../features/manager/processReportApi.server";

type ConsultasLoaderData = {
  appointments: ManagerAppointmentItem[];
  page: number;
  totalPages: number;
  filteredCount: number;
  totalCount: number;
  statusCounts: Record<AppointmentStatusFilter, number>;
  filters: AppointmentFilterValues;
  processOptions: AppointmentProcessOption[];
  triageProcessOptions: AppointmentProcessOption[];
  /** Processos EM_TRIAGEM: agendar com profissional = encaminhar. */
  emTriagemProcessOptions: AppointmentProcessOption[];
  professionals: ProfessionalOption[];
  professionalNames: Record<string, string>;
  gestor: { id: string; nome: string };
  /** Consultas existentes (para a ocupação no calendário do form). */
  calendarAppointments: CalendarAppointmentInfo[];
  /** Processo a agendar (deep-link da fila de triagem do painel). */
  triageToSchedule: string | null;
  /** Processo para agendar acompanhamento (deep-link da tela Pacientes). */
  consultaToSchedule: string | null;
  loadError: string | null;
};

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
  const requestedPage = parseAppointmentPage(url.searchParams);
  // Deep-link da fila de triagem: ?agendarTriagem=<processoId>
  const triageToSchedule = url.searchParams.get("agendarTriagem")?.trim() || null;
  // Deep-link da tela Pacientes: ?agendarConsulta=<processoId> (EM_TRIAGEM/ENCAMINHADO)
  const consultaToSchedule =
    url.searchParams.get("agendarConsulta")?.trim() || null;

  const de = toDayStartIso(filters.from);
  const ate = toDayEndIso(filters.to);

  try {
    const appointments = await appointmentApi.listAppointments(request, {
      de,
      ate,
      processoId: filters.processoId || undefined,
    });

    const [processes, triageProcesses, emTriagemProcesses, professionals, gestor] =
      await Promise.all([
        appointmentApi.listProcessOptions(request).catch(() => []),
        appointmentApi.listTriageProcessOptions(request).catch(() => []),
        appointmentApi.listEmTriagemProcessOptions(request).catch(() => []),
        appointmentApi.listProfessionals(request).catch(() => []),
        appointmentApi.getGestor(request, user.id).catch(() => ({
          id: user.id,
          nome: user.name || "Gestor",
        })),
      ]);

    // O mapa inclui triagem (ABERTO) e EM_TRIAGEM para que as consultas
    // apareçam com o nome da vítima, e não só com o id do processo.
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

    const professionalNames: Record<string, string> = {};
    for (const professional of professionals) {
      professionalNames[professional.id] = professional.nome;
    }
    // A consulta de triagem é do próprio gestor — ele não vem da lista de
    // profissionais (que só tem Sustentação Social/Jurídico/Psicólogo).
    professionalNames[gestor.id] = gestor.nome;

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

    return {
      appointments: paginated.items,
      page: paginated.page,
      totalPages: paginated.totalPages,
      filteredCount: paginated.total,
      totalCount: enriched.length,
      statusCounts,
      filters,
      processOptions: processes,
      triageProcessOptions: triageProcesses,
      emTriagemProcessOptions: emTriagemProcesses,
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
      professionals,
      professionalNames,
      gestor,
      triageToSchedule,
      consultaToSchedule,
      loadError: null,
    } satisfies ConsultasLoaderData;
  } catch {
    return {
      appointments: [],
      page: 1,
      totalPages: 1,
      filteredCount: 0,
      totalCount: 0,
      statusCounts: EMPTY_STATUS_COUNTS,
      filters,
      processOptions: [],
      triageProcessOptions: [],
      emTriagemProcessOptions: [],
      calendarAppointments: [],
      professionals: [],
      professionalNames: {},
      gestor: { id: user.id, nome: user.name || "Gestor" },
      triageToSchedule,
      consultaToSchedule,
      loadError:
        "Não foi possível carregar as consultas. Tente novamente em instantes.",
    } satisfies ConsultasLoaderData;
  }
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request, ["manager"]);
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
    const formData: AppointmentFormData = {
      processoId: String(form.get("processoId") ?? ""),
      tipoProfissional: String(
        form.get("tipoProfissional") ?? "",
      ) as AppointmentFormData["tipoProfissional"],
      profissionalId: String(form.get("profissionalId") ?? ""),
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
      // Agendar com um profissional É o encaminhamento: antes de criar a
      // consulta, encaminha o processo (EM_TRIAGEM -> ENCAMINHADO com o
      // destino = tipo do profissional). Reencaminhar um processo já
      // ENCAMINHADO só atualiza o destino. Triagem não precisa de
      // encaminhamento (ABERTO/EM_TRIAGEM aceitam TRIAGEM direto).
      if (payload.tipoProfissional !== "TRIAGEM") {
        await appointmentApi.encaminharProcesso(
          request,
          payload.processoId,
          payload.tipoProfissional,
        );
      }
      const created = await appointmentApi.createAppointment(request, payload);
      return data<AppointmentActionData>(
        { ok: true, action: "agendar", id: created.id },
        { status: 201 },
      );
    } catch (err) {
      return actionError(
        err,
        "Não foi possível agendar a consulta. Tente novamente em instantes.",
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
    // Validação fina de término (fim > início, 8h, futuro) usa o início
    // persistido; se a leitura falhar, valida sem o início e o back decide.
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
        "Não foi possível atualizar a consulta. Tente novamente em instantes.",
        true,
      );
    }
  }

  return data<AppointmentActionData>(
    { error: "Ação inválida." },
    { status: 400 },
  );
}

export default function ManagerConsultas({
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
    processOptions,
    triageProcessOptions,
    emTriagemProcessOptions,
    calendarAppointments,
    professionals,
    professionalNames,
    gestor,
    triageToSchedule,
    consultaToSchedule,
    loadError,
  } = loaderData;
  const revalidator = useRevalidator();
  const reloading = revalidator.state !== "idle";
  const [formOpen, setFormOpen] = useState(
    triageToSchedule !== null || consultaToSchedule !== null,
  );
  const [editing, setEditing] = useState<ManagerAppointmentItem | null>(null);
  const { toast, showToast } = useToast();

  // Deep-link da fila de triagem: abre o formulário já com o processo e o
  // tipo TRIAGEM preenchidos. Deep-link da tela Pacientes (?agendarConsulta)
  // abre o formulário com o processo pré-selecionado e o tipo em branco.
  useEffect(() => {
    if (!triageToSchedule && !consultaToSchedule) return;
    setFormOpen(true);
  }, [triageToSchedule, consultaToSchedule]);

  // Processos agendáveis com profissional: já ENCAMINHADOS + EM_TRIAGEM
  // (agendar com o profissional encaminha automaticamente).
  const schedulableProcesses = useMemo(
    () => [...processOptions, ...emTriagemProcessOptions],
    [processOptions, emTriagemProcessOptions],
  );

  const initialProcessId = (consultaToSchedule ?? triageToSchedule) ?? undefined;
  const initialProcessOption = useMemo(() => {
    if (!initialProcessId) return null;
    const all = [...schedulableProcesses, ...triageProcessOptions];
    return all.find((o) => o.processoId === initialProcessId) ?? null;
  }, [initialProcessId, schedulableProcesses, triageProcessOptions]);

  const canSchedule =
    schedulableProcesses.length > 0 || triageProcessOptions.length > 0;

  return (
    <section className="mx-auto max-w-6xl" aria-label="Consultas agendadas">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            Consultas
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Agenda de triagens e acompanhamentos dos processos encaminhados.
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {totalCount === 0
              ? "Nenhuma consulta agendada até o momento."
              : `${filteredCount} de ${totalCount} consultas exibidas.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          disabled={!canSchedule}
          title={
            canSchedule
              ? undefined
              : "Nenhum processo disponível para agendamento"
          }
          className="rounded-xl bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Nova consulta
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
          processOptions={[
            ...processOptions,
            ...triageProcessOptions,
            ...emTriagemProcessOptions,
          ]}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">
            Consultas agendadas
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Próximas primeiro, depois as já realizadas.
            {totalPages > 1 ? ` Página ${page} de ${totalPages}.` : ""}
          </p>
        </div>
        {reloading && appointments.length === 0 ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2" aria-hidden="true">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : (
          <>
            <AppointmentTable
              appointments={appointments}
              professionalNames={professionalNames}
              showFrida={false}
              onEdit={(appointment) => setEditing(appointment)}
            />
            <Pagination page={page} totalPages={totalPages} />
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
        processOptions={schedulableProcesses}
        triageProcessOptions={triageProcessOptions}
        professionals={professionals}
        calendarAppointments={calendarAppointments}
        gestor={gestor}
        initialProcessoId={initialProcessId}
        initialProcessOption={initialProcessOption}
        initialTipo={triageToSchedule ? "TRIAGEM" : undefined}
        onClose={() => setFormOpen(false)}
        showToast={showToast}
      />
      <Toast toast={toast} />
    </section>
  );
}
