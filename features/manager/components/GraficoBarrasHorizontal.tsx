import type { ReactNode } from "react";
import { GraficoBarras } from "./GraficoBarras";
import type { StatusColorMap } from "../dashboardUtils";

interface GraficoBarrasHorizontalProps {
  title: string;
  subtitle?: string;
  data?: Record<string, number>;
  colorMap?: StatusColorMap;
  height?: number;
  actions?: ReactNode;
  showPercent?: boolean;
}

/** Variante horizontal para categorias com rótulos longos (cursos, etnia...). */
export function GraficoBarrasHorizontal({
  title,
  subtitle,
  data,
  colorMap,
  height = 260,
  actions,
  showPercent,
}: GraficoBarrasHorizontalProps) {
  return (
    <GraficoBarras
      title={title}
      subtitle={subtitle}
      data={data}
      colorMap={colorMap}
      horizontal
      height={height}
      actions={actions}
      showPercent={showPercent}
    />
  );
}

export default GraficoBarrasHorizontal;
