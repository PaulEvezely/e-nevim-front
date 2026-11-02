import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import "react-day-picker/style.css";
import "./calendar.css";
import { calendarVars } from "./calendarTheme";
import {
  buildDaySlots,
  buildDaySlotsWithIntervals,
  type OccupiedInterval,
} from "../appointmentUtils";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type DateTimePickerProps = {
  /** Valor atual no formato `AAAA-MM-DDTHH:mm` (ou "" quando vazio). */
  value: string;
  onChange: (value: string) => void;
  /**
   * Datas ISO (UTC, vindas da API) das consultas AGENDADAS do profissional
   * selecionado. `undefined` = profissional ainda não escolhido (sem
   * marcação de ocupação). Mantido por compatibilidade — prefira
   * `occupiedIntervals` (assume 30 min por consulta legada).
   */
  occupiedIsoDates?: string[];
  /**
   * Intervalos [início, fim) ocupados (tem precedência sobre
   * `occupiedIsoDates`). `undefined` = profissional ainda não escolhido.
   */
  occupiedIntervals?: OccupiedInterval[];
  hasError?: boolean;
  errorId?: string;
};

const pickerVars = calendarVars;

/**
 * Seletor de data e hora com calendário + grade de horários. Substitui o
 * `<input type="datetime-local">` nativo: mostra os horários ocupados do
 * profissional e impede data/hora no passado.
 */
export function DateTimePicker({
  value,
  onChange,
  occupiedIsoDates,
  occupiedIntervals,
  hasError = false,
  errorId,
}: DateTimePickerProps) {
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const parsed = parseLocalDateTime(value);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(
    parsed ?? undefined,
  );
  const [visibleMonth, setVisibleMonth] = useState<Date>(parsed ?? today);

  // Dropdown de ano no cabeçalho (agendamento é sempre futuro).
  const currentYear = new Date().getFullYear();
  const fromYear = currentYear;
  const toYear = currentYear + 5;

  // Sincroniza o dia exibido quando o valor muda por fora (reset do form).
  useEffect(() => {
    const next = parseLocalDateTime(value);
    setSelectedDay(next ?? undefined);
    if (next) setVisibleMonth(next);
  }, [value]);

  const slots = useMemo(() => {
    if (!selectedDay) return [];
    if (occupiedIntervals) {
      return buildDaySlotsWithIntervals(selectedDay, occupiedIntervals);
    }
    return buildDaySlots(selectedDay, occupiedIsoDates ?? []);
  }, [selectedDay, occupiedIsoDates, occupiedIntervals]);

  function handleDaySelect(day: Date | undefined) {
    if (!day) return;
    setSelectedDay(day);
    setVisibleMonth(day);
    // Mantém o horário já escolhido se for o mesmo dia; senão, exige nova
    // escolha de horário.
    const current = parseLocalDateTime(value);
    if (current && toDayKey(current) === toDayKey(day)) return;
    onChange("");
  }

  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-sm ${
        hasError ? "border-red-400" : "border-stone-200"
      }`}
      style={pickerVars}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <DayPicker
            mode="single"
            locale={ptBR}
            weekStartsOn={0}
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
            selected={selectedDay}
            onSelect={handleDaySelect}
            disabled={{ before: today }}
            aria-describedby={hasError && errorId ? errorId : undefined}
            captionLayout="dropdown-years"
            fromYear={fromYear}
            toYear={toYear}
          />
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-gray-600">
            {selectedDay
              ? `Horários — ${selectedDay.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}`
              : "Escolha um dia no calendário"}
          </p>
          {selectedDay ? (
            <>
              <div
                role="group"
                aria-label="Horários disponíveis"
                className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto pr-1"
              >
                {slots.map((slot) => {
                  const selected = value === slot.value;
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      disabled={slot.disabled}
                      aria-pressed={selected}
                      aria-label={
                        slot.occupied
                          ? `${slot.label} (ocupado)`
                          : `${slot.label}${selected ? " (selecionado)" : ""}`
                      }
                      onClick={() => onChange(slot.value)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                        selected
                          ? "bg-[#0C447C] text-white shadow"
                          : slot.occupied
                            ? "bg-stone-100 text-gray-400 line-through"
                            : "border border-stone-200 bg-white text-gray-700 hover:border-[#378ADD] hover:text-[#0C447C] disabled:bg-stone-50 disabled:text-gray-300 disabled:line-through disabled:hover:border-stone-200 disabled:hover:text-gray-300"
                      }`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full bg-[#0C447C]"
                  />
                  Selecionado
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full bg-stone-300"
                  />
                  Ocupado/indisponível
                </span>
              </div>
              {occupiedIsoDates === undefined &&
              occupiedIntervals === undefined ? (
                <p className="mt-1 text-[11px] text-gray-500">
                  Selecione o profissional para ver os horários ocupados.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-gray-500">
              Os horários disponíveis aparecem aqui após escolher o dia.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default DateTimePicker;
