import { useEffect } from "react";
import { NavLink } from "react-router";
import { cn } from "../../libs/utils";

export type SidebarItem = {
  label: string;
  to: string;
  icon?: React.ReactNode;
  end?: boolean;
};

type SidebarProps = {
  items: SidebarItem[];
  open: boolean;
  onClose: () => void;
  title?: string;
  navLabel?: string;
  menuLabel?: string;
};

function SidebarContent({
  items,
  onNavigate,
  title,
  navLabel = "Navegação do gestor",
}: {
  items: SidebarItem[];
  onNavigate?: () => void;
  title?: string;
  navLabel?: string;
}) {
  return (
    <div className="flex h-full flex-col">
      {title ? (
        <p className="px-4 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </p>
      ) : null}
      <nav aria-label={navLabel} className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                "text-gray-600 hover:bg-stone-100 hover:text-gray-900",
                isActive &&
                  "bg-[#E6F1FB] text-[#0C447C] font-semibold hover:bg-[#E6F1FB] hover:text-[#0C447C]"
              )
            }
          >
            {item.icon ? (
              <span aria-hidden="true" className="grid h-5 w-5 place-items-center shrink-0">
                {item.icon}
              </span>
            ) : null}
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Sidebar({
  items,
  open,
  onClose,
  title,
  navLabel = "Navegação do gestor",
  menuLabel = "Menu do gestor",
}: SidebarProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-r border-stone-200 bg-white min-h-screen sticky top-0 h-screen">
        <SidebarContent items={items} title={title} navLabel={navLabel} />
      </aside>

      {/* Mobile: drawer */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-40 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={menuLabel}
          className={cn(
            "absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-xl transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <span className="text-sm font-semibold text-gray-800">Menu</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar menu"
              className="rounded-lg p-2 text-gray-500 hover:bg-stone-100 hover:text-gray-800"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <SidebarContent
            items={items}
            onNavigate={onClose}
            title={title}
            navLabel={navLabel}
          />
        </aside>
      </div>
    </>
  );
}

export default Sidebar;
