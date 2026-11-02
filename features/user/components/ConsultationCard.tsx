import {
  getAppointmentTime,
  getDayLabel,
  getModalityLabel,
  getTypeLabel,
  isConfirmedByVictim,
  isOnline,
  type MyAppointment,
} from "../consultasUtils";

type ConsultationCardProps = {
  appointment: MyAppointment;
  busy: boolean;
  onConfirm: (appointment: MyAppointment) => void;
  onRefuse: (appointment: MyAppointment) => void;
};

const chipClass =
  "inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-gray-600";

function ConfirmationChip({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  return (
    <span
      className={
        done
          ? "inline-flex items-center gap-1 rounded-full border border-[#EAF3DE] bg-[#EAF3DE] px-2.5 py-1 text-[11px] font-semibold text-[#27500A]"
          : "inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500"
      }
    >
      <span
        aria-hidden="true"
        className={
          done
            ? "h-1.5 w-1.5 rounded-full bg-[#27500A]"
            : "h-1.5 w-1.5 rounded-full bg-gray-300"
        }
      />
      {label}
    </span>
  );
}

export function ConsultationCard({
  appointment,
  busy,
  onConfirm,
  onRefuse,
}: ConsultationCardProps) {
  const confirmed = isConfirmedByVictim(appointment);
  const online = isOnline(appointment);

  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0C447C]">
            {getTypeLabel(appointment.tipoProfissional)}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-lg font-semibold text-gray-800">
              {getDayLabel(appointment.dataHora)}
            </span>
            <span className="text-sm text-gray-600">
              às {getAppointmentTime(appointment.dataHora)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={chipClass}>
              {getModalityLabel(appointment.modalidade)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E6F1FB] bg-[#E6F1FB] px-2.5 py-1 text-[11px] font-semibold text-[#0C447C]">
              Agendada
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <ConfirmationChip
            done={appointment.confirmacaoVitima === "CONFIRMADO"}
            label={
              appointment.confirmacaoVitima === "CONFIRMADO"
                ? "Você confirmou"
                : "Aguardando você"
            }
          />
          <ConfirmationChip
            done={appointment.confirmacaoProfissional === "CONFIRMADO"}
            label={
              appointment.confirmacaoProfissional === "CONFIRMADO"
                ? "Profissional confirmou"
                : "Profissional pendente"
            }
          />
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
        {online
          ? appointment.linkMeet
            ? "Atendimento online. Use o botão abaixo para entrar na sala no horário marcado."
            : "Atendimento online. O link da sala será disponibilizado aqui após as confirmações."
          : "Atendimento presencial no NEVIM (UESPI). Compareça com alguns minutos de antecedência."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {appointment.linkMeet ? (
          <a
            href={appointment.linkMeet}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#378ADD] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0C447C]"
          >
            Entrar na sala
          </a>
        ) : null}

        {confirmed ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAF3DE] bg-[#EAF3DE] px-3.5 py-2 text-xs font-semibold text-[#27500A]">
            Presença confirmada
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onConfirm(appointment)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#378ADD] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirmar presença
          </button>
        )}

        <button
          type="button"
          onClick={() => onRefuse(appointment)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#791F1F] transition-colors hover:bg-[#FCEBEB] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Não poderei comparecer
        </button>
      </div>
    </li>
  );
}

export default ConsultationCard;
