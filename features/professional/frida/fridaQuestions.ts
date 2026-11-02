import type { FridaQuestion } from "./fridaTypes";

/**
 * As 19 perguntas do Formulário de Risco FRIDA (Parte 1).
 * Texto fiel ao instrumento original (`frida/FRIDA_2_WEB (1).md`).
 */
export const FRIDA_QUESTIONS: readonly FridaQuestion[] = [
  {
    id: "P1",
    number: 1,
    category: "escalada",
    prompt:
      "A violência vem aumentando de gravidade e/ou de frequência no último mês?",
  },
  {
    id: "P2",
    number: 2,
    category: "vitima",
    prompt:
      "A senhora/você está grávida ou teve bebê nos últimos 18 meses?",
  },
  {
    id: "P3",
    number: 3,
    category: "contexto",
    prompt:
      "A senhora/você tem filhos(as) com o(a) agressor(a)? Em caso afirmativo, estão vivendo algum conflito com relação à guarda dos filhos, visitas ou pagamento de pensão pelo agressor?",
    helper:
      "Caso não tenham filhos em comum, marque “Não se aplica”.",
  },
  {
    id: "P4",
    number: 4,
    category: "agressor",
    prompt:
      "O(A) agressor(a) persegue a senhora/você, demonstra ciúme excessivo, tenta controlar sua vida e as coisas que você faz (aonde você vai, com quem conversa, o tipo de roupa que usa, etc.)?",
  },
  {
    id: "P5",
    number: 5,
    category: "contexto",
    prompt:
      "A senhora/você se separou recentemente do(a) agressor(a), tentou ou tem intenção de se separar?",
    subquestions: [
      { id: "separou", label: "Separou" },
      { id: "tentou", label: "Tentou" },
      { id: "manifestou_intencao", label: "Manifestou intenção" },
    ],
  },
  {
    id: "P6",
    number: 6,
    category: "agressor",
    prompt:
      "O(A) agressor(a) também é violento com outras pessoas (familiares, amigos, colegas etc.)?",
    subquestions: [
      { id: "criancas", label: "Crianças" },
      { id: "outros_familiares", label: "Outros familiares" },
      { id: "outras_pessoas", label: "Outras pessoas" },
    ],
  },
  {
    id: "P7",
    number: 7,
    category: "contexto",
    prompt:
      "A senhora/você possui algum animal doméstico? Em caso afirmativo, o(a) agressor(a) maltrata ou agride o animal?",
    helper:
      "Caso não tenha animal doméstico, marque “Não se aplica”.",
  },
  {
    id: "P8",
    number: 8,
    category: "agressor",
    prompt: "O(A) agressor(a) já a agrediu fisicamente outras vezes?",
  },
  {
    id: "P9",
    number: 9,
    category: "agressor",
    prompt:
      "Alguma vez o(a) agressor(a) tentou estrangular, sufocar ou afogar a senhora/você?",
  },
  {
    id: "P10",
    number: 10,
    category: "agressor",
    prompt:
      "O(A) agressor(a) já fez ameaças de morte ou tentou matar a senhora/você?",
  },
  {
    id: "P11",
    number: 11,
    category: "agressor",
    prompt:
      "O(A) agressor(a) já usou, ameaçou usar arma de fogo contra a senhora/você ou tem fácil acesso a uma arma?",
    subquestions: [
      { id: "usou", label: "Usou" },
      { id: "ameacou_usar", label: "Ameaçou usar" },
      { id: "facil_acesso", label: "Tem fácil acesso" },
    ],
  },
  {
    id: "P12",
    number: 12,
    category: "agressor",
    prompt:
      "O(A) agressor(a) já a ameaçou ou feriu com outro tipo de arma ou instrumento?",
  },
  {
    id: "P13",
    number: 13,
    category: "vitima",
    prompt:
      "A senhora/você necessitou de atendimento médico e/ou internação após algumas dessas agressões?",
    subquestions: [
      { id: "atendimento_medico", label: "Atendimento médico" },
      { id: "internacao", label: "Internação" },
    ],
  },
  {
    id: "P14",
    number: 14,
    category: "agressor",
    prompt:
      "O(A) agressor(a) é usuário de drogas e/ou bebidas alcoólicas?",
  },
  {
    id: "P15",
    number: 15,
    category: "agressor",
    prompt:
      "O(A) agressor(a) faz uso de medicação controlada para alguma doença mental/psiquiátrica?",
  },
  {
    id: "P16",
    number: 16,
    category: "contexto",
    prompt:
      "A senhora/você já teve ou tem medida protetiva de urgência? O(A) agressor(a) já descumpriu medida protetiva de afastamento ou proibição de contato?",
    helper:
      "Caso não tenha tido medidas protetivas de urgência antes, marque “Não se aplica”.",
  },
  {
    id: "P17",
    number: 17,
    category: "agressor",
    prompt:
      "O(A) agressor(a) já ameaçou ou tentou se matar alguma vez?",
  },
  {
    id: "P18",
    number: 18,
    category: "agressor",
    prompt:
      "O(A) agressor(a) já obrigou a senhora/você a ter relações sexuais contra a sua vontade?",
  },
  {
    id: "P19",
    number: 19,
    category: "contexto",
    prompt:
      "O(A) agressor(a) está com dificuldades financeiras, está desempregado ou tem dificuldade de se manter no emprego?",
  },
] as const;

export const FRIDA_TOTAL_QUESTIONS = FRIDA_QUESTIONS.length;
