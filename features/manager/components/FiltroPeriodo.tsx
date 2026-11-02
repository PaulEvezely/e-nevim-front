import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigation, useSearchParams } from "react-router";
import { format, startOfMonth, startOfYear, subDays } from "date-fns";
import { cn } from "../../../libs/utils";
import { getCampusOptionsSync } from "../../../app/data/uespiCourses";
import { DatePicker } from "./DatePicker";
import { Toast } from "../../../shared/components/Toast";
import { useToast } from "../../../shared/hooks/useToast";

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type Preset = { label: string; resolve: () => { de: string; ate: string } };

const PRESETS: Preset[] = [
  {
    label: "7 dias",
    resolve: () => ({
      de: format(subDays(new Date(), 6), "yyyy-MM-dd"),
      ate: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    label: "30 dias",
    resolve: () => ({
      de: format(subDays(new Date(), 29), "yyyy-MM-dd"),
      ate: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Mês atual",
    resolve: () => ({
      de: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      ate: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Ano atual",
    resolve: () => ({
      de: format(startOfYear(new Date()), "yyyy-MM-dd"),
      ate: format(new Date(), "yyyy-MM-dd"),
    }),
  },
];

/** Filtro de período que atualiza a query string e revalida o loader. */
export function FiltroPeriodo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();

  const currentDe = searchParams.get("de") ?? "";
  const currentAte = searchParams.get("ate") ?? "";
  const currentCampus = searchParams.get("campus") ?? "";

  const [de, setDe] = useState(currentDe);
  const [ate, setAte] = useState(currentAte);
  const [campus, setCampus] = useState(currentCampus);
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast } = useToast();
  const campusOptions = useMemo(() => getCampusOptionsSync(), []);

  useEffect(() => {
    setDe(currentDe);
    setAte(currentAte);
    setCampus(currentCampus);
  }, [currentDe, currentAte, currentCampus]);

  function fail(message: string) {
    setError(message);
    showToast(message, "error");
  }

  const isBusy = navigation.state !== "idle";

  const hasFilter = Boolean(currentDe || currentAte || currentCampus);

  const activePreset = useMemo(() => {
    if (!currentDe || !currentAte) return null;
    return (
      PRESETS.find((preset) => {
        const range = preset.resolve();
        return range.de === currentDe && range.ate === currentAte;
      })?.label ?? null
    );
  }, [currentDe, currentAte]);

  function apply(nextDe: string, nextAte: string, nextCampus: string) {
    if (nextDe && !DATE_INPUT_PATTERN.test(nextDe)) {
      fail("Data inicial inválida.");
      return;
    }
    if (nextAte && !DATE_INPUT_PATTERN.test(nextAte)) {
      fail("Data final inválida.");
      return;
    }
    if (nextDe && nextAte && nextDe > nextAte) {
      fail("A data inicial deve ser anterior ou igual à data final.");
      return;
    }
    setError(null);

    const params = new URLSearchParams(searchParams);
    if (nextDe) params.set("de", nextDe);
    else params.delete("de");
    if (nextAte) params.set("ate", nextAte);
    else params.delete("ate");
    if (nextCampus) params.set("campus", nextCampus);
    else params.delete("campus");
    params.delete("page");
    setSearchParams(params, { preventScrollReset: true });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(de, ate, campus);
  }

  function handlePreset(preset: Preset) {
    const range = preset.resolve();
    setDe(range.de);
    setAte(range.ate);
    apply(range.de, range.ate, campus);
  }

  function handleClear() {
    setDe("");
    setAte("");
    setCampus("");
    setError(null);
    const params = new URLSearchParams(searchParams);
    params.delete("de");
    params.delete("ate");
    params.delete("campus");
    params.delete("page");
    setSearchParams(params, { preventScrollReset: true });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      aria-label="Filtro de período dos dashboards"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="dashboard-de" className="text-xs font-medium text-gray-600">
            De
          </label>
          <DatePicker
            allowFutureDates
            value={de}
            onChange={setDe}
            maxDate={ate || undefined}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="dashboard-ate" className="text-xs font-medium text-gray-600">
            Até
          </label>
          <DatePicker
            allowFutureDates
            value={ate}
            onChange={setAte}
            minDate={de || undefined}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="dashboard-campus" className="text-xs font-medium text-gray-600">
            Campus
          </label>
          <select
            id="dashboard-campus"
            value={campus}
            onChange={(event) => setCampus(event.target.value)}
            className="h-9 rounded-xl border border-stone-200 bg-white px-3 text-sm text-gray-800 shadow-sm focus:border-[#2A6FBF] focus:outline-none focus:ring-2 focus:ring-[#2A6FBF]/30"
          >
            <option value="">Todos os campi</option>
            {campusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePreset(preset)}
              disabled={isBusy}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6FBF] focus-visible:ring-offset-2 disabled:opacity-50",
                activePreset === preset.label
                  ? "border-[#378ADD] bg-[#E6F1FB] text-[#0C447C]"
                  : "border-stone-300 bg-white text-gray-600 hover:bg-stone-100",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="submit"
            disabled={isBusy}
            className="rounded-xl bg-[#2A6FBF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0C447C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6FBF] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {isBusy ? "Carregando…" : "Aplicar"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isBusy || !hasFilter}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6FBF] focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Limpar
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-xs font-medium text-[#791F1F]">{error}</p>
      ) : null}

      <Toast toast={toast} />
    </form>
  );
}

export default FiltroPeriodo;
