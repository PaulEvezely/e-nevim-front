import { useEffect, useId, useMemo, useRef, useState } from "react";

interface CityComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  cities: string[];
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function CityCombobox({
  id,
  value,
  onChange,
  onBlur,
  cities,
  disabled = false,
  hasError = false,
  placeholder = "Digite para buscar a cidade",
}: CityComboboxProps) {
  const autoId = useId();
  const inputId = id ?? `city-combobox-${autoId}`;
  const listboxId = `${inputId}-listbox`;
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeout = useRef<number | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    if (!normalizedQuery) return cities.slice(0, 50);
    return cities
      .filter((city) => normalizeText(city).includes(normalizedQuery))
      .slice(0, 50);
  }, [cities, query]);

  function handleFocus() {
    if (blurTimeout.current) {
      window.clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }
    if (!disabled) setIsOpen(true);
  }

  function findCanonicalMatch(text: string): string | undefined {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    const exact = cities.find((city) => city === trimmed);
    if (exact) return exact;
    const normalized = normalizeText(trimmed);
    return cities.find((city) => normalizeText(city) === normalized);
  }

  function handleBlur() {
    blurTimeout.current = window.setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        if (value) {
          onChange("");
          setQuery("");
        }
      } else {
        const match = findCanonicalMatch(trimmedQuery);
        if (match) {
          if (match !== value) {
            onChange(match);
            setQuery(match);
          }
        } else {
          setQuery(value);
        }
      }
      onBlur?.();
    }, 150);
  }

  function selectCity(city: string) {
    onChange(city);
    setQuery(city);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function handleInputChange(next: string) {
    setQuery(next);
    setHighlightedIndex(-1);
    if (!isOpen) setIsOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" && isOpen && filtered.length > 0) {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === "ArrowUp" && isOpen && filtered.length > 0) {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev <= 0 ? filtered.length - 1 : prev - 1,
      );
    } else if (e.key === "Enter" && isOpen) {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const selected = filtered[highlightedIndex];
        if (selected) selectCity(selected);
      } else {
        const match = findCanonicalMatch(query);
        e.preventDefault();
        e.stopPropagation();
        if (match) {
          selectCity(match);
        } else {
          setQuery(value);
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
      }
    } else if (e.key === "Escape") {
      setQuery(value);
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  function handleClear() {
    onChange("");
    setQuery("");
    setIsOpen(true);
    setHighlightedIndex(-1);
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
        {(value || query) && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpar cidade"
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
        )}
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Sugestões de cidades"
          className="absolute z-20 mt-1.5 w-full max-h-56 overflow-y-auto bg-white border border-stone-200 rounded-md shadow-xl py-1 text-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-gray-500 text-sm">
              Nenhuma cidade encontrada para &ldquo;{query}&rdquo;.
            </li>
          ) : (
            filtered.map((city, index) => {
              const isHighlighted = index === highlightedIndex;
              const isSelected = city === value;
              return (
                <li
                  key={city}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectCity(city);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    isHighlighted
                      ? "bg-[#E6F1FB] text-[#0C447C]"
                      : isSelected
                        ? "bg-stone-100 text-gray-800 font-medium"
                        : "text-gray-700 hover:bg-stone-50"
                  }`}
                >
                  {city}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
