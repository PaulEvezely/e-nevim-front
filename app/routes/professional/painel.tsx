import { useEffect, useRef } from "react";
import { Link, useRevalidator } from "react-router";
import type { Route } from "./+types/painel";
import { requireUser } from "../../../features/auth/require-user.server";
import { appointmentApi } from "../../../features/manager/appointmentApi.server";
import {
  attachProcessInfo,
  buildProcessMap,
  formatDate,
  formatTime,
  getProfessionalTypeLabel,
  sortAppointments,
  type ManagerAppointmentItem,
} from "../../../features/manager/appointmentUtils";
import { shortId } from "../../../features/manager/managerUtils";
import { getProcessFrida } from "../../../features/professional/frida/fridaApi.server";
import { getProfessionalHeaderLabel } from "../../../features/professional/professionalLabels";
import { AppointmentStatusBadge } from "../../../features/manager/components/AppointmentTable";
import { SkeletonCard } from "../../../shared/components/LoadingOverlay";
import { useNotificationContext } from "../../../features/notifications/NotificationProvider";

type ProfessionalPainelData = {
  userName: string;
  /** false para assistente social / assessor jurídico (sem FRIDA). */
  isPsicologo: boolean;
  /** psicólogo ou assistente social (podem escrever FRIDA). */
  isFridaWriter: boolean;
  /** Rótulo do papel (PSICÓLOGO / ASSISTENTE SOCIAL / ASSESSOR JURÍDICO). */
  papel: string;
  todayLabel: string;
  counts: {
    today: number;
    awaitingConfirmation: number;
    overdue: number;
    fridaPendente: number;
    onlineToday: number;
  };
  next: ManagerAppointmentItem | null;
  todayList: ManagerAppointmentItem[];
  loadError: string | null;
};

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, ["professional"]);
  try {
    const [appointments, processes] = await Promise.all([
      appointmentApi.listAppointments(request),
      appointmentApi.listProcessOptions(request).catch(() => []),
    ]);
    const enriched = sortAppointments(
      attachProcessInfo(appointments, buildProcessMap(processes)),
    );
    const nowIso = new Date().toISOString();
    const todayKey = formatDate(nowIso);
    const todayList = enriched.filter(
      (appointment) => formatDate(appointment.dataHora) === todayKey,
    );
    const awaitingConfirmation = enriched.filter(
      (appointment) =>
        appointment.status === "AGENDADA" &&
        appointment.confirmacaoProfissional !== "CONFIRMADO",
    ).length;
    const overdue = enriched.filter(
      (appointment) =>
        appointment.status === "AGENDADA" && appointment.dataHora < nowIso,
    ).length;
    const next =
      enriched.find(
        (appointment) =>
          appointment.status === "AGENDADA" && appointment.dataHora >= nowIso,
      ) ?? null;
    const onlineToday = todayList.filter(
      (appointment) => appointment.modalidade === "ONLINE",
    ).length;

    // FRIDA pendente (mockup 01): psicologia AGENDADA sem FRIDA no processo.
    // Assistente social conta triagem designada (TRIAGEM AGENDADA sem FRIDA).
    const fridaTargets = [
      ...new Set(
        enriched
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
    const withoutFrida = new Set(
      fridaResults
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<{
            processoId: string;
            hasFrida: boolean;
          }> =>
            result.status === "fulfilled" && !result.value.hasFrida,
        )
        .map((result) => result.value.processoId),
    );
    const fridaPendente = enriched.filter(
      (appointment) =>
        appointment.status === "AGENDADA" &&
        (appointment.tipoProfissional === "PSICOLOGO" ||
          appointment.tipoProfissional === "TRIAGEM") &&
        withoutFrida.has(appointment.processoId),
    ).length;

    return {
      userName: user.name,
      isPsicologo: user.speciality === "psicologo",
      isFridaWriter:
        user.speciality === "psicologo" ||
        user.speciality === "assistente_social",
      papel: getProfessionalHeaderLabel(user.speciality),
      todayLabel: new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      counts: {
        today: todayList.length,
        awaitingConfirmation,
        overdue,
        fridaPendente,
        onlineToday,
      },
      next,
      todayList: todayList.slice(0, 5),
      loadError: null,
    } satisfies ProfessionalPainelData;
  } catch {
    return {
      userName: user.name,
      isPsicologo: user.speciality === "psicologo",
      isFridaWriter:
        user.speciality === "psicologo" ||
        user.speciality === "assistente_social",
      papel: getProfessionalHeaderLabel(user.speciality),
      todayLabel: new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      counts: {
        today: 0,
        awaitingConfirmation: 0,
        overdue: 0,
        fridaPendente: 0,
        onlineToday: 0,
      },
      next: null,
      todayList: [],
      loadError:
        "Não foi possível carregar seu resumo. Tente novamente em instantes.",
    } satisfies ProfessionalPainelData;
  }
}

export default function ProfessionalPanel({ loaderData }: Route.ComponentProps) {
  const {
    userName,
    isPsicologo: _isPsicologo,
    isFridaWriter,
    papel,
    todayLabel,
    counts,
    next,
    todayList,
    loadError,
  } = loaderData;
  void _isPsicologo;
  const revalidator = useRevalidator();
  const { notifications } = useNotificationContext();
  const lastConsultId = useRef<string | null>(null);

  // Reaproveita o poll do sino (60s): quando chega CONSULTA_* relevante, o painel revalida.
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

  return (
    <section className="mx-auto max-w-4xl p-4 lg:p-6" aria-label="Painel do profissional">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            Bem-vindo, {firstName(userName)}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {papel} · {todayLabel}
          </p>
        </div>
        <Link
          to="/professional/appointments"
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:border-[#378ADD] hover:text-[#0C447C]"
        >
          Minha agenda
        </Link>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]"
        >
          {loadError}
        </div>
      ) : null}

      <div
        className={`mt-4 grid gap-3 sm:grid-cols-2 ${
          isFridaWriter ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        <Link
          to="/professional/appointments"
          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-[#378ADD]"
        >
          <p className="text-2xl font-bold text-[#0C447C]">{counts.today}</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-700">
            Atendimentos hoje
          </p>
          <p className="text-[11px] text-gray-500">
            {counts.onlineToday} online · {counts.today - counts.onlineToday}{" "}
            presencial
          </p>
        </Link>
        <Link
          to="/professional/appointments?status=AGENDADA"
          className="rounded-2xl border border-[#FAEEDA] bg-[#FAEEDA]/40 p-4 shadow-sm transition hover:border-[#854F0B]"
        >
          <p className="text-2xl font-bold text-[#854F0B]">
            {counts.awaitingConfirmation}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-gray-700">
            Aguardando sua confirmação
          </p>
          <p className="text-[11px] text-gray-500">
            toque para confirmar presença
          </p>
        </Link>
        <Link
          to="/professional/appointments?status=AGENDADA"
          className="rounded-2xl border border-[#FCEBEB] bg-[#FCEBEB]/60 p-4 shadow-sm transition hover:border-[#791F1F]"
        >
          <p className="text-2xl font-bold text-[#791F1F]">{counts.overdue}</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-700">
            Resultado a registrar
          </p>
          <p className="text-[11px] text-gray-500">
            consultas agendadas em atraso
          </p>
        </Link>
        {isFridaWriter ? (
          <Link
            to="/professional/appointments?status=AGENDADA"
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-[#378ADD]"
          >
            <p className="text-2xl font-bold text-gray-800">
              {counts.fridaPendente}{" "}
              <span className="text-sm font-medium text-gray-500">FRIDA</span>
            </p>
            <p className="mt-0.5 text-xs font-semibold text-gray-700">
              FRIDA pendente
            </p>
            <p className="text-[11px] text-gray-500">
              bloqueia “marcar como realizada”
            </p>
          </Link>
        ) : null}
      </div>

      {next ? (
        <section
          aria-label="Próximo atendimento"
          className="mt-4 overflow-hidden rounded-2xl border border-[#0C447C]/20 bg-white shadow-sm"
        >
          <div className="border-b border-stone-200 bg-[#E6F1FB]/60 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-[#0C447C]">
              Próximo atendimento · {formatDate(next.dataHora)} às{" "}
              {formatTime(next.dataHora)}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-gray-800">
                {next.vitimaNome?.trim() || "Vítima não identificada"}{" "}
                <span className="font-normal text-gray-500">
                  · {next.vitimaCampus?.trim() || "Campus a confirmar"}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {getProfessionalTypeLabel(next.tipoProfissional)} · Processo{" "}
                <span className="font-mono" title={next.processoId}>
                  {shortId(next.processoId)}
                </span>
              </p>
              <div className="mt-1.5">
                <AppointmentStatusBadge status={next.status} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {next.linkMeet ? (
                <a
                  href={next.linkMeet}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#0C447C] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#061f3a]"
                >
                  Entrar na sala
                </a>
              ) : null}
              <Link
                to={`/professional/appointments/${next.id}`}
                className="rounded-lg bg-[#378ADD] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0C447C]"
              >
                Ver detalhes
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <section
          aria-label="Atendimentos de hoje"
          className="rounded-2xl border border-stone-200 bg-white shadow-sm lg:col-span-3"
        >
          <div className="border-b border-stone-200 bg-stone-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Hoje · {counts.today}{" "}
              {counts.today === 1 ? "atendimento" : "atendimentos"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Em ordem de horário. Toque para abrir a consulta.
            </p>
          </div>
          {todayList.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Nenhum atendimento hoje. Aproveite para revisar os próximos.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {todayList.map((appointment) => (
                <li key={appointment.id}>
                  <Link
                    to={`/professional/appointments/${appointment.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50"
                  >
                    <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold text-gray-800">
                      {formatTime(appointment.dataHora)}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`h-8 w-1 shrink-0 rounded-full ${
                        appointment.status === "REALIZADA"
                          ? "bg-[#27500A]"
                          : appointment.status === "AGENDADA"
                            ? "bg-[#0C447C]"
                            : "bg-gray-300"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-800">
                        {appointment.vitimaNome?.trim() ||
                          "Vítima não identificada"}
                      </span>
                      <span className="block text-[11px] text-gray-500">
                        {getProfessionalTypeLabel(
                          appointment.tipoProfissional,
                        )}{" "}
                        ·{" "}
                        {appointment.modalidade === "ONLINE"
                          ? "Online"
                          : "Presencial"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[#0C447C]">
                      Detalhes →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-label="Pendências"
          className="rounded-2xl border border-stone-200 bg-white shadow-sm lg:col-span-2"
        >
          <div className="border-b border-stone-200 bg-stone-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Pendências</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              O que trava seu fluxo hoje.
            </p>
          </div>
          <ul className="space-y-2 p-4 text-sm">
            {counts.fridaPendente > 0 ? (
              <li className="flex items-start gap-2 rounded-xl border border-[#FAEEDA] bg-[#FAEEDA]/50 p-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#854F0B]"
                />
                <span>
                  <strong>Preencher FRIDA</strong> em {counts.fridaPendente}{" "}
                  {counts.fridaPendente === 1 ? "consulta" : "consultas"}.
                  <span className="block text-xs text-gray-600">
                    Sem ele, “Realizada” fica bloqueada.
                  </span>
                </span>
              </li>
            ) : null}
            {counts.overdue > 0 ? (
              <li className="flex items-start gap-2 rounded-xl border border-[#FCEBEB] bg-[#FCEBEB]/50 p-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#791F1F]"
                />
                <span>
                  <strong>Registrar resultado</strong> de {counts.overdue}{" "}
                  {counts.overdue === 1 ? "consulta" : "consultas"} em atraso
                  (Realizada / Faltou).
                </span>
              </li>
            ) : null}
            {counts.awaitingConfirmation > 0 ? (
              <li className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-300"
                />
                <span>
                  <strong>{counts.awaitingConfirmation} confirmações
                  pendentes</strong> (sua presença nos próximos atendimentos).
                </span>
              </li>
            ) : null}
            {counts.fridaPendente === 0 &&
            counts.overdue === 0 &&
            counts.awaitingConfirmation === 0 ? (
              <li className="rounded-xl border border-[#EAF3DE] bg-[#EAF3DE]/50 p-3 text-sm text-[#27500A]">
                Tudo em dia. Nenhuma pendência no momento.
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      {todayList.length === 5 && counts.today > 5 ? (
        <p className="mt-3 text-center text-xs text-gray-500">
          Mostrando 5 de {counts.today}.{" "}
          <Link
            to="/professional/appointments"
            className="font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
          >
            Ver agenda completa
          </Link>
        </p>
      ) : null}
    </section>
  );
}
