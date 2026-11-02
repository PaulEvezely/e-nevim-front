import { cn } from "../../../../libs/utils";

export const FRIDA_INSTRUCTIONS_PDF_HREF = "/frida/FRIDA_2_WEB.pdf";

type FridaInstructionsLinkProps = {
  className?: string;
};

export function FridaInstructionsLink({
  className,
}: FridaInstructionsLinkProps) {
  return (
    <a
      href={FRIDA_INSTRUCTIONS_PDF_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[#378ADD] hover:text-[#0C447C]",
        className,
      )}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 2.5h5l3 3V17a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 6 17V3a.5.5 0 0 1 .5-.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M11 2.5V6h3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M8 10.5h4M8 13h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      Ver instruções (PDF)
    </a>
  );
}

export default FridaInstructionsLink;
