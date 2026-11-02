import { cn } from "../../../../libs/utils";
import {
  RISK_LEVEL_LABELS,
  RISK_LEVEL_ORDER,
  type RiskLevel,
  type StructuredAssessment,
  type YesNo,
} from "../fridaTypes";
import type { FridaFieldErrors } from "../fridaValidation";

type FridaStructuredAssessmentProps = {
  value: StructuredAssessment;
  errors: FridaFieldErrors;
  /** Nível sugerido pela grelha, para sinalizar divergência. */
  calculatedRisk: RiskLevel;
  disabled?: boolean;
  onChange: (patch: Partial<StructuredAssessment>) => void;
};

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 disabled:opacity-60";
const errorInputClass =
  "w-full rounded-xl border border-red-400 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:opacity-60";

type DescriptiveFieldKey =
  | "percepcaoRisco"
  | "outrasInformacoes"
  | "estadoFisicoEmocional"
  | "riscoSuicidio"
  | "resideComAgressor"
  | "outrasCircunstancias";

const DESCRIPTIVE_FIELDS: ReadonlyArray<{
  key: DescriptiveFieldKey;
  label: string;
  placeholder: string;
  rows?: number;
}> = [
  {
    key: "percepcaoRisco",
    label:
      "A mulher demonstra percepção de risco sobre sua situação? A percepção é de existência ou inexistência do risco?",
    placeholder:
      "Registre a percepção da mulher e explique (ex.: justifica o comportamento do agressor ou naturaliza a violência).",
  },
  {
    key: "outrasInformacoes",
    label:
      "Existem outras informações relevantes com relação ao contexto ou situação da vítima que possam indicar risco de novas agressões?",
    placeholder:
      "Ex.: novo(a) companheiro(a), mudança de casa/bairro/cidade, decisões que anunciam ruptura definitiva.",
  },
  {
    key: "estadoFisicoEmocional",
    label: "Como a mulher se apresenta física e emocionalmente?",
    placeholder:
      "Ex.: esgotamento emocional, medicação controlada, necessidade de acompanhamento psicológico e/ou psiquiátrico.",
  },
  {
    key: "riscoSuicidio",
    label:
      "Existe o risco de a mulher tentar suicídio ou há informações de que tenha tentado se matar?",
    placeholder: "Descreva o que foi avaliado e as informações levantadas.",
  },
  {
    key: "resideComAgressor",
    label:
      "A mulher ainda reside com o(a) agressor(a) ou ele(a) tem acesso fácil à sua residência?",
    placeholder: "Explique a situação de convivência e de acesso.",
  },
  {
    key: "outrasCircunstancias",
    label:
      "Descreva outras circunstâncias que, na sua opinião, poderão representar risco de novas agressões e deverão ser observadas no fluxo de atendimento.",
    placeholder:
      "Descreva de forma sucinta a situação ou aspecto que chamou sua atenção.",
  },
];

export function FridaStructuredAssessment({
  value,
  errors,
  calculatedRisk,
  disabled = false,
  onChange,
}: FridaStructuredAssessmentProps) {
  const attributedRisk = value.nivelRiscoProfissional;
  const divergent = Boolean(attributedRisk) && attributedRisk !== calculatedRisk;

  function fieldClass(hasError: boolean): string {
    return hasError ? errorInputClass : inputClass;
  }

  function renderDescriptiveField({
    key,
    label,
    placeholder,
    rows = 3,
  }: (typeof DESCRIPTIVE_FIELDS)[number]) {
    const error = errors[key];
    const errorId = `frida-${key}-error`;
    return (
      <label className="block rounded-xl border border-stone-200 bg-white p-4" key={key}>
        <span className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </span>
        <textarea
          rows={rows}
          value={value[key]}
          disabled={disabled}
          onChange={(event) => onChange({ [key]: event.target.value })}
          placeholder={placeholder}
          className={fieldClass(Boolean(error))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        {error ? (
          <p id={errorId} className="mt-1 text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </label>
    );
  }

  function renderRiskLevel() {
    const error = errors.nivelRiscoProfissional;
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">
            Que nível de risco você atribui a este caso?
          </legend>
          <p className="mt-1 text-xs text-gray-500">
            Sugestão automática pela grelha:{" "}
            <strong className="font-semibold text-gray-700">
              {RISK_LEVEL_LABELS[calculatedRisk]}
            </strong>
            .
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {RISK_LEVEL_ORDER.map((level) => {
              const selected = attributedRisk === level;
              return (
                <label
                  key={level}
                  className={cn(
                    "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    "focus-within:ring-2 focus-within:ring-[#378ADD]/40",
                    selected
                      ? "border-[#0C447C] bg-[#0C447C] text-white"
                      : "border-stone-300 bg-white text-gray-700 hover:border-[#378ADD] hover:text-[#0C447C]",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="nivelRiscoProfissional"
                    value={level}
                    checked={selected}
                    disabled={disabled}
                    onChange={() =>
                      onChange({ nivelRiscoProfissional: level })
                    }
                    className="sr-only"
                  />
                  {RISK_LEVEL_LABELS[level]}
                </label>
              );
            })}
          </div>

          {error ? (
            <p className="mt-1 text-xs text-red-700">{error}</p>
          ) : null}

          {divergent ? (
            <p className="mt-3 rounded-lg bg-[#FAEEDA] px-3 py-2 text-xs text-[#854F0B]">
              O nível atribuído ({RISK_LEVEL_LABELS[attributedRisk as RiskLevel]}
              ) difere do cálculo automático (
              {RISK_LEVEL_LABELS[calculatedRisk]}). Justifique a diferença
              abaixo.
            </p>
          ) : null}
        </fieldset>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Justifique o nível de risco atribuído.
          </span>
          <textarea
            rows={3}
            value={value.justificativa}
            disabled={disabled}
            onChange={(event) =>
              onChange({ justificativa: event.target.value })
            }
            placeholder="Fatores que justificam a avaliação atribuída."
            className={fieldClass(Boolean(errors.justificativa))}
            aria-invalid={Boolean(errors.justificativa)}
            aria-describedby={
              errors.justificativa ? "frida-justificativa-error" : undefined
            }
          />
          {errors.justificativa ? (
            <p
              id="frida-justificativa-error"
              className="mt-1 text-xs text-red-700"
            >
              {errors.justificativa}
            </p>
          ) : null}
        </label>
      </div>
    );
  }

  function renderEncaminhamentos() {
    const error = errors.encaminhamentos;
    return (
      <label className="block rounded-xl border border-stone-200 bg-white p-4">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          Quais os encaminhamentos sugeridos?
        </span>
        <textarea
          rows={3}
          value={value.encaminhamentos}
          disabled={disabled}
          onChange={(event) =>
            onChange({ encaminhamentos: event.target.value })
          }
          placeholder="Ex.: rede de saúde, assistência social, delegacia, defensoria."
          className={fieldClass(Boolean(error))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "frida-encaminhamentos-error" : undefined}
        />
        {error ? (
          <p id="frida-encaminhamentos-error" className="mt-1 text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </label>
    );
  }

  function renderYesNo(
    key: "concordouEncaminhamentos" | "interesseAderir",
    label: string,
    justificationKey: "concordouJustificativa" | "interesseJustificativa",
    justificationLabel: string,
  ) {
    const error = errors[key];
    const justificationError = errors[justificationKey];
    const justificationErrorId = `frida-${justificationKey}-error`;
    const selected = value[key];

    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}

        <div className="mt-2 flex flex-wrap gap-2">
          {(["SIM", "NAO"] as const).map((option) => {
            const isSelected = selected === option;
            return (
              <label
                key={option}
                className={cn(
                  "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  "focus-within:ring-2 focus-within:ring-[#378ADD]/40",
                  isSelected
                    ? "border-[#0C447C] bg-[#0C447C] text-white"
                    : "border-stone-300 bg-white text-gray-700 hover:border-[#378ADD] hover:text-[#0C447C]",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="radio"
                  name={key}
                  value={option}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => onChange({ [key]: option as YesNo })}
                  className="sr-only"
                />
                {option === "SIM" ? "Sim" : "Não"}
              </label>
            );
          })}
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-gray-600">
            {justificationLabel}
          </span>
          <textarea
            rows={2}
            value={value[justificationKey]}
            disabled={disabled}
            onChange={(event) =>
              onChange({ [justificationKey]: event.target.value })
            }
            className={fieldClass(Boolean(justificationError))}
            aria-invalid={Boolean(justificationError)}
            aria-describedby={
              justificationError ? justificationErrorId : undefined
            }
          />
          {justificationError ? (
            <p
              id={justificationErrorId}
              className="mt-1 text-xs text-red-700"
            >
              {justificationError}
            </p>
          ) : null}
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {DESCRIPTIVE_FIELDS.map((field) => renderDescriptiveField(field))}
      {renderRiskLevel()}
      {renderEncaminhamentos()}
      {renderYesNo(
        "concordouEncaminhamentos",
        "A usuária concordou com os encaminhamentos?",
        "concordouJustificativa",
        "Por quê?",
      )}
      {renderYesNo(
        "interesseAderir",
        "A usuária demonstra interesse em aderir aos encaminhamentos?",
        "interesseJustificativa",
        "Por quê?",
      )}
    </div>
  );
}

export default FridaStructuredAssessment;
