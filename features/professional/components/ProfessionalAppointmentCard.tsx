import { Link } from "react-router";
import { shortId } from "../../manager/managerUtils";
import {
  formatDate,
  formatTime,
  getAppointmentStatusLabel,
  getModalityLabel,
  getProfessionalTypeLabel,
  type AppointmentStatus,
  type ManagerAppointmentItem,
} from "../../manager/appointmentUtils";

type ProfessionalAppointmentCardProps = {
  appointment: ManagerAppointmentItem;
  busy: boolean;
  onConfirm: (appointment: ManagerAppointmentItem) => void;
  onEdit: (appointment: ManagerAppointmentItem) => void;
  onStatus: (
    appointment: ManagerAppointmentItem,
    status: "REALIZADA" | "CANCELADA" | "FALTOU",
  ) => void;
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

export function ProfessionalAppointmentCard({
  appointment,
  busy,
  onConfirm,
  onEdit,
  onStatus,
  fridaHref = null,
  hasFrida = null,
}: ProfessionalAppointmentCardProps) {
  const vitima = appointment.vitimaNome?.trim() || "Vítima não identificada";
  const campus = appointment.vitimaCampus?.trim();
  const confirmed = appointment.confirmacaoProfissional === "CONFIRMADO";
  const online = appointment.modalidade === "ONLINE";
  const editable = appointment.status === "AGENDADA";
  const isRealizada = appointment.status === "REALIZADA";
  const isTriagem = appointment.tipoProfissional === "TRIAGEM";
  const processoEncerrado =
    (appointment.processo?.status ?? "").toUpperCase() === "ENCERRADO";

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
            done={confirmed}
            label={confirmed ? "Você confirmou" : "Sua confirmação pendente"}
          />
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
              ? hasFrida === false
                ? "Preencha o FRIDA antes de marcar como realizada"
                : "Formulário de risco — pode ser preenchido durante o atendimento"
              : "Formulário de risco da consulta realizada"}
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
        <Link
          to={`/professional/appointments/${appointment.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-[#378ADD] hover:text-[#0C447C]"
        >
          Ver detalhes
        </Link>
      </div>

      {processoEncerrado ? (
        <p className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-gray-500">
          Processo encerrado — ações bloqueadas.
        </p>
      ) : null}
      {editable && !processoEncerrado ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
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
            onClick={() => onEdit(appointment)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-[#378ADD] hover:text-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Editar sala/detalhes
          </button>

          <button
            type="button"
            onClick={() => onStatus(appointment, "REALIZADA")}
            disabled={busy}
            aria-label={`Marcar como realizada a consulta de ${vitima}`}
            title={
              hasFrida === false
                ? "Preencha o FRIDA antes de marcar como realizada"
                : "Marcar consulta como realizada"
            }
            className="rounded-lg border border-black/5 bg-[#EAF3DE] px-4 py-2 text-xs font-semibold text-[#27500A] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Realizada
          </button>
          <button
            type="button"
            onClick={() => onStatus(appointment, "CANCELADA")}
            disabled={busy}
            aria-label={`Marcar como cancelada a consulta de ${vitima}`}
            title="Marcar consulta como cancelada"
            className="rounded-lg border border-black/5 bg-[#F1EFE8] px-4 py-2 text-xs font-semibold text-[#5F5E5A] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelada
          </button>
          <button
            type="button"
            onClick={() => onStatus(appointment, "FALTOU")}
            disabled={busy}
            aria-label={`Marcar como falta a consulta de ${vitima}`}
            title="Marcar consulta como falta"
            className="rounded-lg border border-black/5 bg-[#FAEEDA] px-4 py-2 text-xs font-semibold text-[#854F0B] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Faltou
          </button>
        </div>
      ) : null}
      {isRealizada && !processoEncerrado ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
          <button
            type="button"
            onClick={() => onStatus(appointment, "CANCELADA")}
            disabled={busy}
            aria-label={`Cancelar registro realizado da consulta de ${vitima}`}
            title={
              isTriagem
                ? "Desfazer triagem (processo volta para ABERTO)"
                : "Desfazer registro de realizada (relatórios mantidos)"
            }
            className="rounded-lg border border-black/5 bg-[#F1EFE8] px-4 py-2 text-xs font-semibold text-[#5F5E5A] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar consulta realizada
          </button>
        </div>
      ) : null}
    </li>
  );
}

export default ProfessionalAppointmentCard;
