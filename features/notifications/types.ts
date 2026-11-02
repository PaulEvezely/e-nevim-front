/** Espelha o enum TipoNotificacao do back-end (prisma/schema.prisma). */
export type NotificationType =
  | "NOVA_DEMANDA"
  | "CADASTRO_VITIMA"
  | "CONSULTA_AGENDADA"
  | "CONSULTA_CANCELADA"
  | "CONSULTA_CONFIRMADA"
  | "CONSULTA_REALIZADA"
  | "CONSULTA_FALTA"
  | "LINK_MEET_DISPONIVEL"
  | "MEET_GERACAO_FALHOU"
  | "TRIAGEM_REGISTRADA"
  | "PROCESSO_ENCAMINHADO"
  | "PROCESSO_ENCERRADO"
  | "DEMANDA_REJEITADA"
  | "FRIDA_PREENCHIDO"
  | "FRIDA_ATUALIZADO"
  | "CONSULTA_CONFIRMADA_PARCIAL";

export interface NotificationItem {
  id: string;
  usuarioId: string;
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  lida: boolean;
  lidaEm: string | null;
  entidade: string | null;
  entidadeId: string | null;
  criadoEm: string;
}

export interface NotificationsResponse {
  total: number;
  naoLidas: number;
  limite: number;
  offset: number;
  notificacoes: NotificationItem[];
}

export interface AppointmentReminder {
  id: string;
  tipoProfissional: string;
  dataHora: string;
  modalidade: string | null;
  linkMeet: string | null;
}
