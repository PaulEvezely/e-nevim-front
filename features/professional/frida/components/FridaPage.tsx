import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import {
  formatDate,
  formatDateTime,
  formatTime,
  getAppointmentStatusLabel,
  getProfessionalTypeLabel,
} from "../../../manager/appointmentUtils";
import { shortId } from "../../../manager/managerUtils";
import { Toast } from "../../../../shared/components/Toast";
import { useToast } from "../../../../shared/hooks/useToast";
import { clearSavedDraft, clearSessionDraft } from "../fridaDraft";
import type { FridaActionData, FridaPageData } from "../fridaPageTypes";
import { FridaForm, type FridaFormSubmit } from "./FridaForm";
import { FridaReadOnly } from "./FridaReadOnly";
import { FridaRiskBadge } from "./FridaRiskBadge";

type FridaPageProps = {
  data: FridaPageData;
  backHref: string;
  backLabel: string;
};

export function FridaPage({ data, backHref, backLabel }: FridaPageProps) {
  const { toast, showToast } = useToast();
  const fetcher = useFetcher<FridaActionData>();
  const busy = fetcher.state !== "idle";
  const appointmentId = data.ok ? data.appointment.id : null;

  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || !result) return;
    if (result.ok) {
      if (appointmentId) {
        clearSessionDraft(appointmentId);
        clearSavedDraft(appointmentId);
      }
      showToast(
        result.mode === "create"
          ? "FRIDA salvo com sucesso."
          : "FRIDA atualizado com sucesso.",
        "success",
      );
    } else {
      showToast(result.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  if (!data.ok) {
    return (
      <section className="mx-auto max-w-3xl p-4 lg:p-6" aria-label="FRIDA">
        <Link
          to={backHref}
          className="text-xs font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
        >
          ← {backLabel}
        </Link>
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]"
        >
          {data.loadError}
        </div>
        <Toast toast={toast} />
      </section>
    );
  }

  const { appointment, frida, mode, blockReason, initialDraft } = data;
  const typeLabel = getProfessionalTypeLabel(appointment.tipoProfissional);
  const canSubmit = mode === "create" || mode === "edit";
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const serverError =
    fetcher.state === "idle" && fetcher.data && !fetcher.data.ok
      ? fetcher.data.error
      : null;

  async function handleGeneratePdf() {
    if (!frida || generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const { parseFridaRespostas } = await import("../fridaTypes");
      const { buildFridaPdf, fridaPdfFilename } = await import("../fridaPdf");
      const respostas = parseFridaRespostas(frida.respostas);
      const { save } = await buildFridaPdf({
        processoIdCurto: appointment.processoId.slice(0, 8),
        consultaTipo: typeLabel,
        consultaQuando: `${formatDate(appointment.dataHora)} às ${formatTime(appointment.dataHora)}`,
        consultaStatus: getAppointmentStatusLabel(appointment.status),
        registradoEm: formatDateTime(frida.criadoEm),
        nivelRiscoAtribuido: frida.nivelRisco,
        respostas,
      });
      save(fridaPdfFilename(appointment.processoId));
      showToast("PDF do FRIDA gerado. Arquivo sigiloso — não compartilhe.", "success");
    } catch {
      showToast("Não foi possível gerar o PDF. Tente novamente.", "error");
    } finally {
      setGeneratingPdf(false);
    }
  }

  function handleSubmit(value: FridaFormSubmit) {
    fetcher.submit(
      {
        intent: mode === "edit" ? "update" : "create",
        fridaId: frida?.id ?? "",
        respostas: JSON.stringify(value.respostas),
        nivelRisco: value.nivelRisco,
      },
      { method: "post" },
    );
  }

  return (
    <section className="mx-auto max-w-3xl p-4 lg:p-6" aria-label="FRIDA">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backHref}
          className="text-xs font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
        >
          ← {backLabel}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {frida ? (
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              title="Baixar o formulário FRIDA completo em PDF (documento sigiloso)"
              className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:border-[#378ADD] hover:text-[#0C447C] disabled:opacity-60"
            >
              {generatingPdf ? "Gerando PDF…" : "Gerar PDF"}
            </button>
          ) : null}
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600">
            {getAppointmentStatusLabel(appointment.status)}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            FRIDA — {typeLabel}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Consulta em {formatDate(appointment.dataHora)} às{" "}
            {formatTime(appointment.dataHora)} · Processo{" "}
            <span className="font-mono" title={appointment.processoId}>
              {shortId(appointment.processoId)}
            </span>
          </p>
        </div>
        {frida ? <FridaRiskBadge level={frida.nivelRisco} /> : null}
      </div>

      {mode === "blocked" ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-[#FAEEDA] bg-[#FAEEDA] px-4 py-3 text-sm text-[#854F0B]"
        >
          {blockReason}
        </div>
      ) : null}

      {mode === "read" && frida ? (
        <div className="mt-4">
          <p className="mb-3 rounded-xl border border-[#E6F1FB] bg-[#E6F1FB] px-4 py-3 text-sm text-[#0C447C]">
            Você está visualizando o FRIDA registrado. Apenas o autor ou um gestor
            podem corrigi-lo.
          </p>
          <FridaReadOnly frida={frida} />
        </div>
      ) : null}

      {canSubmit ? (
        <div className="mt-4 space-y-3">
          {mode === "edit" ? (
            <p className="rounded-xl border border-[#FAEEDA] bg-[#FAEEDA] px-4 py-3 text-sm text-[#854F0B]">
              Correção: as respostas salvas substituirão as anteriores. A alteração
              fica registrada na auditoria.
            </p>
          ) : null}
          <FridaForm
            consultaId={appointment.id}
            initialDraft={initialDraft}
            onSubmit={handleSubmit}
            busy={busy}
            serverError={serverError}
            submitLabel={mode === "edit" ? "Salvar correção" : "Salvar FRIDA"}
          />
        </div>
      ) : null}

      <Toast toast={toast} />
    </section>
  );
}

export default FridaPage;
