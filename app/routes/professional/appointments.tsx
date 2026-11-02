import { useEffect, useRef, useState } from "react";
import {
  data,
  useFetcher,
  useNavigate,
  useRevalidator,
} from "react-router";
import type { Route } from "./+types/appointments";
import { requireUser } from "../../../features/auth/require-user.server";
import { appointmentApi } from "../../../features/manager/appointmentApi.server";
import {
  attachProcessInfo,
  buildProcessMap,
  getAppointmentStatusLabel,
  sortAppointments,
  toUpdateAppointmentInput,
  validateAppointmentDetails,
  type AppointmentDetailsFormData,
  type AppointmentStatus,
  type ManagerAppointmentItem,
} from "../../../features/manager/appointmentUtils";
import { formatDate } from "../../../shared/utils/date";
import {
  countByStatus,
  EMPTY_STATUS_COUNTS,
  filterByStatus,
  parseProfessionalStatusFilter,
  type AppointmentStatusFilter,
  type ProfessionalActionData,
  type ProfessionalAppointment,
} from "../../../features/professional/consultasUtils";
import { ProfessionalStatusFilter } from "../../../features/professional/components/ProfessionalStatusFilter";
import { ProfessionalAppointmentCard } from "../../../features/professional/components/ProfessionalAppointmentCard";
import { AppointmentEditForm } from "../../../features/manager/components/AppointmentEditForm";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { SkeletonCard } from "../../../shared/components/LoadingOverlay";
import { Toast } from "../../../shared/components/Toast";
import { useToast } from "../../../shared/hooks/useToast";
import { ApiError } from "../../../libs/api.server";
import { getProcessFrida } from "../../../features/professional/frida/fridaApi.server";
import { useNotificationContext } from "../../../features/notifications/NotificationProvider";

type AppointmentsLoaderData = {
  appointments: ProfessionalAppointment[];
  counts: Record<AppointmentStatusFilter, number>;
  status: AppointmentStatusFilter;
  /** processoId -> FRIDA existente (exige FRIDA antes de REALIZADA). */
  fridaPorProcesso: Record<string, boolean>;
  fridaCheckFailed: boolean;
  loadError: string | null;
};

type StatusTransition = Exclude<AppointmentStatus, "AGENDADA">;
type ResultStatus = StatusTransition;

const STATUS_TRANSITIONS: StatusTransition[] = [
  "REALIZADA",
  "CANCELADA",
  "FALTOU",
];

function mapBackendFieldErrors(
  backendFields: Record<string, string[]>,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const key of ["linkMeet", "modalidade", "observacoes"]) {
    const message = backendFields[key]?.[0];
    if (message) fieldErrors[key] = message;
  }
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
  const fieldErrors =
    includeFields && err instanceof ApiError
      ? mapBackendFieldErrors(err.fieldErrors)
      : {};
  if (Object.keys(fieldErrors).length > 0) {
    return data<ProfessionalActionData>(
      { error: "Corrija os campos destacados antes de enviar.", fieldErrors },
      { status: safeStatus },
    );
  }
  return data<ProfessionalActionData>(
    { error: message },
    { status: safeStatus },
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["professional"]);
  const url = new URL(request.url);
  const status = parseProfessionalStatusFilter(url.searchParams);

  try {
    const [appointments, processes] = await Promise.all([
      appointmentApi.listAppointments(request),
      appointmentApi.listProcessOptions(request).catch(() => []),
    ]);
    const enriched = attachProcessInfo(appointments, buildProcessMap(processes));
    const filtered = sortAppointments(filterByStatus(enriched, status));
    // FRIDA por processo (AGENDADA de psicologia ou triagem designada):
    // exige FRIDA antes de marcar REALIZADA.
    const fridaTargets = [
      ...new Set(
        filtered
          .filter(
            (appointment) =>
              appointment.status === "AGENDADA" &&
              (appointment.tipoProfissional === "PSICOLOGO" ||
                appointment.tipoProfissional === "TRIAGEM"),
          )
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
      appointments: filtered,
      counts: countByStatus(enriched),
      status,
      fridaPorProcesso,
      fridaCheckFailed,
      loadError: null,
    } satisfies AppointmentsLoaderData;
  } catch {
    return {
      appointments: [],
      counts: EMPTY_STATUS_COUNTS,
      status,
      fridaPorProcesso: {} as Record<string, boolean>,
      fridaCheckFailed: false,
      loadError:
        "Não foi possível carregar sua agenda. Tente novamente em instantes.",
    } satisfies AppointmentsLoaderData;
  }
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request, ["professional"]);
  const form = await request.formData().catch(() => null);
  if (!form) {
    return data<ProfessionalActionData>(
      { error: "Não foi possível concluir a ação." },
      { status: 400 },
    );
  }

  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "");
  if (!id) {
    return data<ProfessionalActionData>(
      { error: "Consulta inválida." },
      { status: 400 },
    );
  }

  if (intent === "editar") {
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
      return data<ProfessionalActionData>(
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
      return data<ProfessionalActionData>({ ok: true, action: "editar", id });
    } catch (err) {
      return actionError(
        err,
        "Não foi possível atualizar a consulta. Tente novamente em instantes.",
        true,
      );
    }
  }

  if (intent === "status") {
    const status = String(form.get("status") ?? "") as StatusTransition;
    if (!STATUS_TRANSITIONS.includes(status)) {
      return data<ProfessionalActionData>(
        { error: "Status inválido." },
        { status: 400 },
      );
    }
    // REALIZADA em psicologia ou triagem (própria/designada) exige FRIDA.
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
        return actionError(
          err,
          "Não foi possível verificar o FRIDA. Tente novamente em instantes.",
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
      return actionError(
        err,
        "Não foi possível atualizar o status da consulta. Tente novamente em instantes.",
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
      return actionError(
        err,
        "Não foi possível confirmar a consulta. Tente novamente em instantes.",
      );
    }
  }

  return data<ProfessionalActionData>(
    { error: "Ação inválida." },
    { status: 400 },
  );
}

export default function ProfessionalAppointments({
  loaderData,
}: Route.ComponentProps) {
  const { appointments, counts, status, fridaPorProcesso, fridaCheckFailed, loadError } =
    loaderData;
  const revalidator = useRevalidator();
  const reloading = revalidator.state !== "idle";
  const { notifications } = useNotificationContext();
  const lastConsultId = useRef<string | null>(null);

  // Reaproveita o poll do sino (60s): quando chega CONSULTA_* relevante, a agenda revalida.
  useEffect(() => {
    const RELEV = new Set([
      "CONSULTA_AGENDADA",
      "CONSULTA_CANCELADA",
      "CONSULTA_REALIZADA",
      "CONSULTA_FALTA",
      "LINK_MEET_DISPONIVEL",
      "CONSULTA_CONFIRMADA_PARCIAL",
      "PROCESSO_ENCAMINHADO",
      "PROCESSO_ENCERRADO",
    ]);
    const newest = notifications.find((n) => RELEV.has(n.tipo));
    if (!newest) return;
    if (lastConsultId.current === null) {
      lastConsultId.current = newest.id;
      return;
    }
    if (newest.id !== lastConsultId.current) {
      lastConsultId.current = newest.id;
      if (revalidator.state === "idle" && document.visibilityState === "visible") {
        revalidator.revalidate();
      }
    }
  }, [notifications, revalidator]);

  // Garante ao voltar de aba/foco, mesmo sem notificação nova.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && revalidator.state === "idle") {
        revalidator.revalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [revalidator]);

  const fetcher = useFetcher<ProfessionalActionData>();
  const busy = fetcher.state !== "idle";
  const busyId = busy ? String(fetcher.formData?.get("id") ?? "") : null;
  const [editing, setEditing] = useState<ManagerAppointmentItem | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{
    appointment: ManagerAppointmentItem;
    status: ResultStatus;
  } | null>(null);
  const [fridaPendente, setFridaPendente] =
    useState<ManagerAppointmentItem | null>(null);
  // Busca por nome da vítima (mockup 02): filtro local sobre a página.
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const normalizedQuery = query.trim().toLowerCase();
  const searched =
    normalizedQuery.length === 0
      ? appointments
      : appointments.filter((appointment) =>
          (appointment.vitimaNome ?? "")
            .toLowerCase()
            .includes(normalizedQuery),
        );

  // Agrupamento da agenda (mockup 02) quando sem filtro de status nem busca.
  const grouped = status === "ALL" && normalizedQuery.length === 0;
  const todayKey = formatDate(new Date().toISOString());
  const today: ManagerAppointmentItem[] = [];
  const overdue: ManagerAppointmentItem[] = [];
  const upcoming: ManagerAppointmentItem[] = [];
  const done: ManagerAppointmentItem[] = [];
  if (grouped) {
    for (const appointment of searched) {
      if (appointment.status !== "AGENDADA") {
        done.push(appointment);
        continue;
      }
      const key = formatDate(appointment.dataHora);
      if (key === todayKey) today.push(appointment);
      else if (appointment.dataHora < new Date().toISOString())
        overdue.push(appointment);
      else upcoming.push(appointment);
    }
  }

  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok) {
      if (result.action === "confirmar") {
        showToast("Presença confirmada.", "success");
      } else if (result.action === "status" && result.status) {
        showToast(
          `Consulta marcada como ${getAppointmentStatusLabel(
            result.status,
          ).toLowerCase()}.`,
          "success",
        );
      }
      setPendingStatus(null);
      revalidator.revalidate();
    } else if ("error" in result && result.error) {
      showToast(result.error, "error");
      setPendingStatus(null);
      revalidator.revalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  function handleConfirm(appointment: ManagerAppointmentItem) {
    fetcher.submit(
      { intent: "confirmar", id: appointment.id },
      { method: "post" },
    );
  }

  function handleOpenStatus(
    appointment: ManagerAppointmentItem,
    next: ResultStatus,
  ) {
    // Sem FRIDA: abre o modal orientativo em vez da confirmação
    // (a action valida de novo como rede de segurança).
    if (
      next === "REALIZADA" &&
      appointment.status === "AGENDADA" &&
      (appointment.tipoProfissional === "PSICOLOGO" ||
        appointment.tipoProfissional === "TRIAGEM") &&
      fridaPorProcesso[appointment.processoId] === false
    ) {
      setFridaPendente(appointment);
      return;
    }
    setPendingStatus({ appointment, status: next });
  }

  function handleConfirmStatus() {
    if (!pendingStatus) return;
    fetcher.submit(
      {
        intent: "status",
        id: pendingStatus.appointment.id,
        status: pendingStatus.status,
      },
      { method: "post" },
    );
  }

  const emptyMessage =
    normalizedQuery.length > 0
      ? `Nenhuma consulta encontrada para “${query.trim()}”.`
      : status === "ALL"
        ? "Nenhuma consulta na sua agenda."
        : "Nenhuma consulta com este status.";

  function renderAppointmentList(items: ManagerAppointmentItem[]) {
    return (
      <ul className="mt-4 space-y-3">
        {items.map((appointment) => (
          <ProfessionalAppointmentCard
            key={appointment.id}
            appointment={appointment}
            busy={busy && (!busyId || busyId === appointment.id)}
            onConfirm={handleConfirm}
            onEdit={(item) => setEditing(item)}
            onStatus={handleOpenStatus}
            hasFrida={fridaPorProcesso[appointment.processoId] ?? null}
            fridaHref={
              (appointment.tipoProfissional === "PSICOLOGO" ||
                appointment.tipoProfissional === "TRIAGEM") &&
              (appointment.status === "AGENDADA" ||
                appointment.status === "REALIZADA")
                ? `/professional/frida/${appointment.id}`
                : null
            }
          />
        ))}
      </ul>
    );
  }

  return (
    <section
      className="mx-auto max-w-4xl p-4 lg:p-6"
      aria-label="Minha agenda"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            Minha agenda
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Acompanhe seus atendimentos, confirme presença e registre o
            resultado de cada consulta.
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {counts.ALL === 0
              ? "Nenhuma consulta atribuída a você até o momento."
              : `${appointments.length} de ${counts.ALL} consultas exibidas.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => revalidator.revalidate()}
          disabled={reloading}
          className="text-xs font-semibold text-[#0C447C] underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
        >
          {reloading ? "Atualizando…" : "Atualizar"}
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

      {fridaCheckFailed && !loadError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-[#FAEEDA] bg-[#FAEEDA]/40 px-4 py-3 text-sm text-[#854F0B]"
        >
          Não foi possível verificar quais consultas já têm FRIDA. A conclusão
          como realizada em psicologia será validada ao confirmar.
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-sm">
        <ProfessionalStatusFilter status={status} counts={counts} />
        <label className="mt-2 block">
          <span className="sr-only">Buscar por nome da vítima</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome da vítima…"
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30"
          />
        </label>
      </div>

      {reloading && appointments.length === 0 ? (
        <div className="mt-4 grid gap-3" aria-hidden="true">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : searched.length === 0 && !loadError ? (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
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
            Novos agendamentos feitos pelo gestor aparecerão aqui.
          </p>
        </div>
      ) : grouped ? (
        <div>
          {overdue.length > 0 ? (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold text-[#791F1F]">
                Em atraso · {overdue.length} aguardando registro
              </h2>
              {renderAppointmentList(overdue)}
            </>
          ) : null}
          <h2 className="mb-2 mt-6 text-sm font-semibold text-gray-800">
            Hoje · {today.length}{" "}
            {today.length === 1 ? "atendimento" : "atendimentos"}
          </h2>
          {today.length > 0 ? (
            renderAppointmentList(today)
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              Nenhum atendimento hoje. Aproveite para revisar os próximos.
            </p>
          )}
          {upcoming.length > 0 ? (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold text-gray-800">
                Próximos atendimentos · {upcoming.length}
              </h2>
              {renderAppointmentList(upcoming)}
            </>
          ) : null}
          {done.length > 0 ? (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold text-gray-800">
                Concluídas · {done.length}
              </h2>
              {renderAppointmentList(done)}
            </>
          ) : null}
        </div>
      ) : (
        renderAppointmentList(searched)
      )}

      {editing ? (
        <AppointmentEditForm
          appointment={editing}
          onClose={() => setEditing(null)}
          showToast={showToast}
        />
      ) : null}

      <ConfirmModal
        open={pendingStatus !== null}
        title="Registrar resultado da consulta?"
        description={
          pendingStatus
            ? `A consulta de ${
                pendingStatus.appointment.vitimaNome?.trim() || "vítima"
              } será marcada como ${getAppointmentStatusLabel(
                pendingStatus.status,
              ).toLowerCase()}. Esta ação não pode ser desfeita.`
            : ""
        }
        consequences={
          pendingStatus?.status === "CANCELADA" &&
          pendingStatus.appointment.status === "REALIZADA"
            ? pendingStatus.appointment.tipoProfissional === "TRIAGEM"
              ? "A triagem será desfeita (processo volta para ABERTO). A vítima será notificada."
              : "O registro de realizada será desfeito (relatórios mantidos). A vítima será notificada."
            : pendingStatus?.status === "CANCELADA"
              ? "A vítima será notificada sobre o cancelamento."
              : undefined
        }
        confirmLabel={
          pendingStatus
            ? `Marcar como ${getAppointmentStatusLabel(pendingStatus.status)}`
            : "Confirmar"
        }
        cancelLabel="Voltar"
        loading={busy && busyId === pendingStatus?.appointment.id}
        onConfirm={handleConfirmStatus}
        onCancel={() => {
          if (!busy) setPendingStatus(null);
        }}
      />

      <ConfirmModal
        open={fridaPendente !== null}
        title="FRIDA pendente"
        description={
          fridaPendente
            ? `Preencha o formulário FRIDA de ${
                fridaPendente.vitimaNome?.trim() || "vítima"
              } antes de marcar a consulta como realizada. Ele pode ser preenchido com a consulta agendada.`
            : ""
        }
        confirmLabel="Preencher FRIDA"
        confirmVariant="primary"
        cancelLabel="Voltar"
        onConfirm={() => {
          if (!fridaPendente) return;
          const id = fridaPendente.id;
          setFridaPendente(null);
          navigate(`/professional/frida/${id}`);
        }}
        onCancel={() => setFridaPendente(null)}
      />

      <Toast toast={toast} />
    </section>
  );
}
