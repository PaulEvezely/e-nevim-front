import { Link, useRevalidator } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/painel";
import { requireUser } from "../../../features/auth/require-user.server";
import { managerApi, type TriageQueueItem } from "../../../features/manager/managerApi.server";
import { appointmentApi } from "../../../features/manager/appointmentApi.server";
import {
  countDentroCampus,
  isAguardandoCadastro,
  isDentroCampusItem,
  isPendenteAnalise,
  shortId,
  type ManagerDemandItem,
} from "../../../features/manager/managerUtils";
import { KpiCard } from "../../../shared/components/KpiCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { SkeletonCard } from "../../../shared/components/LoadingOverlay";
import { formatDate } from "../../../shared/utils/date";
import { AppointmentForm } from "../../../features/manager/components/AppointmentForm";
import { type AppointmentProcessOption } from "../../../features/manager/appointmentUtils";
import { useToast } from "../../../shared/hooks/useToast";
import { useNotificationContext } from "../../../features/notifications/NotificationProvider";

type PanelLoaderData = {
  pendingCount: number;
  campusCount: number;
  triageCount: number;
  demands: ManagerDemandItem[];
  triageQueue: TriageQueueItem[];
  triageProcessOptions: AppointmentProcessOption[];
  gestor: { id: string; nome: string };
  professionals: { id: string; nome: string; perfil: string; registro: string | null }[];
  myTriagemAppointments: { profissionalId: string; dataHora: string; status: string }[];
  loadError: string | null;
};

/** Quantidade de linhas exibidas na fila de triagem do painel. */
const TRIAGE_QUEUE_LIMIT = 8;

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["manager"]);

  try {
    const user = await requireUser(request, ["manager"]);
    // A contagem vem da própria fila: o summary agregado não distingue
    // aprovadas com e sem cadastro concluído.
    const [
      demands,
      triageQueue,
      triageProcessOptions,
      gestor,
      professionals,
      myTriagemAppointments,
    ] = await Promise.all([
      managerApi.listFilaDemandas(request),
      managerApi.listTriageQueue(request),
      appointmentApi.listTriageProcessOptions(request).catch(() => []),
      appointmentApi.getGestor(request, user.id).catch(() => ({
        id: user.id,
        nome: user.name || "Gestor",
      })),
      appointmentApi.listProfessionals(request).catch(() => []),
      appointmentApi.listMyTriagemAppointments(request, user.id).catch(() => []),
    ]);
    // Só as demandas que ainda aguardam análise do gestor (sem contar as
    // aprovadas aguardando cadastro da vítima).
    const pendingCount = demands.filter(isPendenteAnalise).length;
    const campusCount = countDentroCampus(demands);
    // Quantidade real da fila de triagens.
    const triageCount = triageQueue.length;
    return {
      pendingCount,
      campusCount,
      triageCount,
      demands,
      triageQueue,
      triageProcessOptions,
      gestor,
      professionals,
      myTriagemAppointments,
      loadError: null,
    } satisfies PanelLoaderData;
  } catch {
    return {
      pendingCount: 0,
      campusCount: 0,
      triageCount: 0,
      demands: [],
      triageQueue: [],
      triageProcessOptions: [],
      gestor: { id: "", nome: "Gestor" },
      professionals: [],
      myTriagemAppointments: [],
      loadError:
        "Não foi possível carregar o painel agora. Tente novamente em instantes.",
    } satisfies PanelLoaderData;
  }
}

function DemandRow({ demand }: { demand: ManagerDemandItem }) {
  const dentroCampus = isDentroCampusItem(demand);
  const aguardandoCadastro = isAguardandoCadastro(demand);
  return (
    <tr className="border-t border-stone-200 first:border-t-0">
      <td className="px-3 py-3 text-xs font-mono text-gray-600 align-top">
        <span title={demand.id}>{shortId(demand.id)}</span>
        {dentroCampus ? (
          <span className="mt-1 block">
            <StatusBadge status="No campus" />
          </span>
        ) : null}
      </td>
      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap align-top">
        {formatDate(demand.criadoEm)}
      </td>
      <td className="px-3 py-3 text-xs text-gray-700 align-top max-w-0">
        <span className="block truncate max-w-[160px]" title={demand.solicitanteCampus?.trim()}>
          {demand.solicitanteCampus?.trim() || "—"}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-gray-700 align-top max-w-0">
        <span className="block truncate max-w-[180px]" title={demand.tipoViolencia}>
          {demand.tipoViolencia || "—"}
        </span>
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap">
        {aguardandoCadastro ? (
          <StatusBadge status="Aguardando cadastro" />
        ) : (
          <StatusBadge status="Pendente" />
        )}
      </td>
      <td className="px-3 py-3 text-right align-top">
        <Link
          to={`/manager/demandas/${demand.id}`}
          aria-label={`Detalhar demanda ${shortId(demand.id)}`}
          className="inline-block bg-[#378ADD] hover:bg-[#0C447C] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow"
        >
          Detalhar
        </Link>
      </td>
    </tr>
  );
}

function TriageRow({
  item,
  onAgendar,
}: {
  item: TriageQueueItem;
  onAgendar: (processoId: string) => void;
}) {
  return (
    <tr className="border-t border-stone-200 first:border-t-0">
      <td className="px-3 py-3 text-xs font-mono text-gray-600 align-top">
        <span title={item.processoId}>{shortId(item.processoId)}</span>
      </td>
      <td className="px-3 py-3 text-xs text-gray-700 align-top">
        <span className="block max-w-52 truncate">
          {item.nome?.trim() || "—"}
        </span>
        <span className="block text-[11px] text-gray-500">
          {item.campus?.trim() || ""}
        </span>
      </td>
      <td className="px-3 py-3 text-right align-top">
        {item.triagemAgendada ? (
          <span
            className="inline-block rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-gray-500"
            title="A consulta de triagem já está agendada para este processo."
          >
            triagem agendada
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onAgendar(item.processoId)}
            aria-label={`Agendar triagem para ${item.nome?.trim() || item.processoId}`}
            className="inline-block bg-[#378ADD] hover:bg-[#0C447C] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow"
          >
            agendar
          </button>
        )}
      </td>
    </tr>
  );
}

export default function ManagerPanel({ loaderData }: Route.ComponentProps) {
  const {
    pendingCount,
    campusCount,
    triageCount,
    demands,
    triageQueue,
    triageProcessOptions,
    gestor,
    professionals,
    myTriagemAppointments,
    loadError,
  } = loaderData;
  const revalidator = useRevalidator();
  const { toast, showToast } = useToast();
  const { notifications } = useNotificationContext();
  const lastNovaDemandaId = useRef<string | null>(null);
  const loading = revalidator.state !== "idle";

  // Reaproveita o poll do sino (60s): quando chega NOVA_DEMANDA, a fila revalida.
  useEffect(() => {
    const newest = notifications.find((n) => n.tipo === "NOVA_DEMANDA");
    if (!newest) return;
    if (lastNovaDemandaId.current === null) {
      lastNovaDemandaId.current = newest.id;
      return;
    }
    if (newest.id !== lastNovaDemandaId.current) {
      lastNovaDemandaId.current = newest.id;
      if (revalidator.state === "idle" && document.visibilityState === "visible") {
        revalidator.revalidate();
      }
    }
  }, [notifications, revalidator]);

  // Garante ao voltar de aba/foco, mesmo sem NOVA_DEMANDA nova.
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
  const visibleTriageQueue = triageQueue.slice(0, TRIAGE_QUEUE_LIMIT);
  const [agendarTriagemId, setAgendarTriagemId] = useState<string | null>(null);

  const agendarTriagemOption = (() => {
    if (!agendarTriagemId) return null;
    const hit = triageProcessOptions.find((o) => o.processoId === agendarTriagemId);
    if (hit) return hit;
    const queueHit = triageQueue.find((q) => q.processoId === agendarTriagemId);
    if (!queueHit) return null;
    return {
      processoId: queueHit.processoId,
      status: "ABERTO" as const,
      direcionadoPara: null,
      classificacaoRisco: null,
      abertoEm: queueHit.abertoEm,
      vitimaNome: queueHit.nome,
      vitimaCampus: queueHit.campus,
      totalConsultas: 0,
    } satisfies (typeof triageProcessOptions)[number];
  })();

  function handleAgendarTriagem(processoId: string) {
    setAgendarTriagemId(processoId);
  }

  function handleAgendarClose() {
    setAgendarTriagemId(null);
  }

  function handleAgendarSuccess() {
    showToast("Triagem agendada com sucesso.", "success");
    revalidator.revalidate();
    setAgendarTriagemId(null);
  }

  return (
    <>
      <section className="max-w-7xl mx-auto p-4 lg:p-6" aria-label="Painel de acompanhamento">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-gray-800">
            Painel de acompanhamento
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Acompanhe demandas aguardando análise ou cadastro, casos dentro
            do campus e a fila de triagem.
          </p>
        </div>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mt-4 bg-[#FCEBEB] border border-red-200 text-[#791F1F] text-sm px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => revalidator.revalidate()}
            disabled={loading}
            className="text-xs font-semibold underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
          >
            {loading ? "Carregando…" : "Tentar novamente"}
          </button>
        </div>
      ) : null}

      {loading && demands.length === 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Demandas Pendentes"
            value={String(pendingCount)}
            subtitle="Aguardando análise do gestor"
            icon="clock"
            tone="info"
          />
          <KpiCard
            title="Casos dentro do campus"
            value={String(campusCount)}
            subtitle="Com alerta automático ao gestor"
            icon="alert"
            tone="danger"
          />
          <KpiCard
            title="Processos Pendentes"
            value={String(triageCount)}
            subtitle="Casos que precisam da triagem"
            icon="clipboard"
            tone="neutral"
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden lg:col-span-3">
          <div className="px-4 py-3 bg-stone-100 border-b border-stone-200 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Fila de demandas
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Ordenada: dentro do campus primeiro, depois as demais (mais
                recentes antes).
              </p>
            </div>
            <Link
              to="/manager/demandas"
              className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0C447C] hover:bg-[#E6F1FB]"
            >
              Ver todas
            </Link>
          </div>
          {demands.length === 0 && !loadError ? (
            <p className="px-4 py-8 text-sm text-gray-500 text-center">
              Nenhuma demanda na fila no momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-150 border-collapse">
                <caption className="sr-only">
                  Demandas aguardando análise ou cadastro da vítima
                </caption>
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Id da demanda
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Data
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Campus
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Tipo de violência
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Situação
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[#E6F1FB]/40">
                  {demands.map((demand) => (
                    <DemandRow key={demand.id} demand={demand} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 bg-stone-100 border-b border-stone-200 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Fila triagem
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Processos criados que ainda não passaram pela triagem.
              </p>
            </div>
            {triageQueue.length > visibleTriageQueue.length ? (
              <Link
                to="/manager/pacientes?triage=SEM_TRIAGEM"
                className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0C447C] hover:bg-[#E6F1FB]"
              >
                Ver todas
              </Link>
            ) : null}
          </div>
          {visibleTriageQueue.length === 0 && !loadError ? (
            <p className="px-4 py-8 text-sm text-gray-500 text-center">
              Nenhum processo aguardando triagem no momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-100 border-collapse">
                <caption className="sr-only">
                  Processos aguardando triagem
                </caption>
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Id processo
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Nome
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[#E6F1FB]/40">
                  {visibleTriageQueue.map((item) => (
                    <TriageRow
                      key={item.vitimaId}
                      item={item}
                      onAgendar={handleAgendarTriagem}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
</div>
       </div>
</section>

      <AppointmentForm
        open={!!agendarTriagemId}
        processOptions={[]}
        triageProcessOptions={triageProcessOptions}
        professionals={professionals}
        calendarAppointments={myTriagemAppointments.map((a) => ({
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
        initialProcessOption={agendarTriagemOption as any}
        initialTipo="TRIAGEM"
        lockTipo="TRIAGEM"
        title="Nova triagem"
        onClose={handleAgendarClose}
        showToast={showToast}
      />
    </>
  );
}
