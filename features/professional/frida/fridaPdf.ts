import {
  FRIDA_ANSWER_LABELS,
  RISK_LEVEL_LABELS,
  type FridaAnswers,
  type FridaRespostasPayload,
  type RiskLevel,
  type StructuredAssessment,
} from "./fridaTypes";
import { FRIDA_QUESTIONS } from "./fridaQuestions";
import { calculateRiskLevel } from "./fridaScoring";

/**
 * Geração client-side do PDF do FRIDA (todo o formulário).
 * Todo o conteúdo já está no navegador (a tela exibe os mesmos dados);
 * nada novo é buscado do back-end para montar o documento.
 */

export type FridaPdfInput = {
  processoIdCurto: string;
  consultaTipo: string;
  consultaQuando: string;
  consultaStatus: string;
  registradoEm: string;
  /** Nível atribuído na avaliação (fonte: assessment; fallback: registro do FRIDA). */
  nivelRiscoAtribuido: RiskLevel;
  respostas: FridaRespostasPayload;
};

const RISK_STYLE: Record<RiskLevel, { bg: [number, number, number]; fg: [number, number, number] }> = {
  BAIXO: { bg: [234, 243, 222], fg: [39, 80, 10] },
  MEDIO: { bg: [250, 238, 218], fg: [133, 77, 11] },
  ELEVADO: { bg: [252, 235, 235], fg: [121, 31, 31] },
};

function yesNoLabel(value: string | undefined): string {
  if (value === "SIM") return "Sim";
  if (value === "NAO") return "Não";
  return "—";
}

function withJustification(main: string, extra: string | undefined): string {
  const trimmed = (extra ?? "").trim();
  if (!trimmed) return main;
  return `${main} — ${trimmed}`;
}

function answerLabel(questionId: string, answers: FridaAnswers): string {
  const value = answers[questionId];
  if (!value) return "Não registrada";
  return FRIDA_ANSWER_LABELS[value] ?? value;
}

function subanswerText(
  questionId: string,
  subanswers: FridaRespostasPayload["subanswers"],
): string {
  const question = FRIDA_QUESTIONS.find((item) => item.id === questionId);
  if (!question?.subquestions) return "";
  const selected = subanswers[questionId] ?? [];
  const labels = question.subquestions
    .filter((sub) => selected.includes(sub.id))
    .map((sub) => sub.label);
  return labels.length > 0 ? `Especificado: ${labels.join(", ")}` : "";
}

function assessmentRows(assessment: StructuredAssessment): [string, string][] {
  const text = (value: string): string => (value.trim() ? value : "—");
  return [
    ["Percepção de risco da usuária", text(assessment.percepcaoRisco)],
    ["Outras informações relevantes", text(assessment.outrasInformacoes)],
    ["Estado físico e emocional", text(assessment.estadoFisicoEmocional)],
    ["Risco de suicídio", text(assessment.riscoSuicidio)],
    ["Residência e acesso do agressor", text(assessment.resideComAgressor)],
    ["Outras circunstâncias de risco", text(assessment.outrasCircunstancias)],
    ["Justificativa do nível de risco", text(assessment.justificativa)],
    ["Encaminhamentos sugeridos", text(assessment.encaminhamentos)],
    [
      "A usuária concordou com os encaminhamentos",
      withJustification(
        yesNoLabel(assessment.concordouEncaminhamentos || undefined),
        assessment.concordouJustificativa,
      ),
    ],
    [
      "Interesse em aderir aos encaminhamentos",
      withJustification(
        yesNoLabel(assessment.interesseAderir || undefined),
        assessment.interesseJustificativa,
      ),
    ],
  ];
}

/** Nome de arquivo seguro: frida-<processo>-<AAAAMMDD-HHmm>.pdf */
export function fridaPdfFilename(processoIdCurto: string, now = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const safeId = processoIdCurto.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "processo";
  return `frida-${safeId}-${stamp}.pdf`;
}

/**
 * Monta o documento PDF do FRIDA completo (Parte 1 + Parte 2).
 * Imports dinâmicos para não pesar o bundle inicial (só carrega no clique).
 */
export async function buildFridaPdf(input: FridaPdfInput): Promise<{ save: (filename: string) => void }> {
  const [{ jsPDF }] = [await import("jspdf")];
  const autoTableModule = (await import("jspdf-autotable")) as unknown as {
    default?: unknown;
  } & Record<string, unknown>;
  // Compatível com o build CJS (module.exports.default) e ESM (export default).
  const autoTableCandidate =
    (autoTableModule as { default?: unknown }).default ?? autoTableModule;
  if (typeof autoTableCandidate !== "function") {
    throw new Error("Falha ao carregar o gerador de tabelas do PDF.");
  }
  const autoTable = autoTableCandidate as (
    doc: unknown,
    options: Record<string, unknown>,
  ) => void;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  // Metadados fixos: nada de usuário/máquina vaza no arquivo.
  doc.setProperties({
    title: "FRIDA — Formulário de Avaliação de Risco",
    subject: `Processo ${input.processoIdCurto}`,
    author: "NEVIM",
    creator: "NEVIM",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("NEVIM — Formulário FRIDA de Avaliação de Risco", margin, cursorY);
  cursorY += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `Documento gerado a partir do registro do sistema. Uso sigiloso — não compartilhe.`,
    margin,
    cursorY,
  );
  doc.setTextColor(0);
  cursorY += 8;

  doc.setFontSize(11);
  const metaLines = [
    `Atendimento: ${input.consultaTipo} — ${input.consultaQuando} (${input.consultaStatus})`,
    `Processo: ${input.processoIdCurto}`,
    `Registrado em: ${input.registradoEm}`,
  ];
  for (const line of metaLines) {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped, margin, cursorY);
    cursorY += wrapped.length * 5;
  }
  cursorY += 2;

  const calculado = calculateRiskLevel(input.respostas.answers);
  const atribuido = input.respostas.assessment.nivelRiscoProfissional || input.nivelRiscoAtribuido;
  const style = RISK_STYLE[atribuido];
  doc.setFillColor(...style.bg);
  doc.setTextColor(...style.fg);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const riskLabel = `Nível de risco: ${RISK_LEVEL_LABELS[atribuido]}`;
  const riskLines = doc.splitTextToSize(riskLabel, contentWidth - 8);
  const riskBoxH = riskLines.length * 6 + 6;
  doc.roundedRect(margin, cursorY, contentWidth, riskBoxH, 2, 2, "F");
  doc.text(riskLines, margin + 4, cursorY + 6);
  cursorY += riskBoxH + 4;
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const calcLine = `Calculado pela grelha: ${RISK_LEVEL_LABELS[calculado]}${calculado !== atribuido ? " (divergente do atribuído — ver justificativa)" : ""}`;
  const calcWrapped = doc.splitTextToSize(calcLine, contentWidth);
  doc.text(calcWrapped, margin, cursorY);
  cursorY += calcWrapped.length * 5 + 4;

  // ---- Parte 1: perguntas em ordem numérica, sem agrupamento por seção ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Parte 1 — Formulário de risco", margin, cursorY);
  cursorY += 2;

  const rows = FRIDA_QUESTIONS.map((question) => {
    const answer = answerLabel(question.id, input.respostas.answers);
    const sub = subanswerText(question.id, input.respostas.subanswers);
    return [
      String(question.number),
      question.prompt,
      sub ? `${answer}\n${sub}` : answer,
    ];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [["Nº", "Pergunta", "Resposta"]],
    body: rows,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [12, 68, 124], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      2: { cellWidth: 42 },
    },
    margin: { left: margin, right: margin },
  });

  // ---- Parte 2: avaliação estruturada ----
  let part2Y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  if (part2Y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    part2Y = 18;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Parte 2 — Avaliação estruturada", margin, part2Y);
  let assessmentY = part2Y + 7;
  doc.setFontSize(10);
  for (const [label, value] of assessmentRows(input.respostas.assessment)) {
    doc.setFont("helvetica", "bold");
    const labelLines = doc.splitTextToSize(label, contentWidth);
    if (assessmentY + labelLines.length * 5 + 8 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      assessmentY = 18;
    }
    doc.text(labelLines, margin, assessmentY);
    assessmentY += labelLines.length * 5;
    doc.setFont("helvetica", "normal");
    const valueLines = doc.splitTextToSize(value || "—", contentWidth);
    for (const line of valueLines) {
      if (assessmentY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        assessmentY = 18;
      }
      doc.text(line, margin, assessmentY);
      assessmentY += 5;
    }
    assessmentY += 3;
  }

  // ---- Rodapé com paginação ----
  const totalPages = doc.getNumberOfPages();
  const generatedAt = new Date().toLocaleString("pt-BR");
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Gerado em ${generatedAt} · NEVIM — documento sigiloso`,
      margin,
      doc.internal.pageSize.getHeight() - 10,
    );
    doc.text(
      `Página ${page} de ${totalPages}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 10,
      { align: "right" },
    );
    doc.setTextColor(0);
  }

  return {
    save: (filename: string) => {
      doc.save(filename);
    },
  };
}
