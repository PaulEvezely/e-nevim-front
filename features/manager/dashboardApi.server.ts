import { apiFetchJson } from "../auth/apiFetch.server";
import type {
  DashboardConsultas,
  DashboardData,
  DashboardDemandas,
  DashboardDemografico,
  DashboardEncaminhamentos,
  DashboardFrida,
  DashboardPeriod,
  DashboardProcessos,
  DashboardSummary,
} from "./dashboardUtils";

const DEFAULT_DASHBOARD_ERROR =
  "Não foi possível carregar os indicadores. Tente novamente em instantes.";

/** Serializa os filtros aceitos por `GET /dashboard/*?de=&ate=&campus=`. */
function buildPeriodQuery(period: DashboardPeriod): string {
  const params = new URLSearchParams();
  if (period.de) params.set("de", period.de);
  if (period.ate) params.set("ate", period.ate);
  if (period.campus) params.set("campus", period.campus);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const dashboardApi = {
  getSummary(request: Request): Promise<DashboardSummary> {
    return apiFetchJson<DashboardSummary>(
      request,
      "/dashboard/summary",
      undefined,
      DEFAULT_DASHBOARD_ERROR,
    );
  },

  getDemandas(
    request: Request,
    period: DashboardPeriod = {},
  ): Promise<DashboardDemandas> {
    return apiFetchJson<DashboardDemandas>(
      request,
      `/dashboard/demandas${buildPeriodQuery(period)}`,
      undefined,
      DEFAULT_DASHBOARD_ERROR,
    );
  },

  getProcessos(
    request: Request,
    period: DashboardPeriod = {},
  ): Promise<DashboardProcessos> {
    return apiFetchJson<DashboardProcessos>(
      request,
      `/dashboard/processos${buildPeriodQuery(period)}`,
      undefined,
      DEFAULT_DASHBOARD_ERROR,
    );
  },

  getConsultas(
    request: Request,
    period: DashboardPeriod = {},
  ): Promise<DashboardConsultas> {
    return apiFetchJson<DashboardConsultas>(
      request,
      `/dashboard/consultas${buildPeriodQuery(period)}`,
      undefined,
      DEFAULT_DASHBOARD_ERROR,
    );
  },

  getFrida(
    request: Request,
    period: DashboardPeriod = {},
  ): Promise<DashboardFrida> {
    return apiFetchJson<DashboardFrida>(
      request,
      `/dashboard/frida${buildPeriodQuery(period)}`,
      undefined,
      DEFAULT_DASHBOARD_ERROR,
    );
  },

  getEncaminhamentos(
    request: Request,
    period: DashboardPeriod = {},
  ): Promise<DashboardEncaminhamentos> {
    return apiFetchJson<DashboardEncaminhamentos>(
      request,
      `/dashboard/encaminhamentos${buildPeriodQuery(period)}`,
      undefined,
      DEFAULT_DASHBOARD_ERROR,
    );
  },

  getDemografico(
    request: Request,
    period: DashboardPeriod = {},
  ): Promise<DashboardDemografico> {
    return apiFetchJson<DashboardDemografico>(
      request,
      `/dashboard/demografico${buildPeriodQuery(period)}`,
      undefined,
      DEFAULT_DASHBOARD_ERROR,
    );
  },

  /** Carrega os sete blocos em paralelo (loader da tela de dashboards). */
  async getAll(
    request: Request,
    period: DashboardPeriod = {},
  ): Promise<DashboardData> {
    const [
      summary,
      demandas,
      processos,
      consultas,
      frida,
      encaminhamentos,
      demografico,
    ] = await Promise.all([
      dashboardApi.getSummary(request),
      dashboardApi.getDemandas(request, period),
      dashboardApi.getProcessos(request, period),
      dashboardApi.getConsultas(request, period),
      dashboardApi.getFrida(request, period),
      dashboardApi.getEncaminhamentos(request, period),
      dashboardApi.getDemografico(request, period),
    ]);

    return {
      summary,
      demandas,
      processos,
      consultas,
      frida,
      encaminhamentos,
      demografico,
    };
  },
};
