import { Sidebar, type SidebarItem } from "../../../shared/components/Sidebar";

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 10.5 10 3.5l7 7V16a1 1 0 0 1-1 1h-4.5v-4h-3v4H4a1 1 0 0 1-1-1v-5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AppointmentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 8.5h13M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3a4.5 4.5 0 0 0-4.5 4.5c0 3-1.2 4.2-1.7 4.8-.3.4 0 1.2.6 1.2h11.2c.6 0 .9-.8.6-1.2-.5-.6-1.7-1.8-1.7-4.8A4.5 4.5 0 0 0 10 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 15.5a1.6 1.6 0 0 0 3 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function getProfessionalNavItems(): SidebarItem[] {
  return [
    { label: "Início", to: "/professional", icon: <HomeIcon />, end: true },
    {
      label: "Minha agenda",
      to: "/professional/appointments",
      icon: <AppointmentsIcon />,
    },
    {
      label: "Notificações",
      to: "/professional/notificacoes",
      icon: <BellIcon />,
    },
  ];
}

export function ProfessionalSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sidebar
      items={getProfessionalNavItems()}
      open={open}
      onClose={onClose}
      title="Atendimento"
      navLabel="Navegação do profissional"
      menuLabel="Menu do profissional"
    />
  );
}

export default ProfessionalSidebar;
