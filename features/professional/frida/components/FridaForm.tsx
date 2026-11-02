import { useEffect, useMemo, useRef, useState } from "react";
import { FridaQuestionField } from "./FridaQuestionField";
import { FridaRiskBadge } from "./FridaRiskBadge";
import { FridaStructuredAssessment } from "./FridaStructuredAssessment";
import {
  readSavedDraft,
  readSessionDraft,
  saveSavedDraft,
  saveSessionDraft,
} from "../fridaDraft";
import { FRIDA_QUESTIONS } from "../fridaQuestions";
import {
  calculateRiskLevel,
  resolveAttributedRisk,
  summarizeAnswers,
} from "../fridaScoring";
import {
  createEmptyFridaDraft,
  type FridaAnswerValue,
  type FridaDraft,
  type FridaRespostasPayload,
  type RiskLevel,
} from "../fridaTypes";
import {
  validateFridaDraft,
  type FridaFieldErrors,
} from "../fridaValidation";

export type FridaFormSubmit = {
  respostas: FridaRespostasPayload;
  nivelRisco: RiskLevel;
};

type FridaFormProps = {
  consultaId: string;
  /** Rascunho/editação existente; se ausente, usa o rascunho salvo no browser. */
  initialDraft?: FridaDraft | null;
  onSubmit: (value: FridaFormSubmit) => void;
  onSaveDraft?: () => void;
  busy?: boolean;
  serverError?: string | null;
  submitLabel?: string;
};

export function FridaForm({
  consultaId,
  initialDraft = null,
  onSubmit,
  onSaveDraft,
  busy = false,
  serverError = null,
  submitLabel = "Salvar FRIDA",
}: FridaFormProps) {
  const [draft, setDraft] = useState<FridaDraft>(() =>
    initialDraft ?? createEmptyFridaDraft(consultaId),
  );
  const [attempted, setAttempted] = useState(false);
  const [questionErrors, setQuestionErrors] = useState<FridaFieldErrors>({});
  const [assessmentErrors, setAssessmentErrors] = useState<FridaFieldErrors>({});
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const restoredRef = useRef(false);

  /**
   * Assinatura do rascunho inicial: evita resetar o formulário quando o
   * pai reconstrói o objeto a cada render (o conteúdo, não a identidade,
   * define a mudança).
   */
  const initialSignature = initialDraft
    ? JSON.stringify(initialDraft)
    : `novo:${consultaId}`;
  const appliedSignatureRef = useRef(initialSignature);

  useEffect(() => {
    if (appliedSignatureRef.current === initialSignature) return;
    appliedSignatureRef.current = initialSignature;
    restoredRef.current = false;
    setHydrated(false);
    setDraft(initialDraft ?? createEmptyFridaDraft(consultaId));
    setAttempted(false);
    setQuestionErrors({});
    setAssessmentErrors({});
    setDraftNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSignature]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (initialDraft) {
      setHydrated(true);
      return;
    }

    const sessionDraft = readSessionDraft(consultaId);
    const savedDraft = readSavedDraft(consultaId);
    const newest = compareDrafts(sessionDraft, savedDraft);
    setHydrated(true);
    if (!newest) return;

    setDraft(newest);
    setDraftNotice(
      savedDraft &&
      (!sessionDraft || savedDraft.updatedAt > sessionDraft.updatedAt)
        ? "Rascunho salvo restaurado."
        : "Rascunho em andamento restaurado.",
    );
  }, [consultaId, initialDraft]);

  useEffect(() => {
    if (!hydrated) return;
    saveSessionDraft(draft);
  }, [draft, hydrated]);

  const summary = useMemo(
    () => summarizeAnswers(draft.answers),
    [draft.answers],
  );
  const calculatedRisk = useMemo(
    () => calculateRiskLevel(draft.answers),
    [draft.answers],
  );

  function updateDraft(update: (previous: FridaDraft) => FridaDraft) {
    setDraft((previous) => update(previous));
  }

  function handleAnswer(questionId: string, value: FridaAnswerValue) {
    updateDraft((previous) => {
      const answers = { ...previous.answers, [questionId]: value };
      const nivelRiscoProfissional = resolveAttributedRisk(
        previous.assessment.nivelRiscoProfissional,
        calculateRiskLevel(previous.answers),
        calculateRiskLevel(answers),
      );

      return {
        ...previous,
        answers,
        assessment: { ...previous.assessment, nivelRiscoProfissional },
      };
    });
    setQuestionErrors((previous) => {
      if (!previous[questionId]) return previous;
      const next = { ...previous };
      delete next[questionId];
      return next;
    });
  }

  function handleSubanswer(questionId: string, subId: string, checked: boolean) {
    updateDraft((previous) => {
      const current = previous.subanswers[questionId] ?? [];
      const next = checked
        ? [...current, subId]
        : current.filter((item) => item !== subId);
      return {
        ...previous,
        subanswers: { ...previous.subanswers, [questionId]: next },
      };
    });
  }

  function handleAssessmentChange(
    patch: Partial<FridaDraft["assessment"]>,
  ) {
    updateDraft((previous) => ({
      ...previous,
      assessment: { ...previous.assessment, ...patch },
    }));
    setAssessmentErrors((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(patch)) {
        if (next[key]) delete next[key];
      }
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);

    const validation = validateFridaDraft(draft);
    setQuestionErrors(validation.questionErrors);
    setAssessmentErrors(validation.assessmentErrors);

    if (!validation.valid) {
      setDraftNotice(
        "Corrija os campos destacados antes de salvar o FRIDA.",
      );
      return;
    }

    const nivelRisco = draft.assessment.nivelRiscoProfissional;
    if (!nivelRisco) return;

    setDraftNotice(null);
    onSubmit({
      nivelRisco,
      respostas: {
        version: 1,
        answers: draft.answers,
        subanswers: draft.subanswers,
        assessment: draft.assessment,
      },
    });
  }

  function handleSaveDraftClick() {
    saveSavedDraft(draft);
    setDraftNotice("Rascunho salvo neste dispositivo por 24 horas.");
    onSaveDraft?.();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {serverError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]"
        >
          {serverError}
        </div>
      ) : null}

      {draftNotice ? (
        <div
          role="status"
          className="rounded-xl border border-[#E6F1FB] bg-[#E6F1FB] px-4 py-3 text-sm text-[#0C447C]"
        >
          {draftNotice}
        </div>
      ) : null}

      <section aria-label="Parte 1 — Formulário de risco">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            Parte 1 — Formulário de risco
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Responda as 19 perguntas em ordem, durante o atendimento. As
            respostas “não sabe” e “não se aplica” também entram na contagem do
            nível de risco.
          </p>
        </div>

        <ol className="mt-4 space-y-4">
          {FRIDA_QUESTIONS.map((question) => (
            <li key={question.id}>
              <FridaQuestionField
                question={question}
                value={draft.answers[question.id]}
                subvalue={draft.subanswers[question.id] ?? []}
                error={
                  attempted ? questionErrors[question.id] : undefined
                }
                disabled={busy}
                onAnswer={(value) => handleAnswer(question.id, value)}
                onSubanswer={(subId, checked) =>
                  handleSubanswer(question.id, subId, checked)
                }
              />
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-label="Escala de gravidade de risco"
        className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Escala de gravidade de risco
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {summary.answered} de {summary.total} perguntas respondidas ·{" "}
              {summary.sim} “sim” · {summary.naoSei + summary.naoSeAplica}{" "}
              “não sabe/não se aplica”
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">
              Cálculo automático
            </span>
            <FridaRiskBadge level={calculatedRisk} />
          </div>
        </div>
      </section>

      <section aria-label="Parte 2 — Avaliação estruturada">
        <h2 className="text-base font-semibold text-gray-800">
          Parte 2 — Avaliação estruturada
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Registre de forma descritiva e sucinta as informações consideradas
          relevantes para a compreensão global da situação. Todos os campos são
          obrigatórios.
        </p>

        <div className="mt-4 space-y-4">
          <FridaStructuredAssessment
            value={draft.assessment}
            errors={assessmentErrors}
            calculatedRisk={calculatedRisk}
            disabled={busy}
            onChange={handleAssessmentChange}
          />
        </div>
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-lg">
        <button
          type="button"
          onClick={handleSaveDraftClick}
          disabled={busy}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-[#378ADD] hover:text-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Salvar rascunho
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#378ADD] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Salvando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function compareDrafts(
  a: FridaDraft | null,
  b: FridaDraft | null,
): FridaDraft | null {
  if (!a) return b;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export default FridaForm;
