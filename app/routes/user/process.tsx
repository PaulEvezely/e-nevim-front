import { useEffect, useRef } from "react";
import { Link, useRevalidator } from "react-router";
import { useNotificationContext } from "../../../features/notifications/NotificationProvider";
import type { Route } from "./+types/process";
import { requireUser } from "../../../features/auth/require-user.server";
import { consultasApi } from "../../../features/user/consultasApi.server";
import {
  listMyDemands,
  type MyDemand,
} from "../../../features/user/demandsApi.server";
import {
  getTypeLabel,
  type MyAppointment,
} from "../../../features/user/consultasUtils";
import {
  getVictimJourneySteps,
  type JourneyStepState,
} from "../../../features/user/victimJourney";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { formatDate } from "../../../shared/utils/date";

type VictimProcessLoaderData =
  | {
      demand: MyDemand;
      appointments: MyAppointment[];
      loadError: null;
    }
  | {
      demand: null;
      appointments: MyAppointment[];
      loadError: string | null;
    };

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["user"]);
  try {
    const [demands, appointments] = await Promise.all([
      listMyDemands(request).catch(() => null),
      consultasApi.listMine(request).catch(() => []),
    ]);
    if (demands === null) {
      return {
        demand: null,
        appointments: [],
        loadError:
          "Não foi possível carregar seu processo. Tente novamente em instantes.",
      } satisfies VictimProcessLoaderData;
    }
    const sorted = [...demands].sort((a, b) =>
      b.criadoEm.localeCompare(a.criadoEm),
    );
    return {
      demand: sorted[0] ?? null,
      appointments,
      loadError: null,
    } satisfies VictimProcessLoaderData;
  } catch {
    return {
      demand: null,
      appointments: [],
      loadError:
        "Não foi possível carregar seu processo. Tente novamente em instantes.",
    } satisfies VictimProcessLoaderData;
  }
}

function stepsFor(
  demand: MyDemand,
  appointments: MyAppointment[],
): { label: string; hint: string; state: JourneyStepState }[] {
  const triagemDone = [...appointments]
    .filter(
      (appointment) =>
        appointment.tipoProfissional === "TRIAGEM" &&
        appointment.status === "REALIZADA",
    )
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora))[0];
  const hints: Record<string, string> = {
    registrada: `Você registrou sua demanda no NEVIM. · ${formatDate(demand.criadoEm)}`,
    analise:
      demand.status === "APROVADA"
        ? "Sua demanda foi analisada e aprovada."
        : "Sua demanda está sendo analisada pela equipe.",
    analisada:
      "Sua demanda não pôde ser aceita. Procure o NEVIM para conversar sobre o seu caso.",
    triagem: triagemDone
      ? `Primeira conversa realizada em ${formatDate(triagemDone.dataHora)}.`
      : "Primeira conversa para entender a situação e avaliar o risco.",
    acompanhamento:
      "Atendimentos com psicologia, assistência social ou jurídico, conforme o seu caso.",
  };
  return getVictimJourneySteps(demand.status).map((step) => ({
    label: step.label,
    hint: hints[step.key] ?? "",
    state: step.state,
  }));
}

type HistoryEvent = { label: string; detail: string; date: string };

function buildHistory(
  demand: MyDemand,
  appointments: MyAppointment[],
): HistoryEvent[] {
  const events: HistoryEvent[] = [
    {
      label: "Demanda registrada",
      detail: "Você registrou sua demanda no NEVIM.",
      date: demand.criadoEm,
    },
  ];
  const byDate = [...appointments].sort((a, b) =>
    a.dataHora.localeCompare(b.dataHora),
  );
  const triagemDone = byDate.find(
    (appointment) =>
      appointment.tipoProfissional === "TRIAGEM" &&
      appointment.status === "REALIZADA",
  );
  if (triagemDone) {
    events.push({
      label: "Triagem realizada",
      detail: "Primeira conversa com a equipe do NEVIM.",
      date: triagemDone.dataHora,
    });
  }
  const followUp = byDate.find(
    (appointment) => appointment.tipoProfissional !== "TRIAGEM",
  );
  if (followUp) {
    const typeLabel = getTypeLabel(followUp.tipoProfissional);
    events.push({
      label:
        followUp.status === "AGENDADA"
          ? "Consulta de acompanhamento agendada"
          : "Acompanhamento iniciado",
      detail: `Primeira consulta de ${typeLabel.toLowerCase()}.`,
      date: followUp.dataHora,
    });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function StepDot({ state }: { state: JourneyStepState }) {
  return (
    <span
      aria-hidden="true"
      className={
        state === "done"
          ? "mt-1 h-3 w-3 shrink-0 rounded-full bg-[#27500A]"
          : state === "current"
            ? "mt-1 h-3 w-3 shrink-0 rounded-full bg-[#378ADD] ring-4 ring-[#378ADD]/20"
            : "mt-1 h-3 w-3 shrink-0 rounded-full bg-stone-300"
      }
    />
  );
}

export default function VictimProcess({ loaderData }: Route.ComponentProps) {
  const { demand, appointments, loadError } = loaderData;
  const revalidator = useRevalidator();
  const { notifications } = useNotificationContext();
  const lastProcessId = useRef<string | null>(null);
  const reloading = revalidator.state !== "idle";

  // Revalida quando chega cancelamento/encerramento ou link da sala.
  useEffect(() => {
    const RELEV = new Set([
      "CONSULTA_AGENDADA",
      "CONSULTA_CANCELADA",
      "LINK_MEET_DISPONIVEL",
      "PROCESSO_ENCERRADO",
    ]);
    const newest = notifications.find((n) => RELEV.has(n.tipo));
    if (!newest) return;
    if (lastProcessId.current === null) {
      lastProcessId.current = newest.id;
      return;
    }
    if (newest.id !== lastProcessId.current) {
      lastProcessId.current = newest.id;
      if (revalidator.state === "idle" && document.visibilityState === "visible") {
        revalidator.revalidate();
      }
    }
  }, [notifications, revalidator]);

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
  const appointmentCount = appointments.length;
  const isEncerrado = (demand?.processo?.status ?? "").toUpperCase() === "ENCERRADO";
  const baseSteps = demand ? stepsFor(demand, appointments) : [];
  const steps: { label: string; hint: string; state: JourneyStepState }[] = isEncerrado
    ? baseSteps.map((step) => ({ ...step, state: "done" as const }))
    : baseSteps;
  const history = demand ? buildHistory(demand, appointments) : [];

  return (
    <section className="mx-auto max-w-3xl p-4 lg:p-6" aria-label="Meu processo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800">Meu processo</h1>
        {demand ? (
          <StatusBadge
            status={
              isEncerrado
                ? "Encerrado"
                : demand.status === "REJEITADA"
                  ? "Encerrado"
                  : demand.status === "APROVADA"
                    ? "Ativo"
                    : "Pendente"
            }
          />
        ) : null}
      </div>

      {demand && isEncerrado ? (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-gray-700"
        >
          <p className="font-semibold">Processo encerrado.</p>
          <p className="mt-0.5 text-sm text-gray-600">
            Seu atendimento foi concluído. Procure o NEVIM se precisar de novo.
          </p>
        </div>
      ) : null}

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

      {!loadError && !demand ? (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-800">
            Nenhum processo encontrado.
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Se você já registrou uma demanda, aguarde a análise do NEVIM.
          </p>
        </div>
      ) : null}

      {demand ? (
        <div className="mt-4 space-y-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm lg:p-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Sua demanda</h2>
            <dl className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Tipo de violência
                </dt>
                <dd className="mt-0.5 break-words text-sm text-gray-800">
                  {demand.tipoViolencia?.trim() || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Registrada em
                </dt>
                <dd className="mt-0.5 text-sm text-gray-800">
                  {formatDate(demand.criadoEm)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Consultas agendadas
                </dt>
                <dd className="mt-0.5 text-sm text-gray-800">
                  {appointmentCount === 0
                    ? "Nenhuma por enquanto"
                    : `${appointmentCount} ${appointmentCount === 1 ? "consulta" : "consultas"}`}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border-t border-stone-200 pt-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Etapas do atendimento
            </h2>
            <ol className="mt-3 space-y-3">
              {steps.map((step) => (
                <li key={step.label} className="flex items-start gap-3">
                  <StepDot state={step.state} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-600">{step.hint}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {history.length > 1 ? (
            <div className="border-t border-stone-200 pt-4">
              <h2 className="text-sm font-semibold text-gray-800">
                O que já aconteceu
              </h2>
              <ol className="mt-2 space-y-2">
                {history.map((event, index) => (
                  <li
                    key={`${event.label}-${event.date}-${index}`}
                    className="flex flex-wrap items-baseline gap-x-2 text-sm"
                  >
                    <span className="font-semibold text-gray-800">
                      {event.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(event.date)} · {event.detail}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="border-t border-stone-200 pt-4">
            <Link
              to="/user/consultas"
              className="inline-block rounded-lg bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-[#0C447C]"
            >
              Ver minhas consultas
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
