import { useEffect } from "react";
import { cn } from "../../libs/utils";
import { Button } from "./Button";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  consequences?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: "primary" | "secondary" | "outline" | "danger";
}

export function ConfirmModal({
  open,
  title,
  description,
  consequences,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  loading = false,
  children,
  onConfirm,
  onCancel,
  confirmVariant = "danger",
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-stone-200 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="confirm-modal-title"
          className="text-lg font-semibold text-gray-800"
        >
          {title}
        </h2>
        <p
          id="confirm-modal-description"
          className="mt-2 text-sm text-gray-600 leading-relaxed"
        >
          {description}
        </p>
        {consequences ? (
          <p className="mt-3 text-sm bg-[#FCEBEB] border border-red-200 text-[#791F1F] px-3 py-2.5 rounded-lg leading-snug">
            {consequences}
          </p>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className={cn("min-w-28")}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            loading={loading}
            className={cn("min-w-28")}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
