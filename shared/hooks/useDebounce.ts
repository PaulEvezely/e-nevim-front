import { useEffect, useState } from "react";

/**
 * Debounce de valor — atualiza após `delayMs` sem mudanças.
 * Usado para busca digitável (evita request a cada tecla).
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

export default useDebouncedValue;
