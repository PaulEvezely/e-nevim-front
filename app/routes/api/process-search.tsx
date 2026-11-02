import { data } from "react-router";
import type { Route } from "./+types/process-search";
import { requireUser } from "../../../features/auth/require-user.server";
import { appointmentApi } from "../../../features/manager/appointmentApi.server";

/**
 * GET /api/process-search?q=&triage=ALL&limit=20
 * Busca digitável de processos (via GET /victims) para o combobox de agendamento.
 * Apenas GESTOR tem acesso (mesma permissão de /victims e POST /appointments).
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["manager"]);

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const triageParam = (url.searchParams.get("triage") ?? "ALL").toUpperCase();
  const triage = ["ALL", "SEM_TRIAGEM", "EM_TRIAGEM", "ENCAMINHADO", "ENCERRADO"].includes(triageParam)
    ? (triageParam as "ALL" | "SEM_TRIAGEM" | "EM_TRIAGEM" | "ENCAMINHADO" | "ENCERRADO")
    : "ALL";
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
  const tipo = url.searchParams.get("tipo")?.toUpperCase() ?? "";

  try {
    // Para TRIAGEM, buscamos SEM_TRIAGEM + EM_TRIAGEM (ABERTO aceita triagem)
    // Para acompanhamento, buscamos tudo e filtraremos no cliente por status,
    // mas aqui já limitamos no servidor quando possível.
    let options = await appointmentApi.searchProcessOptions(request, q, triage, limit);

    // Filtro adicional por compatibilidade de tipo (opcional, sem quebrar)
    // Se tipo=TRIAGEM, apenas ABERTO/EM_TRIAGEM são válidos (definido em appointmentUtils)
    if (tipo === "TRIAGEM") {
      options = options.filter((o) => o.status === "ABERTO" || o.status === "EM_TRIAGEM");
    } else if (tipo && tipo !== "ALL" && triage === "ALL") {
      // Para PSICOLOGO etc, não filtramos aqui — o AppointmentForm já filtra por tipo
      // e o processo pode ser EM_TRIAGEM (que será encaminhado). Deixa passar.
    }

    // Fallback: se query é UUID completo e victims não retornou, tenta busca direta por id
    if (
      options.length === 0 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)
    ) {
      const single = await appointmentApi.getProcessOptionById(request, q).catch(() => null);
      if (single) options = [single];
    }

    return data({ options });
  } catch (err) {
    // Não vazar stack ao combobox — retorna lista vazia e loga no servidor
    console.warn("[process-search] falha na busca:", err);
    return data({ options: [] });
  }
}
