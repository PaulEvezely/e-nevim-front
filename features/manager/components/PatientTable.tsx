import { Link } from "react-router";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { shortId } from "../managerUtils";
import {
  getConsultationStatusLabel,
  getPatientBondLabel,
  getPatientRiskBadgeLabel,
  getPatientTriageLabel,
  getProcessStatusHint,
  getProcessStatusLabel,
  type ManagerPatientItem,
} from "../patientUtils";
import { formatDate, formatDateTime } from "../../../shared/utils/date";

function PatientRow({
  patient,
  onAgendarTriagem,
  onAgendarConsulta,
}: {
  patient: ManagerPatientItem;
  onAgendarTriagem: (processoId: string) => void;
  onAgendarConsulta: (processoId: string) => void;
}) {
  const processo = patient.processo;
  const riskLabel = getPatientRiskBadgeLabel(
    processo?.classificacaoRisco ?? null,
  );
  const lastConsultation = patient.ultimaConsulta;
  const processStatus = getProcessStatusLabel(processo?.status ?? null);
  const processHint = getProcessStatusHint(processo?.status ?? null);
  const awaitingTriage =
    patient.triageStatus === "SEM_TRIAGEM" && processo !== null;
  const canScheduleFollowUp =
    (patient.triageStatus === "EM_TRIAGEM" ||
      patient.triageStatus === "ENCAMINHADO") &&
    processo !== null;
  const processoId = processo?.id ?? null;
  return (
    <tr className="border-t border-stone-200 first:border-t-0">
      <td className="px-3 py-3 align-top">
        <span className="block max-w-52 truncate text-xs font-medium text-gray-800">
          {patient.nome?.trim() || "—"}
        </span>
        <span
          className="mt-0.5 block text-[11px] font-mono text-gray-500"
          title={
            processo
              ? `Processo ${processo.id} · Vítima ${patient.vitimaId}`
              : `Vítima ${patient.vitimaId} (sem processo)`
          }
        >
          {shortId(processo?.id ?? patient.vitimaId)}
        </span>
      </td>
      <td className="px-3 py-3 align-top">
        <span className="block text-xs text-gray-700">
          {patient.campus?.trim() || "—"}
        </span>
        <span className="block max-w-52 truncate text-[11px] text-gray-500">
          {patient.curso?.trim() || ""}
        </span>
      </td>
      <td className="px-3 py-3 align-top text-xs text-gray-700">
        {getPatientBondLabel(patient.vinculo)}
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap">
        <StatusBadge status={getPatientTriageLabel(patient.triageStatus)} />
        <span className="mt-1 block" title={processHint}>
          <StatusBadge status={processStatus} />
        </span>
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap">
        {riskLabel ? <StatusBadge status={riskLabel} /> : <span className="text-xs text-gray-400">—</span>}
      </td>
      <td className="px-3 py-3 align-top">
        <span className="block text-xs text-gray-700">
          {patient.totalConsultas === 1
            ? "1 consulta"
            : `${patient.totalConsultas} consultas`}
        </span>
        <span className="block text-[11px] text-gray-500">
          {lastConsultation
            ? `${formatDateTime(lastConsultation.dataHora)} · ${getConsultationStatusLabel(lastConsultation.status)}`
            : "Sem consultas"}
        </span>
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap text-xs text-gray-600">
        {formatDate(patient.cadastradoEm)}
      </td>
      <td className="px-3 py-3 align-top text-right whitespace-nowrap">
        {processoId ? (
          <span className="inline-flex flex-wrap justify-end gap-1.5">
            <Link
              to={`/manager/processos/${encodeURIComponent(processoId)}`}
              aria-label={`Detalhar processo de ${patient.nome?.trim() || shortId(processoId)}`}
              title="Ver o detalhe completo do processo"
              className="inline-block rounded-lg bg-[#378ADD] px-3 py-1.5 text-xs font-semibold text-white shadow transition-colors hover:bg-[#0C447C]"
            >
              Detalhar
            </Link>
            {awaitingTriage ? (
              <button
                type="button"
                onClick={() => onAgendarTriagem(processoId)}
                aria-label={`Agendar triagem para ${patient.nome?.trim() || shortId(processoId)}`}
                title="Mesmo fluxo da fila de triagem do Painel"
                className="inline-block rounded-lg bg-[#378ADD] px-3 py-1.5 text-xs font-semibold text-white shadow transition-colors hover:bg-[#0C447C]"
              >
                Agendar triagem
              </button>
            ) : null}
            {canScheduleFollowUp ? (
              <button
                type="button"
                onClick={() => onAgendarConsulta(processoId)}
                aria-label={`Marcar consulta para ${patient.nome?.trim() || shortId(processoId)}`}
                title="Abre o formulário com o processo pré-selecionado (agendar com profissional encaminha automaticamente)"
                className="inline-block rounded-lg bg-[#378ADD] px-3 py-1.5 text-xs font-semibold text-white shadow transition-colors hover:bg-[#0C447C]"
              >
                Marcar consulta
              </button>
            ) : null}
            <Link
              to={`/manager/consultas?processoId=${encodeURIComponent(processoId)}`}
              aria-label={`Ver consultas de ${patient.nome?.trim() || shortId(processoId)}`}
              title="Ver consultas deste processo na tela Consultas"
              className="inline-block rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0C447C] transition-colors hover:bg-[#E6F1FB]"
            >
              Ver consultas
            </Link>
          </span>
        ) : (
          <span
            className="inline-block rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-gray-400"
            title="Cadastro completo sem processo criado — acompanhe pela tela Demandas"
          >
            Sem processo
          </span>
        )}
      </td>
    </tr>
  );
}

export function PatientTable({
  patients,
  onAgendarTriagem,
  onAgendarConsulta,
}: {
  patients: ManagerPatientItem[];
  onAgendarTriagem: (processoId: string) => void;
  onAgendarConsulta: (processoId: string) => void;
}) {
  if (patients.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-gray-500">
        Nenhum paciente encontrado para os filtros aplicados.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-200 border-collapse">
        <caption className="sr-only">
          Pacientes cadastrados com filtros aplicados
        </caption>
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th scope="col" className="px-3 py-2 font-semibold">
              Paciente
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Campus / Curso
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Vínculo
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Triagem / Processo
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Risco
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Consultas
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Cadastro em
            </th>
            <th scope="col" className="px-3 py-2 font-semibold text-right">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="bg-[#E6F1FB]/40">
          {patients.map((patient) => (
            <PatientRow
              key={patient.vitimaId}
              patient={patient}
              onAgendarTriagem={onAgendarTriagem}
              onAgendarConsulta={onAgendarConsulta}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PatientTable;
