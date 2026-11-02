import { useEffect, useMemo, useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import { DatePicker } from "./DatePicker";
import { getCampusOptionsSync } from "../../../app/data/uespiCourses";
import { getViolenceTypeOptions } from "../../../app/data/violenceTypes";
import type {
  DemandFilters as DemandFilterValues,
  DemandStatusCounts,
} from "../managerUtils";

type DemandFiltersProps = {
  filters: DemandFilterValues;
  counts: DemandStatusCounts;
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todas" },
  { value: "PENDENTE", label: "Pendente" },
  { value: "AGUARDANDO_CADASTRO", label: "Aguardando cadastro" },
  { value: "EM_PROCESSO", label: "Em processo" },
  { value: "REJEITADA", label: "Rejeitada" },
] as const;

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30";

function buildStatusHref(filters: DemandFilterValues, status: string): string {
  const params = new URLSearchParams();
  params.set("status", status);
  if (filters.campus !== "ALL") params.set("campus", filters.campus);
  if (filters.violenceType !== "ALL") params.set("violenceType", filters.violenceType);
  if (filters.search) params.set("q", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.onlyCampus) params.set("onlyCampus", "1");
  const query = params.toString();
  return query ? `/manager/demandas?${query}` : "/manager/demandas";
}

export function DemandFilters({ filters, counts }: DemandFiltersProps) {
  const navigation = useNavigation();
  const filtering = navigation.state !== "idle";
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);

  // Sincroniza quando os filtros mudam por fora (links de status, Limpar).
  useEffect(() => {
    setFrom(filters.from);
    setTo(filters.to);
  }, [filters.from, filters.to]);

  const campusOptions = useMemo(() => getCampusOptionsSync(), []);
  const violenceTypeOptions = useMemo(() => getViolenceTypeOptions(), []);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por status">
        {STATUS_OPTIONS.map((option) => {
          const active = filters.status === option.value;
          const count = counts[option.value] ?? 0;
          return (
            <Link
              key={option.value}
              to={buildStatusHref(filters, option.value)}
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "rounded-full bg-[#0C447C] px-3 py-1.5 text-xs font-semibold text-white shadow"
                  : "rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-stone-100"
              }
            >
              {option.label} · {count}
            </Link>
          );
        })}
      </div>

      <Form method="get" action="/manager/demandas" aria-label="Filtros de demandas">
        <input type="hidden" name="status" value={filters.status} />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Buscar</span>
            <input
              type="search"
              name="q"
              key={filters.search}
              defaultValue={filters.search}
              placeholder="Nome, e-mail, protocolo…"
              className={inputClass}
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Campus</span>
            <select name="campus" key={filters.campus} defaultValue={filters.campus} className={inputClass}>
              <option value="ALL">Todos os campi</option>
              {campusOptions.map((campus) => (
                <option key={campus} value={campus}>
                  {campus}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Tipo de violência</span>
            <select
              name="violenceType"
              key={filters.violenceType}
              defaultValue={filters.violenceType}
              className={inputClass}
            >
              <option value="ALL">Todos os tipos</option>
              {violenceTypeOptions.map((violenceType) => (
                <option key={violenceType} value={violenceType}>
                  {violenceType}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">De</span>
              <DatePicker
                allowFutureDates
                value={from}
                onChange={setFrom}
                name="from"
                maxDate={to || undefined}
              />
            </div>
            <div className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">Até</span>
              <DatePicker
                allowFutureDates
                value={to}
                onChange={setTo}
                name="to"
                minDate={from || undefined}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="onlyCampus"
              value="1"
              key={`onlyCampus-${String(filters.onlyCampus)}`}
              defaultChecked={filters.onlyCampus}
              className="h-4 w-4 rounded border-stone-300 accent-[#0C447C]"
            />
            Somente dentro do campus
          </label>

          <div className="flex items-center gap-2">
            <Link
              to="/manager/demandas"
              className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-stone-50"
            >
              Limpar
            </Link>
            <button
              type="submit"
              disabled={filtering}
              className="rounded-xl bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C] disabled:opacity-60"
            >
              {filtering ? "Filtrando…" : "Aplicar filtros"}
            </button>
          </div>
        </div>
      </Form>
    </div>
  );
}

export default DemandFilters;
