import { useEffect, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { Button } from "../../../shared/components/Button";
import { formatDateTime } from "../../../shared/utils/date";
import {
  detailsFromAppointment,
  validateAppointmentDetails,
  type AppointmentActionData,
  type AppointmentDetailsErrors,
  type AppointmentDetailsFormData,
  type ManagerAppointmentItem,
} from "../appointmentUtils";

type ShowToast = (message: string, type?: "success" | "error") => void;

type AppointmentEditFormProps = {
  appointment: ManagerAppointmentItem;
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

export function AppointmentEditForm({
  appointment,
  onClose,
  showToast,
}: AppointmentEditFormProps) {
  const fetcher = useFetcher<AppointmentActionData>();
  const revalidator = useRevalidator();
  const [formData, setFormData] = useState<AppointmentDetailsFormData>(() =>
    detailsFromAppointment(appointment),
  );
  const [errors, setErrors] = useState<AppointmentDetailsErrors>({});
  const [attempted, setAttempted] = useState(false);

  const busy = fetcher.state !== "idle";

  useEffect(() => {
    setFormData(detailsFromAppointment(appointment));
    setErrors({});
    setAttempted(false);
  }, [appointment]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok) {
      showToast("Consulta atualizada com sucesso.", "success");
      onClose();
      revalidator.revalidate();
      return;
    }
    if ("error" in result && result.error) {
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setErrors(result.fieldErrors as AppointmentDetailsErrors);
        setAttempted(true);
      }
      showToast(result.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  function updateField<K extends keyof AppointmentDetailsFormData>(
    field: K,
    value: AppointmentDetailsFormData[K],
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function shouldShowError(field: keyof AppointmentDetailsFormData): boolean {
    return Boolean(errors[field] && attempted);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    const nextErrors = validateAppointmentDetails(formData, appointment.dataHora);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      showToast("Verifique os campos destacados antes de continuar.", "error");
      return;
    }
    setErrors({});
    fetcher.submit(
      {
        intent: "editar",
        id: appointment.id,
        linkMeet: formData.linkMeet,
        modalidade: formData.modalidade,
        observacoes: formData.observacoes,
        dataFim: formData.dataFim,
      },
      { method: "post" },
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-edit-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="appointment-edit-title"
              className="text-lg font-semibold text-gray-800"
            >
              Editar consulta
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Atualize o horário de término, a sala, a modalidade ou as
              observações internas. Início, profissional e processo não podem
              ser alterados.
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Início (fixo)
              </span>
              <p className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-gray-600">
                {formatDateTime(appointment.dataHora)}
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Término
              </span>
              <input
                type="datetime-local"
                name="dataFim"
                value={formData.dataFim}
                onChange={(event) => updateField("dataFim", event.target.value)}
                className={fieldClass(shouldShowError("dataFim"))}
                aria-invalid={shouldShowError("dataFim")}
                aria-describedby={
                  shouldShowError("dataFim") ? "edit-error-dataFim" : "edit-hint-dataFim"
                }
              />
              {shouldShowError("dataFim") ? (
                <p id="edit-error-dataFim" className="mt-1 text-xs text-red-700">
                  {errors.dataFim}
                </p>
              ) : (
                <p id="edit-hint-dataFim" className="mt-1 text-xs text-gray-500">
                  Deve ser após o início, futuro e com no máximo 8h de duração.
                </p>
              )}
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Modalidade
            </span>
            <select
              name="modalidade"
              value={formData.modalidade}
              onChange={(event) =>
                updateField(
                  "modalidade",
                  event.target.value as AppointmentDetailsFormData["modalidade"],
                )
              }
              className={inputClass}
            >
              <option value="">Não informada</option>
              <option value="PRESENCIAL">Presencial</option>
              <option value="ONLINE">Online</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Link da sala
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
                shouldShowError("linkMeet") ? "edit-error-link" : "edit-hint-link"
              }
            />
            {shouldShowError("linkMeet") ? (
              <p id="edit-error-link" className="mt-1 text-xs text-red-700">
                {errors.linkMeet}
              </p>
            ) : (
              <p id="edit-hint-link" className="mt-1 text-xs text-gray-500">
                Ao preencher uma sala nova, a vítima e o profissional são
                notificados automaticamente.
              </p>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Observações
            </span>
            <textarea
              name="observacoes"
              rows={4}
              value={formData.observacoes}
              onChange={(event) =>
                updateField("observacoes", event.target.value)
              }
              placeholder="Informações internas sobre o atendimento"
              className={fieldClass(shouldShowError("observacoes"))}
              aria-invalid={shouldShowError("observacoes")}
              aria-describedby={
                shouldShowError("observacoes")
                  ? "edit-error-observacoes"
                  : undefined
              }
            />
            {shouldShowError("observacoes") ? (
              <p
                id="edit-error-observacoes"
                className="mt-1 text-xs text-red-700"
              >
                {errors.observacoes}
              </p>
            ) : null}
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
              Salvar alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AppointmentEditForm;
