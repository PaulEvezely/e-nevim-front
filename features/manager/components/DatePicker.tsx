import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import "react-day-picker/style.css";
import "./calendar.css";
import { calendarVars } from "./calendarTheme";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Converte Date para AAAA-MM-DD (formato ISO, sem hora). */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Converte AAAA-MM-DD para DD/MM/AAAA (exibição brasileira). */
export function toDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Converte DD/MM/AAAA para AAAA-MM-DD; null se inválido. */
export function parseDisplayToISO(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return toISODate(date);
}

/** Converte AAAA-MM-DD em Date local; null se inválido. */
function parseISODate(iso: string): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

type DatePickerProps = {
  /** Valor atual em AAAA-MM-DD (ou "" quando vazio). */
  value: string;
  onChange: (isoDate: string) => void;
  /** Data mínima selecionável (AAAA-MM-DD). Opcional. */
  minDate?: string;
  /** Data máxima selecionável (AAAA-MM-DD). Opcional. */
  maxDate?: string;
  /**
   * Permite datas futuras. Quando falso (padrão), o máximo é hoje
   * (ex.: data de nascimento). Filtros devem passar `allowFutureDates`.
   */
  allowFutureDates?: boolean;
  hasError?: boolean;
  errorId?: string;
  /** Texto exibido quando o campo está vazio. */
  placeholder?: string;
  /**
   * Nome do campo para submissão em formulários (ex.: filtros GET).
   * Renderiza um `<input type="hidden">` com o valor ISO.
   */
  name?: string;
};

const pickerVars = calendarVars;

/**
 * Seletor de data (só dia, sem hora) com calendário + digitação DD/MM/AAAA.
 * Armazena AAAA-MM-DD (ISO). Substitui inputs de texto com máscara manual.
 */
export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  hasError = false,
  errorId,
  placeholder = "DD/MM/AAAA",
  name,
  allowFutureDates = false,
}: DatePickerProps) {
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const parsed = parseISODate(value);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => (value ? toDisplayDate(value) : ""));
  const [visibleMonth, setVisibleMonth] = useState<Date>(parsed ?? today);

  // Sincroniza quando o valor muda por fora (reset do form).
  useEffect(() => {
    setText(value ? toDisplayDate(value) : "");
    const next = parseISODate(value);
    if (next) setVisibleMonth(next);
  }, [value]);

  const min = minDate ? parseISODate(minDate) : undefined;
  const max = maxDate
    ? parseISODate(maxDate)
    : allowFutureDates
      ? undefined
      : today;

  // Faixa de anos do dropdown do cabeçalho (respeita min/max quando dados).
  const currentYear = new Date().getFullYear();
  const fromYear = min?.getFullYear() ?? 1900;
  const toYear = max?.getFullYear() ?? currentYear + 5;

  const disabledDays: ({ before: Date } | { after: Date })[] = [];
  if (min) {
    const before = new Date(min);
    before.setDate(before.getDate() - 1);
    disabledDays.push({ before: min });
  }
  if (max) disabledDays.push({ after: max });

  function handleTextChange(raw: string) {
    // Máscara progressiva DD/MM/AAAA (só dígitos, máx. 8).
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let masked = digits;
    if (digits.length > 2) masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    if (digits.length > 4)
      masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    setText(masked);
    // Emite ISO quando completo e válido; senão limpa.
    if (masked.length === 10) {
      const iso = parseDisplayToISO(masked);
      if (iso) {
        onChange(iso);
        setVisibleMonth(parseISODate(iso) ?? today);
      } else {
        onChange("");
      }
    } else if (masked === "") {
      onChange("");
    }
  }

  function handleDaySelect(day: Date | undefined) {
    if (!day) return;
    const iso = toISODate(day);
    onChange(iso);
    setText(toDisplayDate(iso));
    setVisibleMonth(day);
    setOpen(false);
  }

  const todaySelectable =
    (!min || today >= min) && (!max || today <= max);

  function goToToday() {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <div className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          maxLength={10}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onFocus={() => setOpen(true)}
          aria-invalid={hasError}
          aria-describedby={hasError && errorId ? errorId : undefined}
          className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 ${
            hasError
              ? "border-red-400 focus:border-red-500 focus:ring-red-100"
              : "border-stone-200 focus:border-[#378ADD] focus:ring-[#378ADD]/30"
          }`}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar calendário" : "Abrir calendário"}
          aria-expanded={open}
          className={`shrink-0 rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 ${
            open
              ? "border-[#378ADD] bg-[#E6F1FB] text-[#0C447C]"
              : "border-stone-200 bg-white text-gray-600 hover:border-[#378ADD] hover:text-[#0C447C]"
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="4.5"
              width="14"
              height="12"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M3 8.5h14M7.5 3v3M12.5 3v3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute z-50 mt-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl ring-1 ring-black/5"
            style={pickerVars}
            role="dialog"
            aria-label="Escolher data"
          >
            <DayPicker
              mode="single"
              locale={ptBR}
              weekStartsOn={0}
              month={visibleMonth}
              onMonthChange={setVisibleMonth}
              selected={parsed ?? undefined}
              onSelect={handleDaySelect}
              disabled={disabledDays}
              captionLayout="dropdown-years"
              fromYear={fromYear}
              toYear={toYear}
              footer={
                todaySelectable ? (
                  <button
                    type="button"
                    onClick={goToToday}
                    className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0C447C] hover:border-[#378ADD] hover:bg-[#E6F1FB]"
                  >
                    Hoje
                  </button>
                ) : undefined
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

export default DatePicker;
