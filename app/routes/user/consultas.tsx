import { useEffect, useMemo, useRef, useState } from "react";
import { data, useFetcher, useRevalidator } from "react-router";
import type { Route } from "./+types/consultas";
import { requireUser } from "../../../features/auth/require-user.server";
import { consultasApi } from "../../../features/user/consultasApi.server";
import {
  validateRefusalReason,
  type ConsultaActionData,
  type MyAppointment,
} from "../../../features/user/consultasUtils";
import { ConsultationCard } from "../../../features/user/components/ConsultationCard";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { Toast } from "../../../shared/components/Toast";
import { useToast } from "../../../shared/hooks/useToast";
import { ApiError } from "../../../libs/api.server";
import { useNotificationContext } from "../../../features/notifications/NotificationProvider";

type ConsultasLoaderData = {
  appointments: MyAppointment[];
  loadError: string | null;
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["user"]);
  try {
    const appointments = await consultasApi.listMine(request);
    return {
      appointments,
      loadError: null,
    } satisfies ConsultasLoaderData;
  } catch {
    return {
      appointments: [],
      loadError:
        "Não foi possível carregar suas consultas. Tente novamente em instantes.",
    } satisfies ConsultasLoaderData;
  }
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request, ["user"]);
  const form = await request.formData().catch(() => null);
  if (!form) {
    return data<ConsultaActionData>(
      { error: "Não foi possível concluir a ação." },
      { status: 400 },
    );
  }

  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "");
  if (!id) {
    return data<ConsultaActionData>(
      { error: "Consulta inválida." },
      { status: 400 },
    );
  }

  try {
    if (intent === "confirmar") {
      await consultasApi.confirm(request, id);
      return data<ConsultaActionData>({
        ok: true,
        action: "confirmar",
        id,
      });
    }

    if (intent === "recusar") {
      const motivo = String(form.get("motivo") ?? "");
      const reasonError = validateRefusalReason(motivo);
      if (reasonError) {
        return data<ConsultaActionData>(
          { error: reasonError },
          { status: 400 },
        );
      }
      await consultasApi.refuse(request, id, motivo.trim() || null);
      return data<ConsultaActionData>({ ok: true, action: "recusar", id });
    }
  } catch (err) {
    const message =
      err instanceof ApiError && err.message
        ? err.message
        : "Não foi possível concluir a ação. Tente novamente em instantes.";
    const status = err instanceof ApiError ? err.status : 500;
    return data<ConsultaActionData>(
      { error: message },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }

  return data<ConsultaActionData>(
    { error: "Ação inválida." },
    { status: 400 },
  );
}

export default function VictimConsultas({
  loaderData,
}: Route.ComponentProps) {
  const { appointments, loadError } = loaderData;
  const revalidator = useRevalidator();
  const reloading = revalidator.state !== "idle";
  const { notifications } = useNotificationContext();
  const lastConsultId = useRef<string | null>(null);

  // Reaproveita o poll do sino (60s): quando chega AGENDADA/CANCELADA/LINK_MEET/ENCERRADO, a lista revalida.
  useEffect(() => {
    const RELEV = new Set([
      "CONSULTA_AGENDADA",
      "CONSULTA_CANCELADA",
      "LINK_MEET_DISPONIVEL",
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
  const fetcher = useFetcher<ConsultaActionData>();
  const fetcherBusy = fetcher.state !== "idle";
  const busyId = fetcherBusy
    ? String(fetcher.formData?.get("id") ?? "")
    : null;
  const [refusing, setRefusing] = useState<MyAppointment | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  type ConsultaFilter = "all" | "confirmar" | "proximas" | "anteriores";
  const [filter, setFilter] = useState<ConsultaFilter>("all");

  const awaiting = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.status === "AGENDADA" &&
          appointment.confirmacaoVitima !== "CONFIRMADO",
      ),
    [appointments],
  );
  const upcoming = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.status === "AGENDADA" &&
          appointment.confirmacaoVitima === "CONFIRMADO",
      ),
    [appointments],
  );
  const past = useMemo(
    () => appointments.filter((appointment) => appointment.status !== "AGENDADA"),
    [appointments],
  );

  const filterOptions: { value: ConsultaFilter; label: string; count: number }[] = [
    { value: "all", label: "Todas", count: appointments.length },
    { value: "confirmar", label: "A confirmar", count: awaiting.length },
    { value: "proximas", label: "Próximas", count: upcoming.length },
    { value: "anteriores", label: "Anteriores", count: past.length },
  ];

  const visibleAppointments =
    filter === "all"
      ? appointments
      : filter === "confirmar"
        ? awaiting
        : filter === "proximas"
          ? upcoming
          : past;

  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok) {
      showToast(
        result.action === "confirmar"
          ? "Presença confirmada. Obrigada!"
          : "Consulta recusada. O NEVIM foi avisado para reagendar.",
        "success",
      );
      setRefusing(null);
      setReason("");
      setReasonError(null);
      revalidator.revalidate();
    } else if ("error" in result && result.error) {
      showToast(result.error, "error");
      setRefusing(null);
      revalidator.revalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  function handleConfirm(appointment: MyAppointment) {
    fetcher.submit(
      { intent: "confirmar", id: appointment.id },
      { method: "post" },
    );
  }

  function handleOpenRefusal(appointment: MyAppointment) {
    setRefusing(appointment);
    setReason("");
    setReasonError(null);
  }

  function handleConfirmRefusal() {
    if (!refusing) return;
    const message = validateRefusalReason(reason);
    if (message) {
      setReasonError(message);
      return;
    }
    setReasonError(null);
    fetcher.submit(
      { intent: "recusar", id: refusing.id, motivo: reason.trim() },
      { method: "post" },
    );
  }

  return (
    <section
      className="mx-auto max-w-3xl p-4 lg:p-6"
      aria-label="Minhas consultas"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            Minhas consultas
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Confirme sua presença ou avise com antecedência caso não possa
            comparecer.
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

      {!loadError && appointments.length > 0 ? (
        <div
          className="mt-4 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filtrar consultas"
        >
          {filterOptions.map((option) => {
            const active = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "rounded-full bg-[#0C447C] px-3 py-1.5 text-xs font-semibold text-white shadow"
                    : "rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-stone-50"
                }
              >
                {option.label} · {option.count}
              </button>
            );
          })}
        </div>
      ) : null}

      {!loadError && appointments.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
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
            Nenhuma consulta agendada no momento.
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Quando o NEVIM agendar um atendimento, ele aparecerá aqui para você
            confirmar.
          </p>
        </div>
      ) : !loadError && visibleAppointments.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-800">
            Nenhuma consulta neste filtro.
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Escolha outro filtro acima para ver as demais consultas.
          </p>
        </div>
      ) : !loadError ? (
        <ul className="mt-4 space-y-3">
          {visibleAppointments.map((appointment) => (
            <ConsultationCard
              key={appointment.id}
              appointment={appointment}
              busy={fetcherBusy}
              onConfirm={handleConfirm}
              onRefuse={handleOpenRefusal}
            />
          ))}
        </ul>
      ) : null}

      <ConfirmModal
        open={refusing !== null}
        title="Não poderá comparecer?"
        description="Ao recusar, a consulta será cancelada e o NEVIM será avisado para reagendar o atendimento."
        confirmLabel="Recusar consulta"
        cancelLabel="Voltar"
        loading={fetcherBusy && busyId === refusing?.id}
        onConfirm={handleConfirmRefusal}
        onCancel={() => {
          if (!fetcherBusy) {
            setRefusing(null);
            setReason("");
            setReasonError(null);
          }
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Motivo (opcional)
          </span>
          <textarea
            value={reason}
            rows={3}
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value);
              if (reasonError) setReasonError(null);
            }}
            placeholder="Conte brevemente por que não poderá comparecer"
            className={
              reasonError
                ? "w-full rounded-xl border border-red-400 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                : "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30"
            }
            aria-invalid={Boolean(reasonError)}
            aria-describedby={reasonError ? "reason-error" : "reason-hint"}
          />
          {reasonError ? (
            <p id="reason-error" className="mt-1 text-xs text-red-700">
              {reasonError}
            </p>
          ) : (
            <p id="reason-hint" className="mt-1 text-xs text-gray-500">
              O motivo é visto apenas pela equipe do NEVIM.
            </p>
          )}
        </label>
      </ConfirmModal>

      <Toast toast={toast} />
    </section>
  );
}
