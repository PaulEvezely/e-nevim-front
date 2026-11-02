import type { CSSProperties } from "react";

/** Estilo padrão do tooltip dos gráficos (alto contraste, sem borda). */
export const TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "#1F2937",
  border: "none",
  borderRadius: "8px",
  color: "#F9FAFB",
  fontSize: "12px",
  padding: "8px 10px",
  boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
};

/** Cor da grade dos eixos (tom neutro do Tailwind stone). */
export const GRID_COLOR = "#E7E5E4";

/** Cor de destaque do cursor/hover nas barras. */
export const CURSOR_FILL = "#F5F5F4";

/** Cor padrão para séries neutras (primária do PRD §10.1). */
export const PRIMARY_FILL = "#378ADD";
