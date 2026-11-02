import { useEffect, useRef, useState } from "react";
import { calendarVars } from "./calendarTheme";

const pickerVars = calendarVars;

/** `HH:mm` 24h (`00:00`–`23:59`). */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Minutos válidos no passo de 5 (00, 05, …, 55). */
export function isValidTimeStep5(value: string): boolean {
  return isValidTime(value) && Number(value.slice(3, 5)) % 5 === 0;
}

function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function snapToStep5(value: string): string {
  if (!isValidTime(value)) return value;
  const minutes = Number(value.slice(3, 5));
  if (minutes % 5 === 0) return value;
  const snapped = Math.round(minutes / 5) * 5;
  if (snapped >= 60) {
    const hours = (Number(value.slice(0, 2)) + 1) % 24;
    return `${pad(hours)}:00`;
  }
  return `${value.slice(0, 2)}:${pad(snapped)}`;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => pad(hour));
const MINUTES_STEP_5 = Array.from({ length: 12 }, (_, index) => pad(index * 5));

type TimeInputProps = {
  /** `HH:mm` 24h ou "" vazio. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /**
   * Hora mínima (`HH:mm`) quando o dia selecionado é hoje. Opções do drum
   * menores ou iguais são passado e ficam desabilitadas no drum.
   */
  minTime?: string;
  hasError?: boolean;
  errorId?: string;
  ariaLabel: string;
  /**
   * Alinhamento do drum (popover). `end` ancora à direita — use no campo
   * da direita (ex.: "Término") para não vazar do modal no mobile.
   */
  align?: "start" | "end";
};

/**
 * Campo de hora 100% em 24h (garantido em qualquer browser, inclusive iOS
 * Safari que ignora `lang` no `<input type="time">`).
 *
 * Digitação com máscara `HH:mm` (teclado numérico no celular) + botão que
 * abre o drum opcional (horas `00-23` | minutos `00-55` passo 5).
 */
export function TimeInput({
  value,
  onChange,
  disabled = false,
  minTime,
  hasError = false,
  errorId,
  ariaLabel,
  align = "start",
}: TimeInputProps) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  // Fecha o drum ao clicar fora ou com Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  function handleTextChange(raw: string) {
    const masked = maskTime(raw);
    setText(masked);
    if (masked === "") {
      onChange("");
      return;
    }
    if (masked.length === 5 && isValidTime(masked)) {
      onChange(masked);
    }
  }

  function handleBlur() {
    if (text.length === 5 && isValidTime(text)) {
      const snapped = snapToStep5(text);
      if (snapped !== text) {
        setText(snapped);
        onChange(snapped);
      }
    }
  }

  function handleDrumSelect(hours: string, minutes: string) {
    const next = `${hours}:${minutes}`;
    setText(next);
    onChange(next);
  }

  const [selectedHours, selectedMinutes] = text.includes(":")
    ? text.split(":")
    : value.includes(":")
      ? value.split(":")
      : ["08", "00"];

  // Horário mínimo (quando o dia selecionado é hoje): opções menores ou
  // iguais são passado e ficam desabilitadas no drum.
  const minParts = minTime && isValidTime(minTime) ? minTime.split(":") : null;
  const minHour = minParts ? minParts[0] : null;
  const minMinute = minParts ? minParts[1] : null;

  function isHourPast(hour: string): boolean {
    return minHour !== null && hour < minHour;
  }

  function isMinutePast(minute: string): boolean {
    if (minHour === null || minMinute === null) return false;
    if (selectedHours < minHour) return true;
    if (selectedHours > minHour) return false;
    return minute <= minMinute;
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="HH:mm"
          pattern="([01]\d|2[0-3]):[0-5]\d"
          maxLength={5}
          value={text}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={hasError}
          aria-describedby={
            [hasError && errorId ? errorId : null, "hint-hora-24h"]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onChange={(event) => handleTextChange(event.target.value)}
          onBlur={handleBlur}
          className={`w-full rounded-xl border bg-white px-3 py-2 font-mono text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 disabled:opacity-60 ${
            hasError
              ? "border-red-400 focus:border-red-500 focus:ring-red-100"
              : "border-stone-200 focus:border-[#378ADD] focus:ring-[#378ADD]/30"
          }`}
        />
        <button
          type="button"
          onClick={() => !disabled && setOpen((current) => !current)}
          disabled={disabled}
          aria-label={open ? "Fechar seletor de hora" : "Abrir seletor de hora"}
          aria-expanded={open}
          title="Escolher hora"
          className="grid h-[42px] w-11 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-[#378ADD] hover:text-[#0C447C] disabled:opacity-60"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="10"
              cy="10"
              r="7.5"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M10 5.5V10l3 2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {open && !disabled ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className={`absolute z-50 mt-2 max-w-[calc(100vw-3rem)] rounded-2xl border border-stone-200 bg-white p-3 shadow-2xl ${
              align === "end" ? "right-0" : "left-0"
            }`}
            style={pickerVars}
            role="dialog"
            aria-label="Escolher horário em 24 horas"
          >
            <div className="flex gap-2">
              <div
                className="max-h-56 w-16 snap-y overflow-y-auto rounded-lg border border-stone-100 bg-stone-50 p-1"
                role="listbox"
                aria-label="Horas de 00 a 23"
              >
                {HOURS.map((hour) => {
                  const past = isHourPast(hour);
                  return (
                    <button
                      key={hour}
                      type="button"
                      role="option"
                      aria-selected={hour === selectedHours}
                      aria-disabled={past}
                      disabled={past}
                      onClick={() => handleDrumSelect(hour, selectedMinutes)}
                      className={`w-full snap-start rounded px-2 py-1.5 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${
                        hour === selectedHours
                          ? "bg-[#0C447C] font-semibold text-white"
                          : "text-gray-700 hover:bg-[#E6F1FB] hover:text-[#0C447C]"
                      }`}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>
              <div
                className="max-h-56 w-16 snap-y overflow-y-auto rounded-lg border border-stone-100 bg-stone-50 p-1"
                role="listbox"
                aria-label="Minutos de 5 em 5"
              >
                {MINUTES_STEP_5.map((minute) => {
                  const past = isMinutePast(minute);
                  return (
                    <button
                      key={minute}
                      type="button"
                      role="option"
                      aria-selected={minute === selectedMinutes}
                      aria-disabled={past}
                      disabled={past}
                      onClick={() => handleDrumSelect(selectedHours, minute)}
                      className={`w-full snap-start rounded px-2 py-1.5 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${
                        minute === selectedMinutes
                          ? "bg-[#0C447C] font-semibold text-white"
                          : "text-gray-700 hover:bg-[#E6F1FB] hover:text-[#0C447C]"
                      }`}
                    >
                      {minute}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 w-full rounded-lg bg-[#0C447C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#061f3a]"
            >
              Confirmar {selectedHours}:{selectedMinutes}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default TimeInput;
