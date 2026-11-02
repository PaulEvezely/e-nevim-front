import type { NotificationType } from "./types";

export interface NotificationTypeUi {
  /** Rótulo curto exibido no chip. */
  label: string;
  /** Classes do chip (fundo + texto, paleta do app). */
  chipClass: string;
}

const BLUE = "bg-[#E6F1FB] text-[#0C447C]";
const AMBER = "bg-[#FAEEDA] text-[#854F0B]";
const RED = "bg-[#FCEBEB] text-[#791F1F]";
const GREEN = "bg-[#EAF3DE] text-[#27500A]";
const NEUTRAL = "bg-[#F1EFE8] text-[#5F5E5A]";

/** Visual por TipoNotificacao. Espelha o enum do back-end. */
export const NOTIFICATION_TYPE_UI: Record<NotificationType, NotificationTypeUi> = {
  NOVA_DEMANDA: { label: "Demanda", chipClass: BLUE },
  CADASTRO_VITIMA: { label: "Demanda", chipClass: BLUE },
  DEMANDA_REJEITADA: { label: "Demanda", chipClass: RED },
  CONSULTA_AGENDADA: { label: "Consulta", chipClass: BLUE },
  CONSULTA_CONFIRMADA: { label: "Consulta", chipClass: BLUE },
  CONSULTA_CONFIRMADA_PARCIAL: { label: "Confirmação", chipClass: AMBER },
  CONSULTA_CANCELADA: { label: "Consulta", chipClass: RED },
  CONSULTA_REALIZADA: { label: "Consulta", chipClass: GREEN },
  CONSULTA_FALTA: { label: "Falta", chipClass: RED },
  LINK_MEET_DISPONIVEL: { label: "Meet", chipClass: BLUE },
  MEET_GERACAO_FALHOU: { label: "Meet", chipClass: RED },
  TRIAGEM_REGISTRADA: { label: "Triagem", chipClass: BLUE },
  PROCESSO_ENCAMINHADO: { label: "Processo", chipClass: BLUE },
  PROCESSO_ENCERRADO: { label: "Processo", chipClass: NEUTRAL },
  FRIDA_PREENCHIDO: { label: "FRIDA", chipClass: AMBER },
  FRIDA_ATUALIZADO: { label: "FRIDA", chipClass: AMBER },
};

const FALLBACK_UI: NotificationTypeUi = {
  label: "Aviso",
  chipClass: NEUTRAL,
};

/**
 * Retorna o visual do tipo com fallback neutro — o back pode ganhar tipos
 * novos antes do front (best-effort).
 */
export function getNotificationTypeUi(tipo: string): NotificationTypeUi {
  return (
    (NOTIFICATION_TYPE_UI as Record<string, NotificationTypeUi>)[tipo] ??
    FALLBACK_UI
  );
}
