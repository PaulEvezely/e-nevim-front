import { redirect } from "react-router";
import jwt from "jsonwebtoken";
import { getSession, destroySession } from "./cookie.server";
import type { Role, User } from "./types/login";
import { mapPerfilParaUser } from "./mapPerfil";

export interface PayloadToken {
  sub: string;
  email: string;
  profile?: string;
  perfil?: string;
  name?: string;
  nome?: string;
  exp?: number;
  iat?: number;
}

export function getProfileValue(payload: PayloadToken): string {
  return payload.profile ?? payload.perfil ?? "";
}

import { ROLE_HOME, getHomeRoute } from "./roleHome";

export { ROLE_HOME, getHomeRoute };

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET environment variable");
  }
  return secret;
}

export async function requireUser(
  request: Request,
  allowedRoles?: Role[]
): Promise<User> {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");

  if (!token) {
    throw redirect("/login");
  }

  let payload: PayloadToken;
  try {
    payload = jwt.verify(token, getJwtSecret()) as PayloadToken;
  } catch {
    throw redirect("/login", {
      headers: { "Set-Cookie": await destroySession(session) },
    });
  }

  if (!payload.sub || !payload.email || !getProfileValue(payload)) {
    throw redirect("/login", {
      headers: { "Set-Cookie": await destroySession(session) },
    });
  }

  const user = mapPerfilParaUser(payload);

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const home = ROLE_HOME[user.role] ?? "/";
    throw redirect(home);
  }

  return user;
}

export async function getOptionalUser(request: Request): Promise<User | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret()) as PayloadToken;
    if (!payload.sub || !payload.email || !getProfileValue(payload)) return null;
    return mapPerfilParaUser(payload);
  } catch {
    return null;
  }
}
