import {
  FRIDA_ANSWER_LABELS,
  parseFridaRespostas,
  type FridaAnswerValue,
  type FridaRecord,
} from "../fridaTypes";
import { FRIDA_QUESTIONS } from "../fridaQuestions";
import { FridaRiskBadge } from "./FridaRiskBadge";
import { formatDateTime } from "../../../../shared/utils/date";

type FridaReadOnlyProps = {
  frida: FridaRecord;
};

export function FridaReadOnly({ frida }: FridaReadOnlyProps) {
  const respostas = parseFridaRespostas(frida.respostas);
  const assessment = respostas.assessment;

  return (
    <article className="space-y-5" aria-label="FRIDA registrado">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            Formulário de Risco FRIDA
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Registrado em {formatDateTime(frida.criadoEm)}
          </p>
        </div>
        <FridaRiskBadge level={frida.nivelRisco} />
      </header>

      <section
        aria-label="Parte 1 — Formulário de risco"
        className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <h3 className="text-sm font-semibold text-gray-800">
          Parte 1 — Formulário de risco
        </h3>
        <dl className="mt-3 space-y-2">
          {FRIDA_QUESTIONS.map((question) => {
            const answer = respostas.answers[question.id] as
              | FridaAnswerValue
              | undefined;
            const label = answer
              ? FRIDA_ANSWER_LABELS[answer]
              : "Não registrada";
            const subanswers = respostas.subanswers[question.id] ?? [];
            const subLabels = question.subquestions
              ? question.subquestions
                  .filter((subquestion) => subanswers.includes(subquestion.id))
                  .map((subquestion) => subquestion.label)
              : [];

            return (
              <div
                key={question.id}
                className="border-b border-stone-100 py-2 last:border-b-0"
              >
                <dt className="text-sm text-gray-700">
                  <span className="mr-1.5 font-semibold text-[#0C447C]">
                    {question.number}.
                  </span>
                  {question.prompt}
                </dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={
                      answer
                        ? "rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 font-semibold text-gray-700"
                        : "rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-gray-400"
                    }
                  >
                    {label}
                  </span>
                  {subLabels.length > 0 ? (
                    <span className="text-gray-500">
                      Especificado: {subLabels.join(", ")}
                    </span>
                  ) : null}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section
        aria-label="Parte 2 — Avaliação estruturada"
        className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <h3 className="text-sm font-semibold text-gray-800">
          Parte 2 — Avaliação estruturada realizada pela(o) profissional
        </h3>

        <dl className="mt-3 space-y-3">
          <ReadOnlyText label="Percepção de risco da usuária" value={assessment.percepcaoRisco} />
          <ReadOnlyText label="Outras informações relevantes" value={assessment.outrasInformacoes} />
          <ReadOnlyText label="Estado físico e emocional" value={assessment.estadoFisicoEmocional} />
          <ReadOnlyText label="Risco de suicídio" value={assessment.riscoSuicidio} />
          <ReadOnlyText label="Residência e acesso do agressor" value={assessment.resideComAgressor} />
          <ReadOnlyText label="Outras circunstâncias de risco" value={assessment.outrasCircunstancias} />
          <ReadOnlyText label="Justificativa do nível de risco" value={assessment.justificativa} />
          <ReadOnlyText label="Encaminhamentos sugeridos" value={assessment.encaminhamentos} />
          <ReadOnlyText
            label="A usuária concordou com os encaminhamentos"
            value={[
              assessment.concordouEncaminhamentos
                ? assessment.concordouEncaminhamentos === "SIM"
                  ? "Sim"
                  : "Não"
                : "",
              assessment.concordouJustificativa,
            ]
              .filter(Boolean)
              .join(" — ")}
          />
          <ReadOnlyText
            label="Interesse em aderir aos encaminhamentos"
            value={[
              assessment.interesseAderir
                ? assessment.interesseAderir === "SIM"
                  ? "Sim"
                  : "Não"
                : "",
              assessment.interesseJustificativa,
            ]
              .filter(Boolean)
              .join(" — ")}
          />
        </dl>
      </section>
    </article>
  );
}

function ReadOnlyText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">
        {value.trim() ? value : "—"}
      </dd>
    </div>
  );
}

export default FridaReadOnly;
