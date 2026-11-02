import { useCallback, useEffect, useRef, useState } from "react";
import type { ToastData } from "../components/Toast";

const DEFAULT_DURATION_MS = 4000;

interface UseToastOptions {
  durationMs?: number;
}

/** Estado de toast reutilizável (RFF12) com auto-dismiss e limpeza. */
export function useToast(options?: UseToastOptions) {
  const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
  const [toast, setToast] = useState<ToastData | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearToast = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastData["type"] = "success") => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      setToast({ message, type });
      timeoutRef.current = window.setTimeout(() => {
        setToast(null);
        timeoutRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  useEffect(() => clearToast, [clearToast]);

  return { toast, showToast, clearToast };
}

export default useToast;
