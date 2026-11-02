import { useEffect, useRef } from "react";
import { Link, useRevalidator } from "react-router";
import type { Route } from "./+types/painel";
import { requireUser } from "../../../features/auth/require-user.server";
import { consultasApi } from "../../../features/user/consultasApi.server";
import { listMyDemands } from "../../../features/user/demandsApi.server";
import type { MyDemand } from "../../../features/user/demandsApi.server";
import type { MyAppointment } from "../../../features/user/consultasUtils";
import {
  getAppointmentTime,
  getDayLabel,
  getTypeLabel,
} from "../../../features/user/consultasUtils";
import { getVictimJourneySteps } from "../../../features/user/victimJourney";
import { fetchNotificationsPage } from "../../../features/notifications/notificationsApi.server";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { SkeletonCard } from "../../../shared/components/LoadingOverlay";
import { useNotificationContext } from "../../../features/notifications/NotificationProvider";

type VictimPanelLoaderData =
  | {
      demand: MyDemand | null;
      nextAppointment: MyAppointment | null;
      unreadCount: number;
      loadError: null;
    }
  | {
      demand: null;
      nextAppointment: null;
      unreadCount: number;
      loadError: string;
    };

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["user"]);
  try {
    const [demands, appointments, notifications] = await Promise.all([
      listMyDemands(request).catch(() => null),
      consultasApi.listMine(request).catch(() => null),
      fetchNotificationsPage(request, { limit: 1 }).catch(() => null),
    ]);
    if (demands === null || appointments === null) {
      return {
        demand: null,
        nextAppointment: null,
        unreadCount: notifications?.naoLidas ?? 0,
        loadError:
          "Não foi possível carregar seu painel. Tente novamente em instantes.",
      } satisfies VictimPanelLoaderData;
    }
    const sorted = [...demands].sort((a, b) =>
      b.criadoEm.localeCompare(a.criadoEm),
    );
    return {
      demand: sorted[0] ?? null,
      nextAppointment: appointments[0] ?? null,
      unreadCount: notifications?.naoLidas ?? 0,
      loadError: null,
    } satisfies VictimPanelLoaderData;
  } catch {
    return {
      demand: null,
      nextAppointment: null,
      unreadCount: 0,
      loadError:
        "Não foi possível carregar seu painel. Tente novamente em instantes.",
    } satisfies VictimPanelLoaderData;
  }
}

function demandBadge(status: MyDemand["status"]): "Pendente" | "Ativo" | "Encerrado" {
  if (status === "PENDENTE") return "Pendente";
  if (status === "APROVADA") return "Ativo";
  return "Encerrado";
}

function demandMessage(status: MyDemand["status"]): string {
  if (status === "PENDENTE") {
    return "Sua demanda está em análise pelo NEVIM. Aguarde o contato da equipe.";
  }
  if (status === "APROVADA") {
    return "Sua demanda foi aprovada. O NEVIM está organizando seu atendimento.";
  }
  return "Sua demanda não pôde ser aceita. Procure o NEVIM para conversar sobre o seu caso.";
}

export default function VictimPanel({ loaderData }: Route.ComponentProps) {
  const { demand, nextAppointment, unreadCount, loadError } = loaderData;
  const isEncerrado = (demand?.processo?.status ?? "").toUpperCase() === "ENCERRADO";
  const revalidator = useRevalidator();
  const reloading = revalidator.state !== "idle";
  const { notifications } = useNotificationContext();
  const lastConsultId = useRef<string | null>(null);

  // Reaproveita o poll do sino (60s): quando chega AGENDADA/CANCELADA/LINK_MEET/ENCERRADO, o painel revalida.
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

  return (
    <section className="mx-auto max-w-3xl p-4 lg:p-6" aria-label="Meu painel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800">Meu painel</h1>
        {demand ? (
          <StatusBadge status={isEncerrado ? "Encerrado" : demandBadge(demand.status)} />
        ) : null}
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Acompanhe seu processo e agendamentos com segurança e sigilo.
      </p>

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
            Nenhuma demanda encontrada.
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Se você já registrou uma demanda, aguarde a análise do NEVIM.
          </p>
        </div>
      ) : null}

      {demand ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800">
              Sua jornada
            </h2>
            {(() => {
              const journeySteps = getVictimJourneySteps(demand.status);
              const currentIndex = journeySteps.findIndex(
                (step) => step.state === "current",
              );
              return (
                <>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {currentIndex >= 0
                      ? `Você está na etapa ${currentIndex + 1} de ${journeySteps.length}.`
                      : "Acompanhe o andamento do seu atendimento."}
                  </p>
                  <ol
                    className="mt-4 flex items-start"
                    aria-label="Etapas do atendimento"
                  >
                    {journeySteps.flatMap((step, index) => {
                      const nodes = [
                        <li
                          key={step.key}
                          className="flex flex-1 flex-col items-center gap-1.5 text-center"
                          aria-current={
                            step.state === "current" ? "step" : undefined
                          }
                        >
                          <span
                            aria-hidden="true"
                            className={
                              step.state === "done"
                                ? "grid h-9 w-9 place-items-center rounded-full bg-[#27500A] text-sm font-bold text-white"
                                : step.state === "current"
                                  ? "grid h-9 w-9 place-items-center rounded-full bg-[#378ADD] text-sm font-bold text-white shadow-md ring-4 ring-[#378ADD]/20"
                                  : "grid h-9 w-9 place-items-center rounded-full border-2 border-gray-300 bg-white text-sm font-semibold text-gray-400"
                            }
                          >
                            {step.state === "done" ? "✓" : index + 1}
                          </span>
                          <span
                            className={
                              step.state === "todo"
                                ? "text-[11px] font-medium leading-tight text-gray-500"
                                : step.state === "current"
                                  ? "text-[11px] font-semibold leading-tight text-[#0C447C]"
                                  : "text-[11px] font-semibold leading-tight text-gray-700"
                            }
                          >
                            {step.label}
                          </span>
                        </li>,
                      ];
                      if (index < journeySteps.length - 1) {
                        const next = journeySteps[index + 1];
                        nodes.push(
                          <li
                            key={`${step.key}-conector`}
                            aria-hidden="true"
                            className={`mx-1 mt-4 h-[2px] flex-1 rounded-full ${
                              next.state === "done"
                                ? "bg-[#27500A]"
                                : next.state === "current"
                                  ? "bg-[#378ADD]"
                                  : "bg-gray-200"
                            }`}
                          />,
                        );
                      }
                      return nodes;
                    })}
                  </ol>
                </>
              );
            })()}
            <Link
              to="/user/process"
              className="mt-4 inline-block text-xs font-semibold text-[#0C447C] underline underline-offset-2 hover:opacity-80"
            >
              Ver detalhes do meu processo →
            </Link>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800">
              Situação da sua demanda
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {isEncerrado
                ? "Seu processo foi encerrado. Obrigado por confiar no NEVIM."
                : demandMessage(demand.status)}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Registrada em{" "}
              {new Date(demand.criadoEm).toLocaleDateString("pt-BR")}
              {demand.tipoViolencia
                ? ` · ${demand.tipoViolencia}`
                : ""}
            </p>
          </div>

          {nextAppointment ? (
            <div className="rounded-2xl border border-[#378ADD]/30 bg-[#E6F1FB] p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[#0C447C]">
                Próxima consulta
              </h2>
              <p className="mt-1 text-lg font-semibold text-gray-800">
                {getDayLabel(nextAppointment.dataHora)} às{" "}
                {getAppointmentTime(nextAppointment.dataHora)}
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                {getTypeLabel(nextAppointment.tipoProfissional)} ·{" "}
                {nextAppointment.modalidade === "ONLINE"
                  ? "Online"
                  : nextAppointment.modalidade === "PRESENCIAL"
                    ? "Presencial"
                    : "Modalidade a definir"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={
                    nextAppointment.confirmacaoVitima === "CONFIRMADO"
                      ? "inline-flex items-center gap-1 rounded-full border border-[#EAF3DE] bg-[#EAF3DE] px-2.5 py-1 text-[11px] font-semibold text-[#27500A]"
                      : "inline-flex items-center gap-1 rounded-full border border-white bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500"
                  }
                >
                  <span
                    aria-hidden="true"
                    className={
                      nextAppointment.confirmacaoVitima === "CONFIRMADO"
                        ? "h-1.5 w-1.5 rounded-full bg-[#27500A]"
                        : "h-1.5 w-1.5 rounded-full bg-gray-300"
                    }
                  />
                  {nextAppointment.confirmacaoVitima === "CONFIRMADO"
                    ? "Você confirmou"
                    : "Aguardando você"}
                </span>
                <span
                  className={
                    nextAppointment.confirmacaoProfissional === "CONFIRMADO"
                      ? "inline-flex items-center gap-1 rounded-full border border-[#EAF3DE] bg-[#EAF3DE] px-2.5 py-1 text-[11px] font-semibold text-[#27500A]"
                      : "inline-flex items-center gap-1 rounded-full border border-white bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500"
                  }
                >
                  <span
                    aria-hidden="true"
                    className={
                      nextAppointment.confirmacaoProfissional === "CONFIRMADO"
                        ? "h-1.5 w-1.5 rounded-full bg-[#27500A]"
                        : "h-1.5 w-1.5 rounded-full bg-gray-300"
                    }
                  />
                  {nextAppointment.confirmacaoProfissional === "CONFIRMADO"
                    ? "Profissional confirmou"
                    : "Profissional pendente"}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                {nextAppointment.linkMeet
                  ? "O link da sala online já está disponível. Entre alguns minutos antes do horário."
                  : nextAppointment.modalidade === "PRESENCIAL"
                    ? "Atendimento presencial no NEVIM (UESPI). Compareça com alguns minutos de antecedência."
                    : "Confirme sua presença em Minhas consultas."}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {nextAppointment.linkMeet ? (
                  <>
                    <a
                      href={nextAppointment.linkMeet}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-lg bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-[#0C447C]"
                    >
                      Entrar na sala
                    </a>
                    <Link
                      to="/user/consultas"
                      className="inline-block rounded-lg border border-[#378ADD] px-4 py-2 text-xs font-semibold text-[#0C447C] transition-colors hover:bg-[#E6F1FB]"
                    >
                      Abrir Minhas consultas
                    </Link>
                  </>
                ) : (
                  <Link
                    to="/user/consultas"
                    className="inline-block rounded-lg bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-[#0C447C]"
                  >
                    Abrir Minhas consultas
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-800">
                Próxima consulta
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {isEncerrado
                  ? "Processo encerrado — não há consultas futuras."
                  : "Nenhuma consulta agendada no momento. Quando o NEVIM agendar um atendimento, ele aparecerá aqui."}
              </p>
            </div>
          )}

          {unreadCount > 0 ? (
            <div
              role="status"
              className="rounded-2xl border border-[#FAEEDA] bg-[#FAEEDA]/40 px-4 py-3 text-sm text-[#854F0B]"
            >
            Você tem {unreadCount}{" "}
            {unreadCount === 1 ? "notificação não lida" : "notificações não lidas"}.
            Toque no sino no topo da página para ler.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link
              to="/user/process"
              className="bg-[#378ADD] hover:bg-[#0C447C] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Ver meu processo
            </Link>
            <Link
              to="/user/consultas"
              className="border border-[#378ADD] text-[#0C447C] hover:bg-[#E6F1FB] text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Minhas consultas
            </Link>
          </div>
        </div>
      ) : null}

      {loadError ? <SkeletonCard lines={3} /> : null}
    </section>
  );
}
