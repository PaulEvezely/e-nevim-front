import { useEffect, useMemo, useRef, useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import { DatePicker } from "./DatePicker";
import { getCampusOptionsSync, getCoursesByCampusSync } from "../../../app/data/uespiCourses";
import {
  PATIENT_AREA_LABELS,
  PATIENT_BOND_LABELS,
  PATIENT_BOND_OPTIONS,
  PATIENT_TRIAGE_LABELS,
  type PatientAreaFilter,
  type PatientFacets,
  type PatientFilters as PatientFilterValues,
  type PatientTriageCounts,
  type PatientTriageFilter,
} from "../patientUtils";

type PatientFiltersProps = {
  filters: PatientFilterValues;
  counts: PatientTriageCounts;
  facets: PatientFacets;
};

const TRIAGE_OPTIONS: { value: PatientTriageFilter; label: string; hint: string }[] = [
  { value: "ALL", label: "Todos", hint: "Todas as vítimas com cadastro completo" },
  {
    value: "SEM_TRIAGEM",
    label: PATIENT_TRIAGE_LABELS.SEM_TRIAGEM,
    hint: "Sem processo + processo ABERTO (a fila do Painel mostra só ABERTO)",
  },
  {
    value: "EM_TRIAGEM",
    label: PATIENT_TRIAGE_LABELS.EM_TRIAGEM,
    hint: "Processo EM_TRIAGEM (triagem registrada, aguardando encaminhamento)",
  },
  {
    value: "ENCAMINHADO",
    label: PATIENT_TRIAGE_LABELS.ENCAMINHADO,
    hint: "Processo ENCAMINHADO para Psicologia, Assistência social, Jurídico ou Externo",
  },
  {
    value: "ENCERRADO",
    label: PATIENT_TRIAGE_LABELS.ENCERRADO,
    hint: "Processo ENCERRADO",
  },
];

const AREA_OPTIONS: { value: PatientAreaFilter; label: string }[] = [
  { value: "ALL", label: "Todas as áreas" },
  { value: "PSICOLOGO", label: PATIENT_AREA_LABELS.PSICOLOGO },
  { value: "ASSISTENTE_SOCIAL", label: PATIENT_AREA_LABELS.ASSISTENTE_SOCIAL },
  { value: "ASSESSOR_JURIDICO", label: PATIENT_AREA_LABELS.ASSESSOR_JURIDICO },
  { value: "EXTERNO", label: "Externo" },
];

const RISK_OPTIONS = [
  { value: "ALL", label: "Todos os riscos" },
  { value: "ELEVADO", label: "Elevado" },
  { value: "MEDIO", label: "Médio" },
  { value: "BAIXO", label: "Baixo" },
] as const;

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30";

function withCurrent(options: string[], current: string): string[] {
  if (current === "ALL" || options.includes(current)) return options;
  return [current, ...options];
}

function buildFiltersHref(
  filters: PatientFilterValues,
  triage: PatientTriageFilter,
): string {
  const params = new URLSearchParams();
  if (triage !== "ALL") params.set("triage", triage);
  if (filters.area !== "ALL") params.set("area", filters.area);
  if (filters.risk !== "ALL") params.set("risk", filters.risk);
  if (filters.campus !== "ALL") params.set("campus", filters.campus);
  if (filters.course !== "ALL") params.set("course", filters.course);
  if (filters.bond !== "ALL") params.set("bond", filters.bond);
  if (filters.search) params.set("q", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return query ? `/manager/pacientes?${query}` : "/manager/pacientes";
}

export function PatientFilters({
  filters,
  counts,
  facets,
}: PatientFiltersProps) {
  const navigation = useNavigation();
  const filtering = navigation.state !== "idle";
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const formRef = useRef<HTMLFormElement>(null);

  // Sincroniza quando os filtros mudam por fora (chips de triagem, Limpar).
  useEffect(() => {
    setFrom(filters.from);
    setTo(filters.to);
  }, [filters.from, filters.to]);

  function handleCampusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const form = formRef.current;
    if (!form) return;
    const courseSelect = form.elements.namedItem("course") as HTMLSelectElement;
    if (courseSelect) {
      courseSelect.value = "ALL";
    }
    form.requestSubmit();
  }
  const campusOptions = useMemo(
    () => withCurrent(getCampusOptionsSync(), filters.campus),
    [filters.campus],
  );
  const courseOptions = useMemo(
    () => {
      if (filters.campus === "ALL") {
        return withCurrent(facets.courses, filters.course);
      }
      const campusCourses = getCoursesByCampusSync(filters.campus);
      return withCurrent(campusCourses, filters.course);
    },
    [facets.courses, filters.course, filters.campus],
  );
  const bondOptions = useMemo(
    () =>
      withCurrent(
        facets.bonds.length > 0 ? facets.bonds : [...PATIENT_BOND_OPTIONS],
        filters.bond,
      ),
    [facets.bonds, filters.bond],
  );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrar por situação da triagem"
      >
        {TRIAGE_OPTIONS.map((option) => {
          const active = filters.triage === option.value;
          const count = counts[option.value] ?? 0;
          return (
            <Link
              key={option.value}
              to={buildFiltersHref(filters, option.value)}
              aria-current={active ? "true" : undefined}
              title={option.hint}
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

      <Form method="get" action="/manager/pacientes" aria-label="Filtros de pacientes" ref={formRef}>
        <input type="hidden" name="triage" value={filters.triage} />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Buscar</span>
            <input
              type="search"
              name="q"
              key={filters.search}
              defaultValue={filters.search}
              placeholder="Nome do paciente…"
              className={inputClass}
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Área</span>
            <select
              name="area"
              key={filters.area}
              defaultValue={filters.area}
              className={inputClass}
            >
              {AREA_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Campus</span>
            <select
              name="campus"
              key={filters.campus}
              defaultValue={filters.campus}
              className={inputClass}
              onChange={handleCampusChange}
            >
              <option value="ALL">Todos os campi</option>
              {campusOptions.map((campus) => (
                <option key={campus} value={campus}>
                  {campus}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Curso</span>
            <select
              name="course"
              key={filters.course}
              defaultValue={filters.course}
              className={inputClass}
              disabled={filters.campus === "ALL"}
            >
              <option value="ALL">
                {filters.campus === "ALL"
                  ? "Selecione o campus primeiro"
                  : "Selecione o curso (opcional)"}
              </option>
              {courseOptions.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Vínculo</span>
            <select
              name="bond"
              key={filters.bond}
              defaultValue={filters.bond}
              className={inputClass}
            >
              <option value="ALL">Todos os vínculos</option>
              {bondOptions.map((bond) => (
                <option key={bond} value={bond}>
                  {PATIENT_BOND_LABELS[bond] ?? bond}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Risco</span>
            <select
              name="risk"
              key={filters.risk}
              defaultValue={filters.risk}
              className={inputClass}
            >
              {RISK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Link
            to="/manager/pacientes"
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

export default PatientFilters;
