import { useNavigation, useRevalidator } from "react-router";
import { requireUser } from "../../../features/auth/require-user.server";
import { dashboardApi } from "../../../features/manager/dashboardApi.server";
import {
  formatPeriodLabel,
  parseDashboardPeriod,
  toApiPeriod,
  type DashboardData,
  type DashboardPeriod,
} from "../../../features/manager/dashboardUtils";
import { DashboardLayout } from "../../../features/manager/components/DashboardLayout";
import { DashboardSkeleton } from "../../../features/manager/components/DashboardSkeleton";
import { Spinner } from "../../../shared/components/Spinner";
import { DashboardErrorState } from "../../../features/manager/components/DashboardErrorState";
import { FiltroPeriodo } from "../../../features/manager/components/FiltroPeriodo";
import type { Route } from "./+types/dashboards";

type DashboardsLoaderData = {
  data: DashboardData | null;
  period: DashboardPeriod;
  loadError: string | null;
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["manager"]);

  const url = new URL(request.url);
  const period = parseDashboardPeriod(url.searchParams);

  try {
    const data = await dashboardApi.getAll(request, toApiPeriod(period));
    return { data, period, loadError: null } satisfies DashboardsLoaderData;
  } catch {
    return {
      data: null,
      period,
      loadError:
        "Não foi possível carregar os indicadores. Tente novamente em instantes.",
    } satisfies DashboardsLoaderData;
  }
}

export default function ManagerDashboards({ loaderData }: Route.ComponentProps) {
  const { data, period, loadError } = loaderData;
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const reloading =
    navigation.state === "loading" || revalidator.state !== "idle";

  return (
    <section
      className="mx-auto max-w-7xl"
      aria-label="Dashboards"
      aria-busy={reloading}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            Dashboards
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Indicadores do fluxo NEVIM · {formatPeriodLabel(period)}
          </p>
        </div>
        {reloading ? (
          <Spinner size="sm" label="Atualizando indicadores…" />
        ) : null}
      </div>

      <div className="mt-4">
        <FiltroPeriodo />
      </div>

      <div className="mt-6 space-y-4">
        {loadError ? (
          <DashboardErrorState
            message={loadError}
            onRetry={() => revalidator.revalidate()}
            retrying={reloading}
          />
        ) : null}

        {reloading && !data ? (
          <DashboardSkeleton />
        ) : data ? (
          <DashboardLayout data={data} period={period} />
        ) : null}
      </div>
    </section>
  );
}
