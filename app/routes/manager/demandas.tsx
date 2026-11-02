import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/demandas";
import { requireUser } from "../../../features/auth/require-user.server";
import { managerApi } from "../../../features/manager/managerApi.server";
import {
  parseDemandFilters,
  parseDemandPage,
  type DemandFilters as DemandFilterValues,
  type DemandStatusCounts,
  type ManagerDemandItem,
} from "../../../features/manager/managerUtils";
import { DemandFilters } from "../../../features/manager/components/DemandFilters";
import { DemandTable } from "../../../features/manager/components/DemandTable";
import { Pagination } from "../../../shared/components/Pagination";
import { SkeletonCard } from "../../../shared/components/LoadingOverlay";
import { useNotificationContext } from "../../../features/notifications/NotificationProvider";

type DemandsLoaderData = {
  demands: ManagerDemandItem[];
  page: number;
  totalPages: number;
  filteredCount: number;
  totalCount: number;
  counts: DemandStatusCounts;
  filters: DemandFilterValues;
  loadError: string | null;
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["manager"]);
  const url = new URL(request.url);
  const filters = parseDemandFilters(url.searchParams);
  const requestedPage = parseDemandPage(url.searchParams);
  try {
    const result = await managerApi.listDemands(request, filters, requestedPage);
    const totalPages = Math.max(1, result.totalPages);
    const page = Math.min(Math.max(1, result.page), totalPages);
    return {
      demands: result.demandas,
      page,
      totalPages,
      filteredCount: result.total,
      totalCount: result.counts.ALL,
      counts: result.counts,
      filters,
      loadError: null,
    } satisfies DemandsLoaderData;
  } catch {
    return {
      demands: [],
      page: 1,
      totalPages: 1,
      filteredCount: 0,
      totalCount: 0,
      counts: {
        ALL: 0,
        PENDENTE: 0,
        AGUARDANDO_CADASTRO: 0,
        EM_PROCESSO: 0,
        REJEITADA: 0,
      },
      filters,
      loadError: "Não foi possível carregar as demandas. Tente novamente em instantes.",
    } satisfies DemandsLoaderData;
  }
}

export default function ManagerDemands({ loaderData }: Route.ComponentProps) {
  const {
    demands,
    page,
    totalPages,
    filteredCount,
    totalCount,
    counts,
    filters,
    loadError,
  } = loaderData;
  const revalidator = useRevalidator();
  const reloading = revalidator.state !== "idle";
  const { notifications } = useNotificationContext();
  const lastNovaDemandaId = useRef<string | null>(null);

  // Reaproveita o poll do sino (60s): quando chega NOVA_DEMANDA, a lista revalida.
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

  return (
    <section className="mx-auto max-w-6xl" aria-label="Todas as demandas">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">Demandas</h1>
          <p className="mt-1 text-sm text-gray-600">
            {totalCount === 0
              ? "Nenhuma demanda registrada até o momento."
              : `${filteredCount} de ${totalCount} demandas exibidas.`}
          </p>
        </div>
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
        <DemandFilters filters={filters} counts={counts} />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Todas as demandas</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Mais recentes primeiro.
            {totalPages > 1 ? ` Página ${page} de ${totalPages}.` : ""}
          </p>
        </div>
        {reloading && demands.length === 0 ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2" aria-hidden="true">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : (
          <>
            <DemandTable demands={demands} />
            <Pagination page={page} totalPages={totalPages} />
          </>
        )}
      </div>
    </section>
  );
}
