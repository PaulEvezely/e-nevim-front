# NEVIM — FRIDA (Avaliação de Risco)

**Documento:** SISTEMA-09-FRIDA
**Pasta front:** `features/professional/frida/` · **Backend:** `frida.routes.ts` (`/frida-forms`), `processes.routes.ts` (`/processes/:id/frida`, `PATCH /:id/triagem`)
**Referências:** `PLANO_FRIDA.md`, `PLANO_FRONTEND_FRIDA.md`, `PLANO_TRIAGEM_PSICOLOGO.md`

---

## 1. O que é

Formulário de Avaliação de Risco (modelo padronizado, 19 perguntas + avaliação estruturada). **1 por processo**, preenchido na 1ª consulta `REALIZADA`. Classifica risco `BAIXO/MEDIO/ELEVADO` (cálculo automático + nível profissional justificado) e sincroniza `Processo.classificacaoRisco`. RF11/RF12, RFF07.

## 2. Perguntas (`fridaQuestions.ts`, `FRIDA_QUESTIONS`, 19)

Opções fixas `FridaAnswerValue = SIM | NAO | NAO_SEI | NAO_SE_APLICA` (labels `Sim/Não/Não sabe/Não se aplica`, ordem fixa). `subanswers` (checkboxes) não entram na contagem. Categorias: `escalada | vitima | agressor | contexto`.

| # | Pergunta | Categoria / detalhe |
|---|---|---|
| P1 | Escalada da violência | `escalada` |
| P2 | Gravidez / bebê 18m | `vitima` |
| P3 | Filhos com agressor / guarda | `vitima` + helper `Não se aplica` |
| P4 | Perseguição, ciúme, controle | `agressor` |
| P5 | Separação | `contexto` + sub `separou/tentou/manifestou_intencao` |
| P6 | Violência com outros | `agressor` + sub `criancas/outros_familiares/outras_pessoas` |
| P7 | Animal | `contexto` + helper |
| P8 | Agressão física | `escalada` |
| P9 | Estrangulamento/sufocamento/afogamento | `escalada` |
| P10 | Ameaça de morte | `escalada` |
| P11 | Arma de fogo | `escalada` + sub `usou/ameacou_usar/facil_acesso` |
| P12 | Outra arma | `escalada` |
| P13 | Atendimento/internação | `vitima` + sub `atendimento_medico/internacao` |
| P14 | Drogas/álcool | `agressor` |
| P15 | Medicação psiquiátrica | `agressor` |
| P16 | Medida protetiva | `contexto` + helper |
| P17 | Suicídio do agressor | `agressor` |
| P18 | Sexo forçado | `escalada` |
| P19 | Dificuldades financeiras | `contexto` |

## 3. Scoring (`fridaScoring.ts`)

- `summarizeAnswers`: conta `sim/nao/naoSei/naoSeAplica`.
- `riskLevelFromCounts(sim, nsNa)`: `sim ≥ 10 → ELEVADO`; `nsNa > 10 → MEDIO`; senão `RISK_GRID[simRow][nsNaCol]` (9 linhas `0-2/3/4/5/6/7/8/9/10-19` × 12 colunas `0..10/11-19`).
- `calculateRiskLevel` + `resolveAttributedRisk` (mantém nível atribuído manual se não divergiu do cálculo anterior).
- Parte 2 `StructuredAssessment` (obrigatória, 7 textos): `percepcaoRisco/outrasInformacoes/estadoFisicoEmocional/riscoSuicidio/resideComAgressor/outrasCircunstancias/encaminhamentos` + `nivelRiscoProfissional + justificativa` + `concordouEncaminhamentos/interesseAderir` (+ justificativa se `NAO`).
- `isDivergentRisk`: sinaliza divergência cálculo × atribuído (justificativa obrigatória).
- `validateFridaDraft` (`fridaValidation.ts`): exige 19 respostas + 7 textos + nível + justificativa.
- `fridaDraft.ts`: rascunho ofuscado `localStorage`, TTL 24h.
- `fridaPdf.ts`: PDF client-side; instruções em `public/frida/` (`FridaInstructionsLink`).

## 4. Permissões

| Papel | Pode |
|---|---|
| `GESTOR` | Criar FRIDA em `TRIAGEM REALIZADA` própria; ler qualquer FRIDA; corrigir qualquer (`PATCH`) |
| `PSICOLOGO` | Criar em `PSICOLOGO REALIZADA` própria; ler/corrigir próprio |
| `ASSISTENTE_SOCIAL` | Criar em `TRIAGEM REALIZADA` própria; corrigir qualquer (auditoria) |
| `ASSESSOR_JURIDICO` | Somente leitura vinculada (403 fora do vínculo) |
| `VITIMA` | 403 (só histórico parcial do processo) |

Plano pendente (`PLANO_TRIAGEM_PSICOLOGO.md`, proposto 2026-10-29): permitir gestor agendar triagem para `GESTOR OU PSICOLOGO` (hoje só auto-atribuída); mudaria `mapaTipoPerfil.TRIAGEM` para array e removeria bloco `profissionalId==req.usuario.id` (mantendo middleware `GESTOR`); FRIDA seguiria `gestorId|psicologoId`.

## 5. API

| Método | Path | RBAC | Regra |
|---|---|---|---|
| `POST` | `/frida-forms` | `GESTOR, PSI, ASSIST` | `{consultaId, respostas{version, answers, subanswers, assessment}, nivelRisco}`; só `TRIAGEM/PSICOLOGO AGENDADA/REALIZADA` própria; autor por perfil (`gestorId/psicologoId/assistenteSocialId`); 1/processo (409); `ABERTO→EM_TRIAGEM` + sincroniza risco |
| `GET` | `/frida-forms/:id` | dono/GESTOR | 403 resto |
| `PATCH` | `/frida-forms/:id` | `PSI, ASSIST, GESTOR` | Correção auditada; notifica (`FRIDA_ATUALIZADO`) se risco mudou |
| `GET` | `/processes/:id/frida` | `GESTOR + vinculados` | FRIDA do processo ou `{frida:null}`; VITIMA 403 |

Tipos front (`fridaTypes.ts`): `FridaRecord/Draft/StructuredAssessment`; `fridaApi.server.ts`: `create/get/getProcessFrida/update`.

## 6. Telas (`loadFridaPage` / `handleFridaAction` em `fridaPage.server.ts`)

- Modos: `create` (sem FRIDA + consulta `REALIZADA` + papel escritor) / `edit` (dono/gestor/assistente) / `read` (vinculado sem escrita) / `blocked` (papel errado, consulta não realizada, FRIDA de outro processo).
- Rotas: `/manager/frida/:consultaId` (`backHref=/manager/consultas`) e `/professional/frida/:consultaId` (`backHref=/professional/appointments`).
- Componentes: `FridaPage` (orquestra), `FridaForm`, `FridaQuestionField`, `FridaStructuredAssessment`, `FridaReadOnly`, `FridaRiskBadge`, `FridaInstructionsLink`.
- Notificações: `FRIDA_PREENCHIDO/ATUALIZADO` (dono + gestor); risco sincronizado aparece em dashboards (`/dashboard/frida`, `/dashboard/summary`) e no dossiê do processo.
