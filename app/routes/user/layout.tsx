import { useState } from "react";
import { Outlet } from "react-router";
import { requireUser } from "../../../features/auth/require-user.server";
import type { Route } from "./+types/layout";
import { AppHeader } from "../../../shared/layouts/AppHeader";
import { UserSidebar } from "../../../features/user/components/UserSidebar";

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await requireUser(request, ["user"]) };
}

export default function UserLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-stone-100 lg:flex">
      <UserSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="min-w-0 flex-1 flex flex-col min-h-screen">
        <div className="p-4 flex-1">
          <div className="mb-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M3 5.5h14M3 10h14M3 14.5h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Menu
            </button>
          </div>
          <header className="app-header mb-4">
            <AppHeader perfilLabel="" user={user} />
          </header>

          <main>
            <Outlet />
          </main>
        </div>
        <footer className="w-full bg-white border-t border-stone-200 mt-8">
          <div className="max-w-6xl mx-auto px-4 py-6 flex justify-center">
            <img
              src="/imagem_3.png"
              alt="Logos institucionais: NEVIM, Universidade Estadual do Piauí, Secretaria da Segurança Pública SSP-PI, Governo do Piauí"
              className="w-full max-w-4xl h-auto object-contain"
              loading="lazy"
            />
          </div>
        </footer>
      </div>
    </div>
  );
}
