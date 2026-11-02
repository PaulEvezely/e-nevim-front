import { cn } from "../../../../libs/utils";
import {
  FRIDA_ANSWER_LABELS,
  FRIDA_ANSWER_ORDER,
  type FridaAnswerValue,
  type FridaQuestion,
} from "../fridaTypes";

type FridaQuestionFieldProps = {
  question: FridaQuestion;
  value: FridaAnswerValue | undefined;
  subvalue: string[];
  error?: string;
  disabled?: boolean;
  onAnswer: (value: FridaAnswerValue) => void;
  onSubanswer: (subId: string, checked: boolean) => void;
};

export function FridaQuestionField({
  question,
  value,
  subvalue,
  error,
  disabled = false,
  onAnswer,
  onSubanswer,
}: FridaQuestionFieldProps) {
  const errorId = `${question.id}-error`;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4",
        error ? "border-red-300" : "border-stone-200",
      )}
      aria-describedby={error ? errorId : undefined}
      aria-invalid={Boolean(error)}
    >
      <p className="flex items-start gap-2.5 text-sm font-semibold text-gray-800">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0C447C] text-xs font-bold text-white"
        >
          {question.number}
        </span>
        <span>{question.prompt}</span>
      </p>

      {question.helper ? (
        <p className="mt-1 text-xs text-gray-500">{question.helper}</p>
      ) : null}

      <div
        className="mt-3 flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={`Resposta da pergunta ${question.number}`}
      >
        {FRIDA_ANSWER_ORDER.map((option) => {
          const selected = value === option;
          return (
            <label
              key={option}
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
                name={question.id}
                value={option}
                checked={selected}
                disabled={disabled}
                onChange={() => onAnswer(option)}
                className="sr-only"
              />
              {FRIDA_ANSWER_LABELS[option]}
            </label>
          );
        })}
      </div>

      {question.subquestions && question.subquestions.length > 0 ? (
        <div className="mt-3 rounded-lg bg-stone-50 p-3">
          <p className="text-xs font-semibold text-gray-700">Especifique:</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {question.subquestions.map((subquestion) => {
              const checked = subvalue.includes(subquestion.id);
              return (
                <label
                  key={subquestion.id}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-700",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) =>
                      onSubanswer(subquestion.id, event.target.checked)
                    }
                    className="h-4 w-4 rounded border-stone-300 text-[#0C447C] focus:ring-[#378ADD]/40 disabled:opacity-60"
                  />
                  {subquestion.label}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <p id={errorId} className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default FridaQuestionField;
