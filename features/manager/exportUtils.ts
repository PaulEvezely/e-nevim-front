import {
  formatMonthLabel,
  formatPeriodLabel,
  labelFor,
  toChartData,
  toMonthlySeries,
  type DashboardData,
  type DashboardPeriod,
} from "./dashboardUtils";

/** Célula aceita na geração de CSV. */
export type CsvCell = string | number | boolean | null | undefined;

/** Matriz de linhas/colunas exportada como CSV. */
export type CsvRows = CsvCell[][];

const CSV_DELIMITER = ";";
const CSV_BOM = "\uFEFF";

function escapeCsvCell(value: CsvCell): string {
  const text = value == null ? "" : String(value);
  if (/[";\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Serializa linhas em CSV (sem BOM). Separador `;` para Excel pt-BR. */
export function toCsv(rows: CsvRows, delimiter = CSV_DELIMITER): string {
  return rows.map((row) => row.map(escapeCsvCell).join(delimiter)).join("\r\n");
}

/** Converte texto em slug ASCII para nomes de arquivo. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Sufixo com o período e campus atuais da URL (lido apenas no clique, no cliente). */
export function currentPeriodSuffix(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const de = params.get("de");
  const ate = params.get("ate");
  const campus = params.get("campus");
  const parts: string[] = [];
  if (de || ate) parts.push(`${de ?? "inicio"}-a-${ate ?? "hoje"}`);
  if (campus) parts.push(slugify(campus));
  return parts.length > 0 ? `-${parts.join("-")}` : "";
}

/**
 * Dispara o download de um CSV com BOM UTF-8 (acentos corretos no Excel).
 * Deve ser chamado apenas em eventos do cliente.
 */
export function downloadCsv(filename: string, rows: CsvRows): void {
  if (typeof document === "undefined") return;
  const csv = `${CSV_BOM}${toCsv(rows)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatPercent(value: number, total: number): string {
  if (total <= 0) return "0,0%";
  return `${((value / total) * 100).toFixed(1).replace(".", ",")}%`;
}

/** Linhas de um gráfico categórico com percentual (mesma ordem do gráfico). */
export function categoricalCsvRows(
  record: Record<string, number> | undefined,
): CsvRows {
  const rows = toChartData(record);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return [
    ["Categoria", "Total", "Percentual"],
    ...rows.map((row) => [
      labelFor(row.key),
      row.value,
      formatPercent(row.value, total),
    ]),
  ];
}

/** Linhas de uma série mensal (`porMes`) com percentual sobre o total do período. */
export function monthlyCsvRows(
  record: Record<string, number> | undefined,
): CsvRows {
  const rows = toMonthlySeries(record);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return [
    ["Mês", "Total", "Percentual"],
    ...rows.map((row) => [
      formatMonthLabel(row.key),
      row.value,
      formatPercent(row.value, total),
    ]),
  ];
}

/** Linhas do donut de risco (total + percentual com vírgula decimal). */
export function donutCsvRows(
  record: Record<string, number> | undefined,
): CsvRows {
  const rows = toChartData(record);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return [
    ["Nível de risco", "Total", "Percentual"],
    ...rows.map((row) => {
      const pct = total > 0 ? (row.value / total) * 100 : 0;
      return [labelFor(row.key), row.value, `${pct.toFixed(1).replace(".", ",")}%`];
    }),
  ];
}

/** Linhas simples de um mapa `{ chave: total }` com percentual. */
export function recordCsvRows(
  record: Record<string, number> | undefined,
  label = "Categoria",
): CsvRows {
  const rows = Object.entries(record ?? {}).map(([key, value]) => ({
    key,
    value: value as number,
  }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return [
    [label, "Total", "Percentual"],
    ...rows.map((row) => [
      labelFor(row.key),
      row.value,
      formatPercent(row.value, total),
    ]),
  ];
}

/** Cabeçalho normalizado do CSV consolidado (Modelo A). */
const DASHBOARD_HEADER: CsvRows[number] = [
  "Bloco",
  "Gráfico",
  "Categoria",
  "Total",
  "Percentual",
  "Período",
  "Campus",
  "Gerado em",
];

/** CSV consolidado normalizado (Modelo A): colunas fixas, 1 linha por categoria. */
export function buildDashboardCsvRows(
  data: DashboardData,
  period: DashboardPeriod,
): CsvRows {
  const periodoLabel = formatPeriodLabel(period);
  const campusLabel = period.campus?.trim() || "Todos os campi";
  const geradoEm = new Date().toLocaleString("pt-BR");
  const rows: CsvRows = [DASHBOARD_HEADER];

  const pushCategorical = (
    bloco: string,
    grafico: string,
    record: Record<string, number> | undefined,
  ) => {
    const chartRows = toChartData(record);
    const total = chartRows.reduce((sum, row) => sum + row.value, 0);
    if (chartRows.length === 0) {
      rows.push([bloco, grafico, "—", 0, "0,0%", periodoLabel, campusLabel, geradoEm]);
      return;
    }
    for (const row of chartRows) {
      rows.push([
        bloco,
        grafico,
        labelFor(row.key),
        row.value,
        formatPercent(row.value, total),
        periodoLabel,
        campusLabel,
        geradoEm,
      ]);
    }
  };

  const pushMonthly = (
    bloco: string,
    grafico: string,
    record: Record<string, number> | undefined,
  ) => {
    const chartRows = toMonthlySeries(record);
    const total = chartRows.reduce((sum, row) => sum + row.value, 0);
    if (chartRows.length === 0) {
      rows.push([bloco, grafico, "—", 0, "0,0%", periodoLabel, campusLabel, geradoEm]);
      return;
    }
    for (const row of chartRows) {
      rows.push([
        bloco,
        grafico,
        formatMonthLabel(row.key),
        row.value,
        formatPercent(row.value, total),
        periodoLabel,
        campusLabel,
        geradoEm,
      ]);
    }
  };

  // Resumo
  pushCategorical("Resumo", "Demandas por status", data.summary.demandas);
  pushCategorical("Resumo", "Processos por status", data.summary.processos);
  pushCategorical("Resumo", "Risco no FRIDA", data.summary.risco?.frida);
  rows.push([
    "Resumo",
    "Consultas na semana",
    "Consultas na semana",
    data.summary.consultasSemana ?? 0,
    "—",
    periodoLabel,
    campusLabel,
    geradoEm,
  ]);
  rows.push([
    "Resumo",
    "Taxa de conversão (demandas → processos)",
    "Taxa de conversão",
    `${data.demandas.taxaConversao.toFixed(1).replace(".", ",")}%`,
    "—",
    periodoLabel,
    campusLabel,
    geradoEm,
  ]);

  // Demandas
  pushCategorical("Demandas", "Por status", data.demandas.porStatus);
  pushCategorical("Demandas", "Por tipo de violência", data.demandas.porTipoViolencia);
  pushCategorical("Demandas", "Por vínculo", data.demandas.porVinculo);
  pushCategorical("Demandas", "Por campus", data.demandas.porCampus);
  pushCategorical("Demandas", "Por local de ocorrência", data.demandas.porLocalOcorrencia);
  pushCategorical("Demandas", "Por curso", data.demandas.porCurso);
  pushMonthly("Demandas", "Evolução mensal", data.demandas.porMes);

  // Processos
  pushCategorical("Processos", "Por status", data.processos.porStatus);
  pushCategorical("Processos", "Por destino", data.processos.porDirecionadoPara);
  pushCategorical("Processos", "Por nível de risco", data.processos.porRisco);
  pushMonthly("Processos", "Abertos por mês", data.processos.porMes);

  // Consultas
  pushCategorical("Consultas", "Por status", data.consultas.porStatus);
  pushCategorical("Consultas", "Por profissional", data.consultas.porTipoProfissional);
  pushMonthly("Consultas", "Evolução mensal", data.consultas.porMes);

  // FRIDA
  pushCategorical("Risco e encaminhamentos", "FRIDA por nível de risco", data.frida.porNivelRisco);

  // Encaminhamentos
  pushCategorical("Risco e encaminhamentos", "Por destino", data.encaminhamentos.porDestino);
  pushMonthly("Risco e encaminhamentos", "Encaminhamentos por mês", data.encaminhamentos.porMes);

  // Perfil demográfico
  rows.push([
    "Perfil demográfico",
    "Total de casos com processo aberto",
    "Total",
    data.demografico.total,
    "100,0%",
    periodoLabel,
    campusLabel,
    geradoEm,
  ]);
  pushCategorical("Perfil demográfico", "Por sexo", data.demografico.porSexo);
  pushCategorical("Perfil demográfico", "Por gênero", data.demografico.porGenero);
  pushCategorical("Perfil demográfico", "Por etnia", data.demografico.porEtnia);
  pushCategorical("Perfil demográfico", "Por faixa etária", data.demografico.porFaixaIdade);

  return rows;
}
