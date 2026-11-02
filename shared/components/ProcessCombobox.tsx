import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AppointmentProcessOption } from "../../features/manager/appointmentUtils";
import { getProcessOptionLabel } from "../../features/manager/appointmentUtils";

interface ProcessComboboxProps {
  id?: string;
  value: string; // processoId
  onChange: (processoId: string) => void;
  options: AppointmentProcessOption[];
  loading?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
  initialOption?: AppointmentProcessOption | null;
  onQueryChange?: (query: string) => void;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function ProcessCombobox({
  id,
  value,
  onChange,
  options,
  loading = false,
  disabled = false,
  hasError = false,
  placeholder = "Digite nome, campus ou id do processo",
  initialOption,
  onQueryChange,
}: ProcessComboboxProps) {
  const autoId = useId();
  const inputId = id ?? `process-combobox-${autoId}`;
  const listboxId = `${inputId}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeout = useRef<number | null>(null);

  // Mapa de id -> option para label rápido (inclui initialOption)
  const optionMap = useMemo(() => {
    const map = new Map<string, AppointmentProcessOption>();
    for (const opt of options) map.set(opt.processoId, opt);
    if (initialOption) map.set(initialOption.processoId, initialOption);
    return map;
  }, [options, initialOption]);

  const selectedOption = value ? optionMap.get(value) ?? null : null;
  const selectedLabel = selectedOption ? getProcessOptionLabel(selectedOption) : "";

  const [query, setQuery] = useState(selectedLabel);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Sincroniza query com value externo (ex: pré-preenchimento via Pacientes)
  useEffect(() => {
    const label = selectedOption ? getProcessOptionLabel(selectedOption) : "";
    setQuery(label);
  }, [value, selectedOption]);

  // Notifica busca ao pai (debounced no pai ou aqui via efeito)
  useEffect(() => {
    if (!isOpen) return;
    onQueryChange?.(query);
  }, [query, isOpen, onQueryChange]);

  const filtered = options;

  function handleFocus() {
    if (blurTimeout.current) {
      window.clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }
    if (!disabled) {
      setIsOpen(true);
      // Ao focar vazio, dispara busca inicial
      onQueryChange?.(query);
    }
  }

  function handleBlur() {
    blurTimeout.current = window.setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
      // Restaura label canônico se houver seleção, senão limpa se query vazia
      if (!query.trim()) {
        if (value) onChange("");
        setQuery("");
      } else if (selectedOption) {
        setQuery(getProcessOptionLabel(selectedOption));
      } else if (!value) {
        // Sem seleção, mantém query para continuar buscando, mas não força valor
        // Se usuário digitou e não selecionou, não seta processoId
      }
    }, 150);
  }

  function selectOption(option: AppointmentProcessOption) {
    onChange(option.processoId);
    setQuery(getProcessOptionLabel(option));
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function handleInputChange(next: string) {
    setQuery(next);
    setHighlightedIndex(-1);
    if (!isOpen) setIsOpen(true);
    // Se usuário está digitando e tinha valor, limpa seleção até escolher
    if (value && next !== selectedLabel) {
      onChange("");
    }
  }

  function handleClear() {
    onChange("");
    setQuery("");
    setIsOpen(true);
    setHighlightedIndex(-1);
    onQueryChange?.("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" && isOpen && filtered.length > 0) {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === "ArrowUp" && isOpen && filtered.length > 0) {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
    } else if (e.key === "Enter" && isOpen) {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const opt = filtered[highlightedIndex];
        if (opt) selectOption(opt);
      } else if (filtered.length === 1) {
        // Enter com 1 resultado seleciona direto
        e.preventDefault();
        e.stopPropagation();
        selectOption(filtered[0]);
      }
    } else if (e.key === "Escape") {
      setQuery(selectedLabel);
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  const showDropdown = isOpen && !disabled;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={hasError}
          aria-describedby={hasError ? `error-${inputId}` : undefined}
          className={`w-full bg-white p-2.5 pr-10 rounded-md outline-none shadow-inner border text-sm transition-all placeholder:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed ${
            hasError
              ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
              : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
          }`}
        />
        {(value || query) && !disabled ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpar processo"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 rounded p-0.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        ) : null}
      </div>

      {showDropdown ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Processos disponíveis"
          className="absolute z-20 mt-1.5 w-full max-h-64 overflow-y-auto bg-white border border-stone-200 rounded-md shadow-xl py-1 text-sm"
        >
          {loading ? (
            <li className="px-3 py-2.5 text-gray-500 text-sm">Buscando…</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-gray-500 text-sm">
              {query.trim() ? `Nenhum processo para “${query.trim()}”.` : "Digite para buscar processos."}
            </li>
          ) : (
            filtered.map((opt, index) => {
              const isHighlighted = index === highlightedIndex;
              const isSelected = opt.processoId === value;
              return (
                <li
                  key={opt.processoId}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(opt);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-3 py-2.5 cursor-pointer transition-colors border-b border-stone-100 last:border-0 ${
                    isHighlighted
                      ? "bg-[#E6F1FB] text-[#0C447C]"
                      : isSelected
                        ? "bg-stone-100 text-gray-800 font-medium"
                        : "text-gray-700 hover:bg-stone-50"
                  }`}
                >
                  <span className="block font-medium leading-tight">{opt.vitimaNome?.trim() || "Sem nome"}</span>
                  <span className="block text-xs text-gray-500 leading-tight mt-0.5">
                    {opt.vitimaCampus?.trim() ? `${opt.vitimaCampus} · ` : ""}
                    {opt.processoId.slice(0, 8)} · {opt.status}
                    {opt.direcionadoPara ? ` · ${opt.direcionadoPara}` : ""}
                    {opt.totalConsultas ? ` · ${opt.totalConsultas} consulta(s)` : ""}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default ProcessCombobox;
