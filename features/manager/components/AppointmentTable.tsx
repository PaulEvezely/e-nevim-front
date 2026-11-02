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

type AppointmentTableProps = {
  appointments: ManagerAppointmentItem[];
  professionalNames: Record<string, string>;
  busyId?: string | null;
  onEdit?: (appointment: ManagerAppointmentItem) => void;
  /** Esconde a coluna "Profissional" (ex.: agenda própria, sempre o gestor). */
  hideProfessional?: boolean;
  /** Exibe o atalho FRIDA nas ações (padrão: true). */
  showFrida?: boolean;
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

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const style = STATUS_STYLES[status];
  const label = getAppointmentStatusLabel(status);
  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      style={{ backgroundColor: style.background, color: style.text }}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/5 px-2.5 py-1 text-xs font-semibold"
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

function AppointmentRow({
  appointment,
  professionalNames,
  busy,
  onEdit,
  hideProfessional,
  showFrida,
}: {
  appointment: ManagerAppointmentItem;
  professionalNames: Record<string, string>;
  busy: boolean;
  onEdit?: (appointment: ManagerAppointmentItem) => void;
  hideProfessional: boolean;
  showFrida: boolean;
}) {
  const professional =
    professionalNames[appointment.profissionalId] || "—";
  const vitima = appointment.vitimaNome?.trim() || "—";
  const campus = appointment.vitimaCampus?.trim();
  const editable = appointment.status === "AGENDADA";

  return (
    <tr className="border-t border-stone-200 first:border-t-0">
      <td className="whitespace-nowrap px-3 py-3 align-top">
        <span className="block text-xs font-medium text-gray-800">
          {formatDate(appointment.dataHora)}
        </span>
        <span className="block text-[11px] text-gray-500">
          {formatTime(appointment.dataHora)}
        </span>
      </td>
      <td className="px-3 py-3 align-top">
        <span className="block max-w-52 truncate text-xs font-medium text-gray-800">
          {vitima}
        </span>
        <span className="mt-0.5 block text-[11px] text-gray-500">
          {campus ? `${campus} · ` : ""}
          <span className="font-mono" title={appointment.processoId}>
            {shortId(appointment.processoId)}
          </span>
        </span>
      </td>
      {hideProfessional ? null : (
        <td className="px-3 py-3 align-top">
          <span className="block text-xs text-gray-700">
            {getProfessionalTypeLabel(appointment.tipoProfissional)}
          </span>
          <span className="block max-w-44 truncate text-[11px] text-gray-500">
            {professional}
          </span>
        </td>
      )}
      <td className="px-3 py-3 align-top text-xs text-gray-700">
        {getModalityLabel(appointment.modalidade)}
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap">
        <AppointmentStatusBadge status={appointment.status} />
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap">
        {appointment.linkMeet ? (
          <a
            href={appointment.linkMeet}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
          >
            Abrir sala
          </a>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {editable ? (
            <button
              type="button"
              onClick={() => onEdit?.(appointment)}
              disabled={busy}
              aria-label={`Editar consulta de ${vitima}`}
              title="Editar término, modalidade, link da sala ou observações"
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0C447C] transition-colors hover:bg-[#E6F1FB] disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
                aria-hidden="true"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              Editar
            </button>
          ) : null}
          <Link
            to={`/manager/consultas/${appointment.id}`}
            aria-label={`Detalhar consulta de ${vitima}`}
            title="Ver o detalhe completo da consulta"
            className="inline-flex items-center gap-1 rounded-lg bg-[#378ADD] px-2.5 py-1 text-[11px] font-semibold text-white shadow transition-colors hover:bg-[#0C447C]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Detalhar
          </Link>
          {(appointment.tipoProfissional === "TRIAGEM" ||
            appointment.tipoProfissional === "PSICOLOGO") &&
          showFrida &&
          (editable || appointment.status === "REALIZADA") ? (
            <Link
              to={`/manager/frida/${appointment.id}`}
              title="Preencher FRIDA (permitido durante o atendimento, mesmo agendada)"
              className="inline-flex rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0C447C] transition-colors hover:bg-[#E6F1FB]"
            >
              FRIDA
            </Link>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function AppointmentTable({
  appointments,
  professionalNames,
  busyId = null,
  onEdit,
  hideProfessional = false,
  showFrida = true,
}: AppointmentTableProps) {
  if (appointments.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-gray-500">
        Nenhuma consulta encontrada para os filtros aplicados.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-200 border-collapse">
        <caption className="sr-only">
          Consultas agendadas com filtros aplicados
        </caption>
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th scope="col" className="px-3 py-2 font-semibold">
              Data / Hora
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Vítima / Processo
            </th>
            {hideProfessional ? null : (
              <th scope="col" className="px-3 py-2 font-semibold">
                Profissional
              </th>
            )}
            <th scope="col" className="px-3 py-2 font-semibold">
              Modalidade
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Status
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Sala
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="bg-[#E6F1FB]/40">
          {appointments.map((appointment) => (
            <AppointmentRow
              key={appointment.id}
              appointment={appointment}
              professionalNames={professionalNames}
              busy={busyId === appointment.id}
              onEdit={onEdit}
              hideProfessional={hideProfessional}
              showFrida={showFrida}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AppointmentTable;
