import { useEffect, useMemo, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { Button } from "../../../shared/components/Button";
import {
  EMPTY_APPOINTMENT_FORM,
  PROFESSIONAL_TYPES,
  findOverlappingInterval,
  formatInterval,
  getProcessOptionLabel,
  getProfessionalTypeLabel,
  isAwaitingTriageProcess,
  isTriageProcessOption,
  toGestorProfessionalOption,
  toLocalDayKey,
  toOccupiedIntervals,
  validateAppointmentForm,
  type AppointmentActionData,
  type AppointmentFormData,
  type AppointmentFormErrors,
  type AppointmentProcessOption,
  type CalendarAppointmentInfo,
  type ProfessionalOption,
  type ProfessionalType,
} from "../appointmentUtils";
import { IntervalDateTimePicker } from "./IntervalDateTimePicker";
import { ProcessCombobox } from "../../../shared/components/ProcessCombobox";
import { useDebouncedValue } from "../../../shared/hooks/useDebounce";

type ShowToast = (
  message: string,
  type?: "success" | "error",
) => void;

export type GestorOption = {
  id: string;
  nome: string;
};

type AppointmentFormProps = {
  open: boolean;
  processOptions: AppointmentProcessOption[];
  /** Processos ABERTO: únicos que aceitam consulta de triagem. */
  triageProcessOptions: AppointmentProcessOption[];
  professionals: ProfessionalOption[];
  /** Consultas existentes (data, profissional, status) para a ocupação. */
  calendarAppointments: CalendarAppointmentInfo[];
  /** Gestor autenticado — responsável pelas consultas de triagem. */
  gestor: GestorOption;
  /** Processo pré-selecionado (deep-link da fila de triagem). */
  initialProcessoId?: string;
  initialTipo?: ProfessionalType;
  /** Processo completo para label imediato (Pacientes → Marcar consulta). */
  initialProcessOption?: AppointmentProcessOption | null;
  /**
   * Trava o tipo de consulta (ex.: tela "Minhas triagens" só agenda TRIAGEM).
   * Esconde o seletor de tipo e força o valor em todas as trocas.
   */
  lockTipo?: ProfessionalType;
  /** Título do diálogo (padrão: "Nova consulta"). */
  title?: string;
  onClose: () => void;
  showToast: ShowToast;
};

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 disabled:opacity-60";
const errorInputClass =
  "w-full rounded-xl border border-red-400 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";

function fieldClass(hasError: boolean): string {
  return hasError ? errorInputClass : inputClass;
}

/**
 * Estado inicial do formulário. Com tipo travado (ex.: TRIAGEM), o tipo e o
 * responsável já vêm preenchidos mesmo sem processo (gestor default, com
 * troca para psico/assist — designada). O deep-link da fila só pré-seleciona
 * o processo.
 */
function buildInitialFormData(
  initialProcessoId: string | undefined,
  initialTipo: ProfessionalType | undefined,
  gestorId: string,
): AppointmentFormData {
  const initial: AppointmentFormData = { ...EMPTY_APPOINTMENT_FORM };
  if (!initialProcessoId) {
    if (initialTipo === "TRIAGEM") {
      initial.tipoProfissional = "TRIAGEM";
      initial.profissionalId = gestorId;
    }
    return initial;
  }
  initial.processoId = initialProcessoId;
  // Só a triagem vem com tipo forçado (deep-link ?agendarTriagem). O
  // acompanhamento (?agendarConsulta) deixa o tipo em branco para o gestor
  // escolher Psicologia/Assistência/Jurídico.
  initial.tipoProfissional = initialTipo ?? "";
  if (initial.tipoProfissional === "TRIAGEM") {
    initial.profissionalId = gestorId;
  }
  return initial;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-700">
      {message}
    </p>
  );
}

export function AppointmentForm({
  open,
  processOptions,
  triageProcessOptions,
  professionals,
  calendarAppointments,
  gestor,
  initialProcessoId,
  initialTipo,
  initialProcessOption,
  lockTipo,
  title = "Nova consulta",
  onClose,
  showToast,
}: AppointmentFormProps) {
  const fetcher = useFetcher<AppointmentActionData>();
  const revalidator = useRevalidator();
  const [formData, setFormData] = useState<AppointmentFormData>(() =>
    buildInitialFormData(initialProcessoId, lockTipo ?? initialTipo, gestor.id),
  );
  const [errors, setErrors] = useState<AppointmentFormErrors>({});
  const [attempted, setAttempted] = useState(false);
  /** Dia clicado no calendário (controla o picker e a lista do dia). */
  const [pickerDay, setPickerDay] = useState<Date | undefined>(undefined);

  // --- Busca digitável de processos (debounce + fetcher) ---
  const [processQuery, setProcessQuery] = useState("");
  const debouncedQuery = useDebouncedValue(processQuery, 300);
  const searchFetcher = useFetcher<{ options: AppointmentProcessOption[] }>();

  const busy = fetcher.state !== "idle";

  const isTriagem = formData.tipoProfissional === "TRIAGEM";

  /** Intervalos ocupados das consultas AGENDADAS do profissional escolhido. */
  const occupiedIntervals = useMemo(() => {
    if (!formData.profissionalId) return undefined;
    return toOccupiedIntervals(
      calendarAppointments.filter(
        (appointment) =>
          appointment.profissionalId === formData.profissionalId,
      ),
    );
  }, [calendarAppointments, formData.profissionalId]);

  /**
   * Conflito do intervalo escolhido com a agenda do profissional (aviso
   * visual; o back valida de novo com 409 quando tiver a coluna de fim).
   */
  const conflictInterval = useMemo(() => {
    if (!occupiedIntervals) return null;
    const start = new Date(formData.dataLocal).getTime();
    const end = new Date(formData.dataFim).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    return findOverlappingInterval(occupiedIntervals, start, end);
  }, [occupiedIntervals, formData.dataLocal, formData.dataFim]);

  /** Consultas AGENDADAS do profissional no dia clicado (lista do dia). */
  const dayAppointments = useMemo(() => {
    if (!pickerDay || !formData.profissionalId) return [];
    const key =
      `${pickerDay.getFullYear()}-${String(pickerDay.getMonth() + 1).padStart(2, "0")}-${String(pickerDay.getDate()).padStart(2, "0")}`;
    return calendarAppointments
      .filter(
        (appointment) =>
          appointment.profissionalId === formData.profissionalId &&
          appointment.status === "AGENDADA" &&
          toLocalDayKey(appointment.dataHora) === key,
      )
      .sort(
        (a, b) =>
          new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime(),
      );
  }, [calendarAppointments, formData.profissionalId, pickerDay]);

  const gestorOption = useMemo(
    () => toGestorProfessionalOption(gestor),
    [gestor],
  );

  /**
   * O tipo define quais processos podem ser agendados: TRIAGEM aceita
   * processo ABERTO (aguardando triagem); acompanhamento aceita processo
   * ENCAMINHADO ou EM_TRIAGEM (agendar com o profissional encaminha
   * automaticamente). Sem tipo definido, todos os grupos ficam disponíveis.
   */
  const availableProcessOptions = useMemo(() => {
    if (isTriagem) return triageProcessOptions;
    if (!formData.tipoProfissional) {
      return [...processOptions, ...triageProcessOptions];
    }
    return processOptions;
  }, [processOptions, triageProcessOptions, formData.tipoProfissional, isTriagem]);

  const availableProfessionals = useMemo(() => {
    if (isTriagem) {
      return [
        gestorOption,
        ...professionals.filter(
          (professional) =>
            professional.perfil === "PSICOLOGO" ||
            professional.perfil === "ASSISTENTE_SOCIAL",
        ),
      ];
    }
    if (!formData.tipoProfissional) return [];
    return professionals.filter(
      (professional) =>
        professional.perfil === formData.tipoProfissional,
    );
  }, [professionals, gestorOption, formData.tipoProfissional, isTriagem]);

  const triagemPsicoAssist = useMemo(
    () =>
      availableProfessionals.filter((professional) => professional.perfil !== "TRIAGEM"),
    [availableProfessionals],
  );

  // Opção inicial para label imediato (Pacientes → Marcar consulta)
  const resolvedInitialOption = useMemo(() => {
    if (initialProcessOption) return initialProcessOption;
    if (!initialProcessoId) return null;
    return (
      [...triageProcessOptions, ...processOptions].find(
        (p) => p.processoId === initialProcessoId,
      ) ?? null
    );
  }, [initialProcessOption, initialProcessoId, triageProcessOptions, processOptions]);

  // Opções vindas da busca remota (via /api/process-search)
  const searchedOptions = useMemo(
    () => (searchFetcher.data?.options as AppointmentProcessOption[] | undefined) ?? [],
    [searchFetcher.data],
  );

  // Display options: prioriza busca remota quando há query ou dados, senão usa fallback estático
  const displayProcessOptions = useMemo(() => {
    const hasSearchData = searchFetcher.data !== undefined;
    const base = hasSearchData ? searchedOptions : availableProcessOptions;
    // Garante que a opção inicial/pre-selecionada apareça mesmo se fora da página atual
    if (
      resolvedInitialOption &&
      !base.some((o) => o.processoId === resolvedInitialOption.processoId)
    ) {
      return [resolvedInitialOption, ...base];
    }
    // Também garante que o processo já selecionado (formData.processoId) apareça
    if (
      formData.processoId &&
      !base.some((o) => o.processoId === formData.processoId) &&
      resolvedInitialOption?.processoId !== formData.processoId
    ) {
      const selectedInStatic = [...triageProcessOptions, ...processOptions].find(
        (p) => p.processoId === formData.processoId,
      );
      if (selectedInStatic) return [selectedInStatic, ...base];
    }
    return base;
  }, [
    searchedOptions,
    availableProcessOptions,
    resolvedInitialOption,
    formData.processoId,
    searchFetcher.data,
    triageProcessOptions,
    processOptions,
  ]);

  const selectedProcess = useMemo(
    () =>
      [...triageProcessOptions, ...processOptions, ...searchedOptions].find(
        (process) => process.processoId === formData.processoId,
      ) ??
      resolvedInitialOption ??
      null,
    [processOptions, triageProcessOptions, searchedOptions, formData.processoId, resolvedInitialOption],
  );

  // Busca remota com debounce: só dispara quando o usuário digita (evita 404 inicial).
  // A lista estática `availableProcessOptions` já cobre os processos recentes para seleção inicial.
  useEffect(() => {
    if (!open) return;
    const q = debouncedQuery.trim();
    // Só busca quando há digitação (mín. 2 chars) — evita fetch desnecessário na abertura com pré-preenchimento.
    if (q.length < 2) return;
    const triage = isTriagem || lockTipo === "TRIAGEM" ? "SEM_TRIAGEM" : "ALL";
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("triage", triage);
    if (formData.tipoProfissional) params.set("tipo", formData.tipoProfissional);
    params.set("limit", "20");
    searchFetcher.load(`/api/process-search?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedQuery, isTriagem, lockTipo, formData.tipoProfissional]);

  // Ao abrir, reseta query de busca (mantém lista estática até digitar).
  useEffect(() => {
    if (!open) return;
    setProcessQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Deep-link da fila de triagem: processo e tipo já vêm prontos.
    // Com tipo travado, o tipo é sempre o travado (ex.: TRIAGEM).
    setFormData(
      buildInitialFormData(
        initialProcessoId,
        lockTipo ?? initialTipo,
        gestor.id,
      ),
    );
    setErrors({});
    setAttempted(false);
    setPickerDay(undefined);
  }, [open, initialProcessoId, initialTipo, lockTipo, gestor.id]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok) {
      showToast("Consulta agendada com sucesso.", "success");
      onClose();
      revalidator.revalidate();
      return;
    }
    if ("error" in result && result.error) {
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setErrors(result.fieldErrors as AppointmentFormErrors);
        setAttempted(true);
      }
      showToast(result.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  function updateField<K extends keyof AppointmentFormData>(
    field: K,
    value: AppointmentFormData[K],
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleProcessChange(value: string) {
    const allOptions = [
      ...triageProcessOptions,
      ...processOptions,
      ...searchedOptions,
      ...(resolvedInitialOption ? [resolvedInitialOption] : []),
    ];
    const process = allOptions.find((item) => item.processoId === value);
    // Processo ABERTO sugere TRIAGEM (pré-preenchida com o gestor, com troca
    // para psico/assist — designada, back 30/10). EM_TRIAGEM/ENCAMINHADO
    // aceitam acompanhamento — agendar com o profissional encaminha.
    // Com tipo travado, o tipo nunca muda (só ajusta o profissional).
    const awaitingTriage = process ? isAwaitingTriageProcess(process) : false;
    setFormData((prev) => {
      if (lockTipo) {
        return {
          ...prev,
          processoId: value,
          tipoProfissional: lockTipo,
          profissionalId:
            lockTipo === "TRIAGEM"
              ? prev.profissionalId || gestor.id
              : prev.profissionalId,
        };
      }
      return {
        ...prev,
        processoId: value,
        tipoProfissional: awaitingTriage
          ? "TRIAGEM"
          : prev.tipoProfissional === "TRIAGEM"
            ? ((process?.direcionadoPara as ProfessionalType | null) ?? "")
            : prev.tipoProfissional,
        profissionalId: awaitingTriage
          ? prev.profissionalId || gestor.id
          : prev.tipoProfissional === "TRIAGEM"
            ? ""
            : prev.profissionalId,
      };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.processoId;
      delete next.tipoProfissional;
      delete next.profissionalId;
      return next;
    });
  }

  function handleTypeChange(value: string) {
    const tipo = value as ProfessionalType | "";
    // Trocar de tipo pode invalidar o processo escolhido. TRIAGEM aceita
    // processo ABERTO (e EM_TRIAGEM, pelo back-end); acompanhamento aceita
    // ENCAMINHADO ou EM_TRIAGEM (agendar encaminha automaticamente).
    const allOptions = [
      ...triageProcessOptions,
      ...processOptions,
      ...searchedOptions,
      ...(resolvedInitialOption ? [resolvedInitialOption] : []),
    ];
    const processoAtual = allOptions.find(
      (item) => item.processoId === formData.processoId,
    );
    const processoValido =
      !processoAtual ||
      (tipo === "TRIAGEM"
        ? isTriageProcessOption(processoAtual)
        : processoAtual.status !== "ABERTO");
    setFormData((prev) => {
      const keepTriagemProf =
        tipo === "TRIAGEM" &&
        prev.profissionalId &&
        (prev.profissionalId === gestor.id ||
          professionals.some(
            (p) =>
              p.id === prev.profissionalId &&
              (p.perfil === "PSICOLOGO" || p.perfil === "ASSISTENTE_SOCIAL"),
          ));
      return {
        ...prev,
        tipoProfissional: tipo,
        processoId: processoValido ? prev.processoId : "",
        profissionalId:
          tipo === "TRIAGEM"
            ? keepTriagemProf
              ? prev.profissionalId
              : gestor.id
            : prev.profissionalId &&
                professionals.find((p) => p.id === prev.profissionalId)
                  ?.perfil === tipo
              ? prev.profissionalId
              : "",
      };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.tipoProfissional;
      delete next.profissionalId;
      delete next.processoId;
      return next;
    });
  }

  function shouldShowError(field: keyof AppointmentFormData): boolean {
    return Boolean(errors[field] && attempted);
  }

  function handleModalityChange(value: string) {
    const modalidade = value as AppointmentFormData["modalidade"];
    setFormData((prev) => ({
      ...prev,
      modalidade,
      // Presencial não usa link da sala: limpa valor residual.
      linkMeet: modalidade === "PRESENCIAL" ? "" : prev.linkMeet,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.modalidade;
      delete next.linkMeet;
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    const nextErrors = validateAppointmentForm(formData);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      showToast("Verifique os campos destacados antes de continuar.", "error");
      return;
    }
    setErrors({});
    // Delega para o action central de /manager/consultas (única rota com
    // handler de "agendar"): pacientes/painel/processo-detalhe não têm action
    // próprio e um POST para elas retorna 405 do React Router.
    fetcher.submit(
      {
        intent: "agendar",
        processoId: formData.processoId,
        tipoProfissional: formData.tipoProfissional,
        profissionalId: formData.profissionalId,
        dataLocal: formData.dataLocal,
        dataFim: formData.dataFim,
        modalidade: formData.modalidade,
        linkMeet: formData.linkMeet,
        observacoes: formData.observacoes,
      },
      { method: "post", action: "/manager/consultas" },
    );
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-form-title"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-3 sm:p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="appointment-form-title"
              className="text-lg font-semibold text-gray-800"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {isTriagem
                ? "Agende a triagem inicial. Padrão com você (gestor); troque o responsável para designar a psicologia/assistência."
                : "Agende um acompanhamento. Agendar com o profissional encaminha o processo automaticamente."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-stone-100 hover:text-gray-600 disabled:opacity-50"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Processo <span className="text-red-600">*</span>
            </span>
            <ProcessCombobox
              value={formData.processoId}
              onChange={handleProcessChange}
              options={displayProcessOptions}
              initialOption={resolvedInitialOption}
              onQueryChange={setProcessQuery}
              loading={searchFetcher.state !== "idle"}
              hasError={shouldShowError("processoId")}
              placeholder="Digite nome, campus ou id para buscar"
            />
            <FieldError
              id="error-processo"
              message={shouldShowError("processoId") ? errors.processoId : undefined}
            />
            {selectedProcess ? (
              <p className="mt-1 text-xs text-gray-500">
                {selectedProcess.status === "ABERTO" ? (
                  <>
                    Aguardando triagem · {selectedProcess.totalConsultas}{" "}
                    consulta(s) registrada(s)
                  </>
                ) : selectedProcess.status === "EM_TRIAGEM" ? (
                  <>
                    Triagem registrada · agendar com o profissional encaminha
                    o processo automaticamente
                  </>
                ) : (
                  <>
                    Área de destino:{" "}
                    {getProfessionalTypeLabel(selectedProcess.direcionadoPara)} ·{" "}
                    {selectedProcess.totalConsultas} consulta(s) registrada(s)
                  </>
                )}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {lockTipo ? (
              <div className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Tipo de profissional
                </span>
                <p className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-gray-800">
                  {getProfessionalTypeLabel(lockTipo)}
                </p>
              </div>
            ) : (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Tipo de profissional <span className="text-red-600">*</span>
              </span>
              <select
                name="tipoProfissional"
                value={formData.tipoProfissional}
                onChange={(event) => handleTypeChange(event.target.value)}
                className={fieldClass(shouldShowError("tipoProfissional"))}
                aria-invalid={shouldShowError("tipoProfissional")}
                aria-describedby={
                  shouldShowError("tipoProfissional")
                    ? "error-tipo"
                    : undefined
                }
              >
                <option value="">Selecione o tipo</option>
                {PROFESSIONAL_TYPES.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {getProfessionalTypeLabel(tipo)}
                  </option>
                ))}
              </select>
              <FieldError
                id="error-tipo"
                message={
                  shouldShowError("tipoProfissional")
                    ? errors.tipoProfissional
                    : undefined
                }
              />
            </label>
            )}

            <div className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {isTriagem ? (
                  <>
                    Responsável pela triagem <span className="text-red-600">*</span>
                  </>
                ) : (
                  <>
                    Profissional <span className="text-red-600">*</span>
                  </>
                )}
              </span>
              <select
                name="profissionalId"
                value={formData.profissionalId}
                onChange={(event) =>
                  updateField("profissionalId", event.target.value)
                }
                disabled={!formData.tipoProfissional}
                className={fieldClass(shouldShowError("profissionalId"))}
                aria-invalid={shouldShowError("profissionalId")}
                aria-describedby={
                  shouldShowError("profissionalId")
                    ? "error-profissional"
                    : isTriagem
                      ? "hint-triagem-responsavel"
                      : undefined
                }
              >
                <option value="">
                  {!formData.tipoProfissional
                    ? "Escolha o tipo primeiro"
                    : availableProfessionals.length === 0
                      ? "Nenhum profissional disponível"
                      : isTriagem
                        ? "Selecione o responsável"
                        : "Selecione o profissional"}
                </option>
                {isTriagem ? (
                  <>
                    <optgroup label="Você (gestor)">
                      <option value={gestorOption.id}>
                        {gestorOption.nome} — triagem própria
                      </option>
                    </optgroup>
                    <optgroup label="Designar para profissional">
                      {triagemPsicoAssist.map((professional) => (
                        <option key={professional.id} value={professional.id}>
                          {professional.nome}
                          {professional.registro
                            ? ` (${professional.registro})`
                            : ""}
                          {` — ${professional.perfil === "PSICOLOGO" ? "psicologia" : "assistência social"}`}
                        </option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  availableProfessionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.nome}
                      {professional.registro
                        ? ` (${professional.registro})`
                        : ""}
                    </option>
                  ))
                )}
              </select>
              <FieldError
                id="error-profissional"
                message={
                  shouldShowError("profissionalId")
                    ? errors.profissionalId
                    : undefined
                }
              />
              {isTriagem && !shouldShowError("profissionalId") ? (
                <p
                  id="hint-triagem-responsavel"
                  className="mt-1 text-xs text-gray-500"
                >
                  Padrão: você (gestor). Troque para designar a 1ª conversa a
                  psicologia/assistência — o designado registra triagem + FRIDA.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4">
          <div className="block">
              <span
                id="data-hora-label"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Data e horário <span className="text-red-600">*</span>
              </span>
              <IntervalDateTimePicker
                value={{ start: formData.dataLocal, end: formData.dataFim }}
                selectedDay={pickerDay}
                onDayChange={setPickerDay}
                dayAppointments={dayAppointments}
                onChange={({ start, end }) => {
                  setFormData((prev) => ({
                    ...prev,
                    dataLocal: start,
                    dataFim: end,
                  }));
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.dataLocal;
                    delete next.dataFim;
                    return next;
                  });
                }}
                occupiedIntervals={occupiedIntervals}
                hasError={
                  shouldShowError("dataLocal") || shouldShowError("dataFim")
                }
                errorId={
                  shouldShowError("dataLocal")
                    ? "error-data"
                    : shouldShowError("dataFim")
                      ? "error-data-fim"
                      : undefined
                }
              />
              <FieldError
                id="error-data"
                message={
                  shouldShowError("dataLocal")
                    ? errors.dataLocal
                    : shouldShowError("dataFim")
                      ? errors.dataFim
                      : undefined
                }
              />
              {conflictInterval && !shouldShowError("dataFim") ? (
                <p role="alert" className="mt-1 text-xs font-semibold text-[#854F0B]">
                  Profissional ocupado{" "}
                  {formatInterval(
                    new Date(conflictInterval.start).toISOString(),
                    new Date(conflictInterval.end).toISOString(),
                  )}
                  . Escolha outro horário.
                </p>
              ) : null}
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Modalidade <span className="text-red-600">*</span>
              </span>
              <select
                name="modalidade"
                value={formData.modalidade}
                onChange={(event) =>
                  handleModalityChange(event.target.value)
                }
                className={fieldClass(shouldShowError("modalidade"))}
                aria-invalid={shouldShowError("modalidade")}
                aria-describedby={
                  shouldShowError("modalidade")
                    ? "error-modalidade"
                    : undefined
                }
              >
                <option value="">Selecione a modalidade</option>
                <option value="PRESENCIAL">Presencial</option>
                <option value="ONLINE">Online</option>
              </select>
              <FieldError
                id="error-modalidade"
                message={
                  shouldShowError("modalidade")
                    ? errors.modalidade
                    : undefined
                }
              />
            </label>
          </div>

          {formData.modalidade === "PRESENCIAL" ? (
            <div className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Link da sala{" "}
                <span className="font-normal text-gray-400">
                  (não se aplica a presencial)
                </span>
              </span>
              <input
                type="url"
                value=""
                disabled
                placeholder="—"
                aria-disabled="true"
                className="w-full rounded-xl border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-gray-400 shadow-sm"
              />
              <FieldError
                id="error-link"
                message={
                  shouldShowError("linkMeet") ? errors.linkMeet : undefined
                }
              />
            </div>
          ) : (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Link da sala{" "}
                {formData.modalidade === "ONLINE" ? (
                  <span className="text-red-600">*</span>
                ) : (
                  <span className="font-normal text-gray-400">(opcional)</span>
                )}
              </span>
              <input
                type="url"
                name="linkMeet"
                value={formData.linkMeet}
                onChange={(event) => updateField("linkMeet", event.target.value)}
                placeholder="https://meet.google.com/…"
                className={fieldClass(shouldShowError("linkMeet"))}
                aria-invalid={shouldShowError("linkMeet")}
                aria-describedby={
                  shouldShowError("linkMeet") ? "error-link" : "hint-link"
                }
              />
              {shouldShowError("linkMeet") ? (
                <p id="error-link" className="mt-1 text-xs text-red-700">
                  {errors.linkMeet}
                </p>
              ) : (
                <p id="hint-link" className="mt-1 text-xs text-gray-500">
                  {formData.modalidade === "ONLINE"
                    ? "Informe o link da videochamada para a vítima e o profissional acessarem."
                    : "Pode ser preenchido depois; a vítima e o profissional serão avisados quando a sala estiver disponível."}
                </p>
              )}
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Observações (opcional)
            </span>
            <textarea
              name="observacoes"
              rows={3}
              value={formData.observacoes}
              onChange={(event) =>
                updateField("observacoes", event.target.value)
              }
              placeholder="Informações internas sobre o agendamento"
              className={fieldClass(shouldShowError("observacoes"))}
              aria-invalid={shouldShowError("observacoes")}
              aria-describedby={
                shouldShowError("observacoes")
                  ? "error-observacoes"
                  : undefined
              }
            />
            <FieldError
              id="error-observacoes"
              message={
                shouldShowError("observacoes")
                  ? errors.observacoes
                  : undefined
              }
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
              className="min-w-28 bg-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              className="min-w-32"
            >
              {busy ? "Agendando…" : "Agendar consulta"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AppointmentForm;
