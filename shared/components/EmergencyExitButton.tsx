import { useEffect, useCallback, useState } from "react";
import { DecoyClima } from "./DecoyClima";

interface EmergencyExitButtonProps {
  redirectUrl?: string;
  label?: string;
  className?: string;
  enableEscShortcut?: boolean;
  onExit?: () => void;
  /** Quando true (padrão), exibe a tela disfarçada de clima por cima do app em vez de navegar. */
  useDecoy?: boolean;
}

export function EmergencyExitButton({
  redirectUrl = "https://www.google.com",
  label = "Saída rápida",
  className = "",
  enableEscShortcut = true,
  onExit,
  useDecoy = true,
}: EmergencyExitButtonProps) {
  const [showDecoy, setShowDecoy] = useState(false);

  const handleExit = useCallback(() => {
    onExit?.();
    if (!useDecoy) {
      window.location.replace(redirectUrl);
      return;
    }
    try {
      window.history.replaceState(null, "", "/");
      document.title = "Previsão do Tempo - ClimaHoje";
    } catch {
      // replaceState pode falhar em alguns contextos; o overlay ainda cobre a tela.
    }
    setShowDecoy(true);
  }, [redirectUrl, onExit, useDecoy]);

  useEffect(() => {
    if (!enableEscShortcut) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleExit();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enableEscShortcut, handleExit]);

  if (showDecoy) {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-white">
        <DecoyClima />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleExit}
      aria-label="Saída rápida - mostra tela neutra"
      title="Saída rápida - clique para sair imediatamente (ESC)"
      className={`fixed bottom-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-3 rounded-full shadow-xl flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-4 h-4"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
        />
      </svg>
      {label}
    </button>
  );
}

export default EmergencyExitButton;
