import { Link, useNavigation } from "react-router";
import {
  PROFESSIONAL_STATUS_OPTIONS,
  type AppointmentStatusFilter,
} from "../consultasUtils";

type ProfessionalStatusFilterProps = {
  status: AppointmentStatusFilter;
  counts: Record<AppointmentStatusFilter, number>;
};

function buildHref(status: AppointmentStatusFilter): string {
  return status === "ALL"
    ? "/professional/appointments"
    : `/professional/appointments?status=${status}`;
}

export function ProfessionalStatusFilter({
  status,
  counts,
}: ProfessionalStatusFilterProps) {
  const navigation = useNavigation();
  const filtering = navigation.state !== "idle";

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filtrar por status"
      aria-busy={filtering}
    >
      {PROFESSIONAL_STATUS_OPTIONS.map((option) => {
        const active = status === option.value;
        const count = counts[option.value] ?? 0;
        return (
          <Link
            key={option.value}
            to={buildHref(option.value)}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "rounded-full bg-[#0C447C] px-3 py-1.5 text-xs font-semibold text-white shadow"
                : "rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-stone-100"
            }
          >
            {option.label} · {count}
          </Link>
        );
      })}
    </div>
  );
}

export default ProfessionalStatusFilter;
