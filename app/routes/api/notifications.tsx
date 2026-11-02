import { getOptionalUser } from "../../../features/auth/require-user.server";
import { ApiError } from "../../../libs/api.server";
import {
  fetchNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../../features/notifications/notificationsApi.server";

function unauthorized() {
  return Response.json({ error: "Sessão expirada." }, { status: 401 });
}

function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message, details: error.fieldErrors },
      { status: error.status },
    );
  }
  return Response.json(
    { error: "Não foi possível concluir agora. Tente novamente em instantes." },
    { status: 500 },
  );
}

function parseInteger(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function loader({ request }: { request: Request }) {
  const user = await getOptionalUser(request);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const lidaParam = url.searchParams.get("lida");
  const lida =
    lidaParam === "true" ? true : lidaParam === "false" ? false : undefined;

  try {
    const data = await fetchNotificationsPage(request, {
      limit: parseInteger(url.searchParams.get("limit")),
      offset: parseInteger(url.searchParams.get("offset")),
      lida,
    });
    return Response.json(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function action({ request }: { request: Request }) {
  const user = await getOptionalUser(request);
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    intent?: string;
    id?: string;
  } | null;

  try {
    if (body?.intent === "read-all") {
      await markAllNotificationsRead(request);
      return Response.json({ ok: true });
    }
    if (body?.intent === "read" && typeof body.id === "string" && body.id) {
      await markNotificationRead(request, body.id);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
