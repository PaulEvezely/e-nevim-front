import { Link } from "react-router";
import { shortId } from "../managerUtils";
import {
  formatDate,
  formatTime,
  getAppointmentStatusLabel,
  getModalityLabel,
  getProfessionalTypeLabel,
  type AppointmentStatus,
  type ManagerAppointmentItem,
} from "../appointmentUtils";

type ManagerTriagemCardProps = {
  appointment: ManagerAppointmentItem;
  busy: boolean;
  onEdit: (appointment: ManagerAppointmentItem) => void;
  onStatus: (
    appointment: ManagerAppointmentItem,
    status: Exclude<AppointmentStatus, "AGENDADA">,
  ) => void;
  onFridaRequired: (appointment: ManagerAppointmentItem) => void;
  fridaHref?: string | null;
  /** FRIDA existente no processo (null = não verificado). */
  hasFrida?: boolean | null;
};

const STATUS_STYLES: Record<
  AppointmentStatus,
  { background: string; text: string }
> = {
  AGENDADA: { background: "#E6F1FB", text: "#0C447C" },
  REALIZADA: { background: "#EAF3DE", text: "#27500A" },
  CANCELADA: { background: "#F1EFE8", text: "#5F5E5A" },
  FALTOU: { background: "#FAEEDA", text: "#854F0B" },
};

function StatusPill({ status }: { status: AppointmentStatus }) {
  const style = STATUS_STYLES[status];
  const label = getAppointmentStatusLabel(status);
  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      style={{ backgroundColor: style.background, color: style.text }}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/5 px-2.5 py-1 text-[11px] font-semibold"
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: style.text }}
        className="h-1.5 w-1.5 shrink-0 rounded-full"
      />
      {label}
    </span>
  );
}

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

export function ManagerTriagemCard({
  appointment,
  busy,
  onEdit,
  onStatus,
  onFridaRequired,
  fridaHref = null,
  hasFrida = null,
}: ManagerTriagemCardProps) {
  const vitima = appointment.vitimaNome?.trim() || "Vítima não identificada";
  const campus = appointment.vitimaCampus?.trim();
  const online = appointment.modalidade === "ONLINE";
  const editable = appointment.status === "AGENDADA";

  function handleRegister(next: Exclude<AppointmentStatus, "AGENDADA">) {
    // REALIZADA exige FRIDA preenchido antes (a rota valida de novo).
    if (next === "REALIZADA" && hasFrida === false) {
      onFridaRequired(appointment);
      return;
    }
    onStatus(appointment, next);
  }

  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill status={appointment.status} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#0C447C]">
              {getProfessionalTypeLabel(appointment.tipoProfissional)}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-lg font-semibold text-gray-800">
              {formatDate(appointment.dataHora)}
            </span>
            <span className="text-sm text-gray-600">
              às {formatTime(appointment.dataHora)}
            </span>
          </div>
          <p className="mt-1 max-w-md truncate text-sm text-gray-700">
            {vitima}
            {campus ? ` · ${campus}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Processo{" "}
            <span className="font-mono" title={appointment.processoId}>
              {shortId(appointment.processoId)}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <ConfirmationChip
            done={appointment.confirmacaoVitima === "CONFIRMADO"}
            label={
              appointment.confirmacaoVitima === "CONFIRMADO"
                ? "Vítima confirmou"
                : "Vítima pendente"
            }
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-gray-600">
          {getModalityLabel(appointment.modalidade)}
        </span>
        {appointment.linkMeet ? (
          <a
            href={appointment.linkMeet}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#378ADD] px-3.5 py-2 font-semibold text-white transition-colors hover:bg-[#0C447C]"
          >
            Entrar na sala
          </a>
        ) : online ? (
          <span className="rounded-lg bg-stone-50 px-3 py-2 text-[11px] text-gray-500">
            Link ainda não disponível
          </span>
        ) : (
          <span className="rounded-lg bg-stone-50 px-3 py-2 text-[11px] text-gray-500">
            Atendimento presencial no NEVIM
          </span>
        )}
      </div>

      {fridaHref ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
          <Link
            to={fridaHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#378ADD] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0C447C]"
          >
            {appointment.status === "AGENDADA" ? "Preencher FRIDA" : "Abrir FRIDA"}
          </Link>
          <span className="text-[11px] text-gray-500">
            {appointment.status === "AGENDADA"
              ? "Formulário de risco — pode ser preenchido durante o atendimento"
              : "Formulário de risco da triagem realizada"}
          </span>
        </div>
      ) : null}

      {editable ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
          <Link
            to={`/manager/consultas/${appointment.id}`}
            aria-label={`Detalhar triagem de ${vitima}`}
            title="Ver o detalhe completo e alterar o status"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#378ADD] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0C447C]"
          >
            Detalhar
          </Link>

          <button
            type="button"
            onClick={() => onEdit(appointment)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-[#378ADD] hover:text-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Editar sala/detalhes
          </button>

          <button
            type="button"
            onClick={() => handleRegister("REALIZADA")}
            disabled={busy}
            title={
              hasFrida === false
                ? "Preencha o FRIDA antes de marcar como realizada"
                : "Marcar triagem como realizada"
            }
            aria-label={`Marcar triagem de ${vitima} como realizada`}
            className="inline-flex items-center rounded-lg border border-black/5 bg-[#EAF3DE] px-3.5 py-2 text-xs font-semibold text-[#27500A] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Realizada
          </button>

          <button
            type="button"
            onClick={() => handleRegister("CANCELADA")}
            disabled={busy}
            title="Marcar triagem como cancelada"
            aria-label={`Marcar triagem de ${vitima} como cancelada`}
            className="inline-flex items-center rounded-lg border border-black/5 bg-[#F1EFE8] px-3.5 py-2 text-xs font-semibold text-[#5F5E5A] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelada
          </button>

          <button
            type="button"
            onClick={() => handleRegister("FALTOU")}
            disabled={busy}
            title="Marcar triagem como falta"
            aria-label={`Marcar triagem de ${vitima} como falta`}
            className="inline-flex items-center rounded-lg border border-black/5 bg-[#FAEEDA] px-3.5 py-2 text-xs font-semibold text-[#854F0B] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Faltou
          </button>
        </div>
        ) : null}
    </li>
  );
}

export default ManagerTriagemCard;
