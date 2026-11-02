import { cn } from "../../libs/utils";

type KpiIcon = "clock" | "alert" | "inbox" | "clipboard";
type KpiTone = "info" | "danger" | "neutral";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon?: KpiIcon;
  tone?: KpiTone;
}

const TONE_STYLES: Record<KpiTone, { chip: string; icon: string }> = {
  info: { chip: "bg-[#E6F1FB] text-[#0C447C]", icon: "bg-[#E6F1FB] text-[#0C447C]" },
  danger: { chip: "bg-[#FCEBEB] text-[#791F1F]", icon: "bg-[#791F1F] text-white" },
  neutral: { chip: "bg-[#F1EFE8] text-[#5F5E5A]", icon: "bg-[#F1EFE8] text-[#5F5E5A]" },
};

function KpiIconSvg({ icon }: { icon: KpiIcon }) {
  if (icon === "clock") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (icon === "alert") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
  }
  if (icon === "clipboard") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <path d="M10 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
        <rect x="3.5" y="4.5" width="13" height="14" rx="2" />
        <path d="M7.5 11.5h5" />
        <path d="M7.5 15h5" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
      aria-hidden="true"
    >
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
    </svg>
  );
}

/** Cartão de indicador do painel (RFF05/RFF09) no padrão visual do app. */
export function KpiCard({
  title,
  value,
  subtitle,
  icon = "inbox",
  tone = "neutral",
}: KpiCardProps) {
  const styles = TONE_STYLES[tone];
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <p className="px-4 pt-3 pb-2 text-sm font-semibold text-gray-700 bg-stone-100 border-b border-stone-200">
        {title}
      </p>
      <div className="p-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "w-12 h-12 rounded-lg grid place-items-center shrink-0",
            styles.icon,
          )}
        >
          <KpiIconSvg icon={icon} />
        </span>
        <div className="min-w-0">
          <p className="text-3xl font-bold text-gray-800 leading-none">{value}</p>
          <p className="mt-1 text-xs text-gray-500 leading-snug">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export default KpiCard;
