import { useEffect, useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import { DatePicker } from "./DatePicker";
import {
  getProcessOptionLabel,
  getProfessionalTypeLabel,
  type AppointmentFilters as AppointmentFilterValues,
  type AppointmentProcessOption,
  type AppointmentStatusFilter,
  type ProfessionalType,
} from "../appointmentUtils";

type AppointmentFiltersProps = {
  filters: AppointmentFilterValues;
  counts: Record<AppointmentStatusFilter, number>;
  processOptions: AppointmentProcessOption[];
  /** Base da rota para os links/busca (padrão: /manager/consultas). */
  action?: string;
  /** Trava o tipo (ex.: tela de triagens só lista TRIAGEM). */
  fixedTipo?: ProfessionalType;
};

const STATUS_OPTIONS: { value: AppointmentStatusFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "AGENDADA", label: "Agendadas" },
  { value: "REALIZADA", label: "Realizadas" },
  { value: "CANCELADA", label: "Canceladas" },
  { value: "FALTOU", label: "Faltou" },
];

const TYPE_OPTIONS = [
  { value: "ALL", label: "Todos os tipos" },
  { value: "TRIAGEM", label: "Triagem" },
  { value: "PSICOLOGO", label: "Psicologia" },
  { value: "ASSISTENTE_SOCIAL", label: "Assistência social" },
  { value: "ASSESSOR_JURIDICO", label: "Jurídico" },
];

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30";

function buildStatusHref(
  filters: AppointmentFilterValues,
  status: AppointmentStatusFilter,
  action: string,
): string {
  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  if (filters.tipoProfissional !== "ALL") params.set("tipo", filters.tipoProfissional);
  if (filters.processoId) params.set("processoId", filters.processoId);
  if (filters.search) params.set("q", filters.search);
  if (filters.from) params.set("de", filters.from);
  if (filters.to) params.set("ate", filters.to);
  const query = params.toString();
  return query ? `${action}?${query}` : action;
}

export function AppointmentFilters({
  filters,
  counts,
  processOptions,
  action = "/manager/consultas",
  fixedTipo,
}: AppointmentFiltersProps) {
  const navigation = useNavigation();
  const filtering = navigation.state !== "idle";
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);

  // Sincroniza quando os filtros mudam por fora (links de status, Limpar).
  useEffect(() => {
    setFrom(filters.from);
    setTo(filters.to);
  }, [filters.from, filters.to]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrar por status"
      >
        {STATUS_OPTIONS.map((option) => {
          const active = filters.status === option.value;
          const count = counts[option.value] ?? 0;
          return (
            <Link
                key={option.value}
                to={buildStatusHref(filters, option.value, action)}
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

      <Form method="get" action={action} aria-label="Filtros de consultas">
        <input type="hidden" name="status" value={filters.status} />
        {fixedTipo ? <input type="hidden" name="tipo" value={fixedTipo} /> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">
              Buscar
            </span>
            <input
              type="search"
              name="q"
              key={filters.search}
              defaultValue={filters.search}
              placeholder="Vítima, protocolo, profissional…"
              className={inputClass}
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">
              Processo
            </span>
            <select
              name="processoId"
              key={filters.processoId}
              defaultValue={filters.processoId}
              className={inputClass}
            >
              <option value="">Todos os processos</option>
              {processOptions.map((process) => (
                <option key={process.processoId} value={process.processoId}>
                  {getProcessOptionLabel(process)}
                </option>
              ))}
            </select>
          </label>

          {fixedTipo ? (
            <div className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                Tipo de profissional
              </span>
              <p className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-gray-800">
                {getProfessionalTypeLabel(fixedTipo)}
              </p>
            </div>
          ) : (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">
              Tipo de profissional
            </span>
            <select
              name="tipo"
              key={filters.tipoProfissional}
              defaultValue={filters.tipoProfissional}
              className={inputClass}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                De
              </span>
              <DatePicker
                allowFutureDates
                value={from}
                onChange={setFrom}
                name="de"
                maxDate={to || undefined}
              />
            </div>
            <div className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                Até
              </span>
              <DatePicker
                allowFutureDates
                value={to}
                onChange={setTo}
                name="ate"
                minDate={from || undefined}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Link
            to={action}
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
      </Form>
    </div>
  );
}

export default AppointmentFilters;
