import type { Role } from "./types/login";

/** Rota inicial de cada papel (usada pelo logo do AppHeader e redirecionamentos). */
export const ROLE_HOME: Record<Role, string> = {
  user: "/user",
  manager: "/manager",
  professional: "/professional",
  admin: "/admin",
};

/** Rota inicial do papel do usuário; "/" para papel desconhecido/ausente. */
export function getHomeRoute(role: Role | null | undefined): string {
  if (!role) return "/";
  return ROLE_HOME[role] ?? "/";
}
