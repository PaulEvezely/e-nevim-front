import { useEffect, useState } from "react";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import {
  EXTERNAL_REFERRAL_DETALHES_MAX,
  EXTERNAL_REFERRAL_DETALHES_MIN,
  EXTERNAL_REFERRAL_DESTINOS,
  EXTERNAL_REFERRAL_LABELS,
  validateExternalReferralForm,
  type ExternalReferralDestino,
} from "../externalReferral";

type EncaminharExternoFormErrors = Partial<
  Record<"destino" | "detalhes", string>
>;

type EncaminharExternoModalProps = {
  open: boolean;
  loading: boolean;
  fieldErrors?: EncaminharExternoFormErrors;
  serverError?: string | null;
  onClose: () => void;
  onConfirm: (destino: ExternalReferralDestino, detalhes: string) => void;
};

export function EncaminharExternoModal({
  open,
  loading,
  fieldErrors,
  serverError,
  onClose,
  onConfirm,
}: EncaminharExternoModalProps) {
  const [destino, setDestino] = useState<ExternalReferralDestino | "">("");
  const [detalhes, setDetalhes] = useState("");
  const [localErrors, setLocalErrors] =
    useState<EncaminharExternoFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setDestino("");
    setDetalhes("");
    setLocalErrors({});
  }, [open]);

  function handleConfirm() {
    if (loading) return;
    const next = validateExternalReferralForm({ destino, detalhes });
    setLocalErrors(next);
    if (Object.keys(next).length > 0 || !destino) return;
    onConfirm(destino, detalhes.trim());
  }

  const destinoError = localErrors.destino ?? fieldErrors?.destino;
  const detalhesError = localErrors.detalhes ?? fieldErrors?.detalhes;

  return (
    <ConfirmModal
      open={open}
      title="Encaminhar para órgão externo"
      description="O processo será marcado como encaminhado para o órgão selecionado. Esta ação fica registrada no histórico do processo."
      confirmLabel={loading ? "Enviando…" : "Confirmar encaminhamento"}
      confirmVariant="primary"
      cancelLabel="Voltar"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={() => {
        if (!loading) onClose();
      }}
    >
      {serverError ? (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {serverError}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          Órgão de destino <span className="text-red-600">*</span>
        </span>
        <select
          value={destino}
          onChange={(event) => {
            setDestino(event.target.value as ExternalReferralDestino | "");
            setLocalErrors((prev) => {
              if (!prev.destino) return prev;
              const next = { ...prev };
              delete next.destino;
              return next;
            });
          }}
          disabled={loading}
          aria-invalid={Boolean(destinoError)}
          className={
            destinoError
              ? "w-full rounded-xl border border-red-400 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
              : "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30"
          }
        >
          <option value="">Selecione…</option>
          {EXTERNAL_REFERRAL_DESTINOS.map((option) => (
            <option key={option} value={option}>
              {EXTERNAL_REFERRAL_LABELS[option]}
            </option>
          ))}
        </select>
        {destinoError ? (
          <span className="mt-1 block text-xs text-red-700">{destinoError}</span>
        ) : null}
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          Detalhes do encaminhamento <span className="text-red-600">*</span>
        </span>
        <textarea
          value={detalhes}
          onChange={(event) => {
            setDetalhes(event.target.value);
            setLocalErrors((prev) => {
              if (!prev.detalhes) return prev;
              const next = { ...prev };
              delete next.detalhes;
              return next;
            });
          }}
          rows={4}
          maxLength={EXTERNAL_REFERRAL_DETALHES_MAX + 100}
          placeholder="Ex.: encaminhada para atendimento psicossocial na rede municipal, com retorno em 30 dias…"
          disabled={loading}
          aria-invalid={Boolean(detalhesError)}
          className={
            detalhesError
              ? "w-full rounded-xl border border-red-400 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
              : "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30"
          }
        />
        <span className="mt-1 flex items-center justify-between text-xs text-gray-500">
          <span>
            {detalhesError ? (
              <span className="text-red-700">{detalhesError}</span>
            ) : (
              <span>
                Mínimo {EXTERNAL_REFERRAL_DETALHES_MIN} caracteres, máximo{" "}
                {EXTERNAL_REFERRAL_DETALHES_MAX}.
              </span>
            )}
          </span>
          <span aria-hidden="true">
            {detalhes.length}/{EXTERNAL_REFERRAL_DETALHES_MAX}
          </span>
        </span>
      </label>
    </ConfirmModal>
  );
}

export default EncaminharExternoModal;
