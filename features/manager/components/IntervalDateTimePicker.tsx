import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import "react-day-picker/style.css";
import "./calendar.css";
import { calendarVars } from "./calendarTheme";
import {
  formatInterval,
  getProfessionalTypeLabel,
  type CalendarAppointmentInfo,
  type OccupiedInterval,
} from "../appointmentUtils";
import { shortId } from "../managerUtils";
import { TimeInput } from "./TimeInput";

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

function toTimeValue(localDateTime: string, day: Date): string {
  const parsed = parseLocalDateTime(localDateTime);
  if (parsed && toDayKey(parsed) === toDayKey(day)) {
    return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  }
  return "";
}

function combineDayTime(day: Date, time: string): string {
  return `${toDayKey(day)}T${time}`;
}

export type IntervalValue = {
  /** Início no formato `AAAA-MM-DDTHH:mm` (hora local) ou "" vazio. */
  start: string;
  /** Término no formato `AAAA-MM-DDTHH:mm` (hora local) ou "" vazio. */
  end: string;
};

type IntervalDateTimePickerProps = {
  value: IntervalValue;
  onChange: (next: IntervalValue) => void;
  /**
   * Intervalos ocupados [início, fim) em ms. `undefined` = profissional
   * ainda não escolhido (sem marcação de ocupação).
   */
  occupiedIntervals?: OccupiedInterval[];
  /** Dia selecionado (controlado pelo formulário, para filtrar a lista). */
  selectedDay: Date | undefined;
  onDayChange: (day: Date | undefined) => void;
  /** Consultas AGENDADAS do profissional no dia selecionado (para listar). */
  dayAppointments?: CalendarAppointmentInfo[];
  hasError?: boolean;
  errorId?: string;
};

const pickerVars = calendarVars;

/** Faixa exibida no mapa do dia (8h–22h). */
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;

/**
 * Seletor de intervalo em um único calendário: escolhe o dia no `DayPicker`
 * e digita início/término livres (`HH:mm`, passo de 5 min). Substitui os dois
 * `DateTimePicker` empilhados: garante mesmo dia, mostra a agenda ocupada do
 * profissional como barras e resume o intervalo escolhido.
 */
export function IntervalDateTimePicker({
  value,
  onChange,
  occupiedIntervals,
  selectedDay,
  onDayChange,
  dayAppointments,
  hasError = false,
  errorId,
}: IntervalDateTimePickerProps) {
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const [visibleMonth, setVisibleMonth] = useState<Date>(
    selectedDay ?? today,
  );

  // Acompanha o dia selecionado quando muda por fora (reset do form).
  useEffect(() => {
    if (selectedDay) setVisibleMonth(selectedDay);
  }, [selectedDay]);

  // Dropdown de ano no cabeçalho (agendamento é sempre futuro).
  const currentYear = new Date().getFullYear();
  const fromYear = currentYear;
  const toYear = currentYear + 5;

  function handleDaySelect(day: Date | undefined) {
    if (!day) return;
    onDayChange(day);
    setVisibleMonth(day);
    // Trocar de dia preserva os horários já digitados (só muda a data).
    const startTime = value.start.slice(11, 16);
    const endTime = value.end.slice(11, 16);
    onChange({
      start: startTime ? combineDayTime(day, startTime) : "",
      end: endTime ? combineDayTime(day, endTime) : "",
    });
  }

  function handleTimeChange(which: "start" | "end", time: string) {
    if (!selectedDay) return;
    onChange({
      start: which === "start" ? (time ? combineDayTime(selectedDay, time) : "") : value.start,
      end: which === "end" ? (time ? combineDayTime(selectedDay, time) : "") : value.end,
    });
  }

  const startTime = selectedDay ? toTimeValue(value.start, selectedDay) : "";
  const endTime = selectedDay ? toTimeValue(value.end, selectedDay) : "";

  // Bloqueio de horário passado (visual + imediato): no dia de hoje, horas
  // menores ou iguais a agora são passado (`when <= now`, mesma regra do
  // validateAppointmentForm).
  const now = useMemo(() => new Date(), []);
  const isToday =
    !!selectedDay && toDayKey(selectedDay) === toDayKey(new Date());
  const minTime = isToday
    ? `${pad(now.getHours())}:${pad(now.getMinutes())}`
    : undefined;

  /** `HH:mm` digitado/selecionado é passado (só vale no dia de hoje). */
  function isPastTime(time: string): boolean {
    if (!selectedDay || !isToday || !time) return false;
    const when = parseLocalDateTime(combineDayTime(selectedDay, time));
    return !!when && when.getTime() <= now.getTime();
  }

  const startIsPast = isPastTime(startTime);
  const endIsPast = isPastTime(endTime);

  // Barras ocupadas restritas ao dia selecionado (escala 8h–22h).
  const dayBars = useMemo(() => {
    if (!selectedDay || !occupiedIntervals) return [];
    const dayStart = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      DAY_START_HOUR,
      0,
      0,
      0,
    ).getTime();
    const dayEnd = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      DAY_END_HOUR,
      0,
      0,
      0,
    ).getTime();
    const span = dayEnd - dayStart;
    return occupiedIntervals
      .filter(
        (interval) => interval.start < dayEnd && interval.end > dayStart,
      )
      .map((interval, index) => {
        const left = Math.max(0, ((interval.start - dayStart) / span) * 100);
        const right = Math.min(100, ((interval.end - dayStart) / span) * 100);
        return { key: `${interval.start}-${interval.end}-${index}`, left, width: Math.max(right - left, 1.5), interval };
      });
  }, [selectedDay, occupiedIntervals]);

  // Faixa selecionada no mapa do dia.
  const selectedBar = useMemo(() => {
    if (!selectedDay) return null;
    const start = parseLocalDateTime(value.start)?.getTime();
    const end = parseLocalDateTime(value.end)?.getTime();
    if (!start || !end || Number.isNaN(start) || Number.isNaN(end)) return null;
    const dayStart = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      DAY_START_HOUR,
      0,
      0,
      0,
    ).getTime();
    const dayEnd = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      DAY_END_HOUR,
      0,
      0,
      0,
    ).getTime();
    const span = dayEnd - dayStart;
    const left = Math.max(0, ((start - dayStart) / span) * 100);
    const right = Math.min(100, ((end - dayStart) / span) * 100);
    if (right <= 0 || left >= 100) return null;
    return { left, width: Math.max(right - left, 1.5) };
  }, [selectedDay, value.start, value.end]);

  const durationMinutes = useMemo(() => {
    const start = parseLocalDateTime(value.start)?.getTime();
    const end = parseLocalDateTime(value.end)?.getTime();
    if (!start || !end || Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
    return Math.round((end - start) / 60000);
  }, [value.start, value.end]);

  return (
    <div
      className={`w-full max-w-full overflow-x-clip rounded-xl border bg-white p-3 shadow-sm sm:p-4 ${
        hasError ? "border-red-400" : "border-stone-200"
      }`}
      style={pickerVars}
    >
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <div className="w-full min-w-0 max-w-full overflow-x-clip [&_.rdp-month]:w-full [&_.rdp-month]:max-w-full [&_.rdp-month_grid]:w-full [&_.rdp-months]:w-full [&_.rdp-months]:max-w-full [&_.rdp-root]:w-full [&_.rdp-root]:max-w-full">
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
            aria-label="Escolha o dia da consulta"
            captionLayout="dropdown-years"
            fromYear={fromYear}
            toYear={toYear}
          />
        </div>
        <div className="w-full min-w-0 max-w-full">
          <p className="mb-2 text-xs font-semibold text-gray-600">
            {selectedDay
              ? `Horário — ${selectedDay.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}`
              : "Escolha um dia no calendário"}
          </p>
          <p id="hint-hora-24h" className="mb-2 text-[11px] text-gray-500">
            Formato 24h · ex.: 14:30
          </p>
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            <div className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                Início
              </span>
              <TimeInput
                value={startTime}
                disabled={!selectedDay}
                minTime={minTime}
                ariaLabel="Hora de início — formato 24 horas"
                hasError={hasError || startIsPast}
                errorId={errorId}
                align="start"
                onChange={(time) => handleTimeChange("start", time)}
              />
            </div>
            <div className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                Término
              </span>
              <TimeInput
                value={endTime}
                disabled={!selectedDay}
                minTime={minTime}
                ariaLabel="Hora de término — formato 24 horas"
                hasError={hasError || endIsPast}
                errorId={errorId}
                align="end"
                onChange={(time) => handleTimeChange("end", time)}
              />
            </div>
          </div>

          {selectedDay ? (
            <>
              {(startIsPast || endIsPast) && !hasError ? (
                <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
                  Horário no passado. Escolha um horário futuro.
                </p>
              ) : null}
              <div
                className="relative mt-3 h-6 rounded-lg bg-stone-100"
                role="img"
                aria-label="Mapa de ocupação do dia: barras cinzas são horários ocupados, faixa azul é o intervalo escolhido"
              >
                {isToday ? (
                  <div
                    aria-hidden="true"
                    title="Horário já passado"
                    className="absolute top-0 bottom-0 left-0 rounded-l-lg bg-stone-300/70"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          ((now.getTime() -
                            new Date(
                              selectedDay!.getFullYear(),
                              selectedDay!.getMonth(),
                              selectedDay!.getDate(),
                              DAY_START_HOUR,
                              0,
                              0,
                              0,
                            ).getTime()) /
                            ((DAY_END_HOUR - DAY_START_HOUR) * 3600000)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                ) : null}
                {dayBars.map((bar) => (
                  <div
                    key={bar.key}
                    title={`Ocupado ${formatInterval(
                      new Date(bar.interval.start).toISOString(),
                      new Date(bar.interval.end).toISOString(),
                    )}`}
                    className="absolute top-1 bottom-1 rounded bg-stone-300"
                    style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                  />
                ))}
                {selectedBar ? (
                  <div
                    className="absolute top-1 bottom-1 rounded bg-[#378ADD]/60"
                    style={{ left: `${selectedBar.left}%`, width: `${selectedBar.width}%` }}
                  />
                ) : null}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                <span>08h</span>
                <span>22h</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full bg-[#378ADD]"
                  />
                  Escolhido
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full bg-stone-300"
                  />
                  Ocupado
                </span>
              </div>
              {occupiedIntervals !== undefined ? (
                <section
                  aria-label="Consultas do profissional neste dia"
                  className="mt-3 border-t border-stone-100 pt-3"
                >
                  <p className="text-xs font-semibold text-gray-700">
                    Consultas em{" "}
                    {selectedDay.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}{" "}
                    · {dayAppointments?.length ?? 0}
                  </p>
                  {!dayAppointments || dayAppointments.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Nenhuma consulta — horários livres (08h–22h).
                    </p>
                  ) : (
                    <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-stone-100 bg-stone-50 p-2 pr-1">
                      {dayAppointments.map((appointment) => (
                        <li
                          key={`${appointment.processoId ?? ""}-${appointment.dataHora}`}
                          className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1 text-xs"
                        >
                          <span className="shrink-0 font-mono font-semibold text-gray-800">
                            {formatInterval(
                              appointment.dataHora,
                              appointment.dataHoraFim ?? null,
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-gray-700">
                            {appointment.vitimaNome?.trim() || "—"}
                            {appointment.vitimaCampus?.trim()
                              ? ` · ${appointment.vitimaCampus.trim()}`
                              : ""}
                            {appointment.processoId
                              ? ` · ${shortId(appointment.processoId)}`
                              : ""}
                          </span>
                          {appointment.tipoProfissional ? (
                            <span className="shrink-0 rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[10px] font-semibold text-[#0C447C]">
                              {getProfessionalTypeLabel(
                                appointment.tipoProfissional,
                              )}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}
              {value.start && value.end && durationMinutes !== null ? (
                <p className="mt-2 text-xs font-semibold text-[#0C447C]">
                  {formatInterval(
                    new Date(value.start).toISOString(),
                    new Date(value.end).toISOString(),
                  )}{" "}
                  · {durationMinutes} min
                </p>
              ) : value.start ? (
                <p className="mt-2 text-xs text-gray-500">
                  Agora informe o término.
                </p>
              ) : null}
              {occupiedIntervals === undefined ? (
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

export default IntervalDateTimePicker;
