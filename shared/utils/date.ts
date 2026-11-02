/**
 * Utilitários centralizados de formatação de data (pt-BR).
 * Todas as telas devem usar estas funções para exibição consistente.
 */

/** Formata ISO em DD/MM/AAAA. Retorna "—" se inválido. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hourCycle: "h23",
  }).format(date);
}

/** Formata ISO em DD/MM/AAAA HH:mm. Retorna "—" se inválido. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Formata ISO em HH:mm. Retorna "—" se inválido. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Formata intervalo início–fim em "HH:mm — HH:mm". Sem fim, retorna só o início. */
export function formatInterval(
  inicioIso: string | null | undefined,
  fimIso: string | null | undefined,
): string {
  const inicio = formatTime(inicioIso);
  if (!fimIso) return inicio;
  const fim = formatTime(fimIso);
  if (fim === "—") return inicio;
  return `${inicio} — ${fim}`;
}
