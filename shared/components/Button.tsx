import { cn } from "../../libs/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-blue-500 hover:bg-blue-600 text-white",
  secondary: "bg-gray-500 hover:bg-gray-600 text-white",
  outline: "border-2 border-blue-500 text-blue-500 hover:bg-blue-50",
  danger: "bg-red-500 hover:bg-red-600 text-white",
};

const baseStyles =
  "px-4 py-2 rounded-lg font-semibold transition-colors duration-200 outline-none shadow-lg cursor-pointer";

export function Button({
  type = "button",
  variant = "primary",
  loading,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}

      className={cn(baseStyles, variantStyles[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Carregando..." : children}
    </button>
  );
}
