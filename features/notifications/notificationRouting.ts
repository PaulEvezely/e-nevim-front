import type { Role } from "../auth/types/login";

export function resolveNotificationRoute(
  entidade: string | null,
  entidadeId: string | null,
  role: Role | null,
): string | null {
  if (!entidade || !entidadeId || !role) return null;

  // Nota: o back-end não tem perfil ADMIN (só GESTOR); "admin" aqui é
  // mapeamento defensivo para sessões legadas — cai nas telas do gestor.
  if (entidade === "demanda") {
    if (role === "manager" || role === "admin") {
      return `/manager/demandas/${encodeURIComponent(entidadeId)}`;
    }
    return null;
  }

  if (entidade === "consulta") {
    if (role === "manager" || role === "admin") return "/manager/consultas";
    // Profissional tem agenda própria (mockup 05 validado: consulta → agenda).
    if (role === "professional") return "/professional/appointments";
    if (role === "user") return "/user/process";
  }

  // TRIAGEM_REGISTRADA, PROCESSO_ENCAMINHADO, PROCESSO_ENCERRADO,
  // FRIDA_PREENCHIDO e FRIDA_ATUALIZADO chegam com entidade="processo"
  // e entidadeId=processoId.
  if (entidade === "processo") {
    if (role === "manager" || role === "admin") {
      return `/manager/processos/${encodeURIComponent(entidadeId)}`;
    }
    // Vítima tem processo único (rota sem :id).
    if (role === "user") return "/user/process";
    // Profissional não tem detalhe de processo: leva à agenda, onde
    // processos vinculados aparecem com FRIDA/agendamento.
    if (role === "professional") return "/professional/appointments";
  }

  return null;
}
