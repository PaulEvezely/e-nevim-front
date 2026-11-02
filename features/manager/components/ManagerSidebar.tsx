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

function DemandsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 4h10a1 1 0 0 1 1 1v11l-2.5-1.5L11 16l-2.5-1.5L6 16l-2-1.2V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M7.5 8h5M7.5 11h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function RegisterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4 16.5c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PatientsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 17s5.5-4.6 5.5-9.2A5.5 5.5 0 0 0 10 4.5 5.5 5.5 0 0 0 4.5 7.8C4.5 12.4 10 17 10 17Z"
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

function TriageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.5" y="3" width="13" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 8l2 2 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 13.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 13.5V9m4 4.5V5.5m4 8V8m4 5.5v-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
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

export function getManagerNavItems(): SidebarItem[] {
  return [
    { label: "Início", to: "/manager", icon: <HomeIcon />, end: true },
    { label: "Demandas", to: "/manager/demandas", icon: <DemandsIcon /> },
    { label: "Cadastro", to: "/manager/cadastro", icon: <RegisterIcon /> },
    { label: "Pacientes", to: "/manager/pacientes", icon: <PatientsIcon /> },
    { label: "Consultas", to: "/manager/consultas", icon: <AppointmentsIcon /> },
    { label: "Minhas triagens", to: "/manager/minhas-triagens", icon: <TriageIcon /> },
    { label: "Notificações", to: "/manager/notificacoes", icon: <BellIcon /> },
    { label: "Dashboards", to: "/manager/dashboards", icon: <DashboardIcon /> },
  ];
}

export function ManagerSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return <Sidebar items={getManagerNavItems()} open={open} onClose={onClose} title="Gestão" />;
}

export default ManagerSidebar;
