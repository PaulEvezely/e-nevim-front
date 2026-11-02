import { Link } from "react-router";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
  getDemandCategory,
  isDentroCampusItem,
  shortId,
  type ManagerDemandItem,
} from "../managerUtils";
import { formatDate } from "../../../shared/utils/date";

function resolveBadgeStatus(category: ReturnType<typeof getDemandCategory>) {
  switch (category) {
    case "PENDENTE":
      return "Pendente" as const;
    case "AGUARDANDO_CADASTRO":
      return "Aguardando cadastro" as const;
    case "EM_PROCESSO":
      return "Ativo" as const;
    case "REJEITADA":
      return "Encerrado" as const;
  }
}

function DemandRow({ demand }: { demand: ManagerDemandItem }) {
  const category = getDemandCategory(demand);
  const withinCampus = isDentroCampusItem(demand);
  return (
    <tr className="border-t border-stone-200 first:border-t-0">
      <td className="px-3 py-3 text-xs font-mono text-gray-600 align-top">
        <span title={demand.id}>{shortId(demand.id)}</span>
        {withinCampus ? (
          <span className="mt-1 block">
            <StatusBadge status="No campus" />
          </span>
        ) : null}
      </td>
      <td className="px-3 py-3 text-xs text-gray-700 align-top max-w-44">
        <span className="block truncate font-medium">
          {demand.solicitanteNome?.trim() || "—"}
        </span>
        <span className="block truncate text-gray-500">
          {demand.solicitanteEmail?.trim() || ""}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap align-top">
        {formatDate(demand.criadoEm)}
      </td>
      <td className="px-3 py-3 text-xs text-gray-700 align-top max-w-0">
        <span className="block truncate max-w-[160px]" title={demand.solicitanteCampus?.trim()}>
          {demand.solicitanteCampus?.trim() || "—"}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-gray-700 align-top max-w-0">
        <span className="block truncate max-w-[180px]" title={demand.tipoViolencia}>
          {demand.tipoViolencia || "—"}
        </span>
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap">
        <StatusBadge status={resolveBadgeStatus(category)} />
      </td>
      <td className="px-3 py-3 text-right align-top">
        <Link
          to={`/manager/demandas/${demand.id}`}
          aria-label={`Detalhar demanda ${shortId(demand.id)}`}
          className="inline-block bg-[#378ADD] hover:bg-[#0C447C] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow"
        >
          Detalhar
        </Link>
      </td>
    </tr>
  );
}

export function DemandTable({ demands }: { demands: ManagerDemandItem[] }) {
  if (demands.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-gray-500">
        Nenhuma demanda encontrada para os filtros aplicados.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-180 border-collapse">
        <caption className="sr-only">Todas as demandas com filtros aplicados</caption>
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th scope="col" className="px-3 py-2 font-semibold">
              Protocolo
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Solicitante
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Data
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Campus
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Tipo de violência
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Situação
            </th>
            <th scope="col" className="px-3 py-2 font-semibold text-right">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="bg-[#E6F1FB]/40">
          {demands.map((demand) => (
            <DemandRow key={demand.id} demand={demand} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DemandTable;
