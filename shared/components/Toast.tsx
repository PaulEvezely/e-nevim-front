import { cn } from "../../libs/utils";

export type ToastData = {
  message: string;
  type: "success" | "error";
};

interface ToastProps {
  toast: ToastData | null;
  className?: string;
}

/** Feedback visual global pós-ação de escrita (RFF12). */
export function Toast({ toast, className }: ToastProps) {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-medium max-w-[90vw] sm:max-w-md flex items-center gap-2.5 border",
        toast.type === "success"
          ? "bg-[#EAF3DE] text-[#27500A] border-[#EAF3DE]"
          : "bg-[#FCEBEB] text-[#791F1F] border-red-200",
        className,
      )}
    >
      {toast.type === "success" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 flex-shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 flex-shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span className="leading-snug">{toast.message}</span>
    </div>
  );
}

export default Toast;
