import { cn } from "../../libs/utils";

export type ProcessStatus =
  | "Pendente"
  | "Ativo"
  | "Inativo"
  | "Encerrado"
  | "Aguardando cadastro";
export type RiskLevel = "Baixo" | "Médio" | "Elevado";
export type TriageStatus =
  | "Sem triagem"
  | "Em triagem"
  | "Encaminhado"
  | "Encerrado";
export type CampusFlag = "No campus";
export type StatusValue = ProcessStatus | RiskLevel | TriageStatus | CampusFlag;

interface StatusBadgeProps {
  status: StatusValue;
  className?: string;
}

const STATUS_STYLES: Record<StatusValue, { background: string; text: string }> = {
  Pendente: { background: "#FAEEDA", text: "#854F0B" },
  Ativo: { background: "#E6F1FB", text: "#0C447C" },
  Inativo: { background: "#F1EFE8", text: "#5F5E5A" },
  Encerrado: { background: "#EAF3DE", text: "#27500A" },
  "Aguardando cadastro": { background: "#E6F1FB", text: "#0C447C" },
  Baixo: { background: "#EAF3DE", text: "#27500A" },
  "Médio": { background: "#FAEEDA", text: "#854F0B" },
  Elevado: { background: "#FCEBEB", text: "#791F1F" },
  "Sem triagem": { background: "#F1EFE8", text: "#5F5E5A" },
  "Em triagem": { background: "#FAEEDA", text: "#854F0B" },
  Encaminhado: { background: "#E6F1FB", text: "#0C447C" },
  "No campus": { background: "#FDECD2", text: "#8A3B06" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];

  return (
    <span
      role="status"
      aria-label={`Status: ${status}`}
      style={{ backgroundColor: style.background, color: style.text }}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-black/5",
        className,
      )}
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: style.text }}
        className="w-1.5 h-1.5 rounded-full shrink-0"
      />
      {status}
    </span>
  );
}

export default StatusBadge;
