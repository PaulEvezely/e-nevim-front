import type { User } from "../../features/auth/types/login";
import { getHomeRoute } from "../../features/auth/roleHome";
import EmergencyExitButton from "../components/EmergencyExitButton";
import { NotificationBell } from "../components/NotificationBell";
import { Form, Link } from "react-router";

export function AppHeader({
  perfilLabel,
  user,
}: {
  perfilLabel: string;
  user: User;
}) {
  return (
    <header
      aria-label="Cabeçalho do sistema NEVIM"
      className="w-full bg-white border border-stone-200 rounded-2xl shadow-sm px-3 sm:px-5 py-3 flex items-center justify-between gap-2 sm:gap-3 flex-nowrap"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <Link
          to={getHomeRoute(user.role)}
          aria-label={
            perfilLabel
              ? `NEVIM - Início (${perfilLabel})`
              : "NEVIM - Página inicial"
          }
          className="shrink min-w-0 flex items-center"
        >
          <img
            src="/imagem_2.png"
            alt="Núcleo de Enfrentamento à Violência contra a Mulher"
            className="h-9 sm:h-10 lg:h-15 w-auto max-w-[110px] min-[400px]:max-w-[130px] sm:max-w-[160px] lg:max-w-[260px] object-contain"
            loading="eager"
          />
        </Link>
        {perfilLabel ? (
          <span
            title={perfilLabel}
            className="shrink min-w-0 bg-[#E6F1FB] border border-[#dbeafe] text-[#0C447C] text-[10px] min-[400px]:text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full leading-none truncate max-w-[90px] min-[400px]:max-w-[120px] sm:max-w-[140px] lg:max-w-none"
          >
            {perfilLabel}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <NotificationBell />

        <span
          aria-hidden="true"
          className="hidden sm:block w-px h-8 bg-stone-200"
        />

        <div className="flex items-center gap-1 sm:gap-2">
          <span className="hidden md:block leading-tight min-w-0">
            <span className="block text-sm font-medium text-gray-800 truncate max-w-[140px] lg:max-w-[200px]">
              {user.name}
            </span>
            <span className="block text-[11px] text-gray-500 truncate max-w-[140px] lg:max-w-[200px]">
              {user.email}
            </span>
          </span>
          <Form method="post" action="/logout" className="shrink-0">
            <button
              type="submit"
              aria-label="Sair da conta"
              className="text-xs font-semibold text-gray-500 hover:text-[#791F1F] hover:underline underline-offset-2 px-1 sm:px-2 py-1"
            >
              Sair
            </button>
          </Form>
        </div>
      </div>

      {user.role === "user" ? <EmergencyExitButton /> : null}
    </header>
  );
}
