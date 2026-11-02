# NEVIM — Índice da Documentação do Sistema

**Documento:** SISTEMA-00-INDICE
**Norma:** documentação detalhada gerada por leitura de código. Nenhum arquivo `.env` foi lido (variáveis citadas apenas pelo nome).

---

## Como navegar

| # | Documento | Conteúdo |
|---|---|---|
| 01 | `SISTEMA-01-VISAO-GERAL.md` | O que é o NEVIM, atores, conceitos (demanda/processo/consulta/FRIDA), RF01–RF23, RFF01–RFF18, paleta |
| 02 | `SISTEMA-02-ARQUITETURA.md` | Monorepo, SSR, diagrama, pastas, comunicação front↔back, integrações, deploy lógico |
| 03 | `SISTEMA-03-MODELO-DE-DADOS.md` | Prisma: enums, models, ER textual, regras de integridade fora do Prisma |
| 04 | `SISTEMA-04-BACKEND.md` | Boot, middlewares, 14 routers, serviços, utils, 20 testes, 11 scripts, dependências |
| 05 | `SISTEMA-05-FRONTEND.md` | Mapa de rotas, guards, áreas public/user/manager/professional/admin, `features/auth`, `libs`/`shared` |
| 06 | `SISTEMA-06-API-REFERENCE.md` | Todos os endpoints método a método (auth, demands, processes, appointments, frida, referrals, dashboard, etc.) |
| 07 | `SISTEMA-07-FLUXOS-DE-NEGOCIO.md` | 12 passos + opcionais, regras, jornada da vítima, fluxos por perfil, erros/validação |
| 08 | `SISTEMA-08-AUTENTICACAO-E-SEGURANCA.md` | Sessão JWT/cookie, RBAC, convites/tokens, AES/HMAC/Argon2, LGPD, rate-limit/CORS, botão pânico, auditoria |
| 09 | `SISTEMA-09-FRIDA.md` | 19 perguntas, scoring (`RISK_GRID`), avaliação estruturada, permissões, API, telas, PDF |
| 10 | `SISTEMA-10-NOTIFICACOES.md` | 17 tipos, emissão best-effort, `NotificationProvider`, lembretes 12h, routing, chips, fuso |
| 11 | `SISTEMA-11-DASHBOARDS-E-RELATORIOS.md` | 7 endpoints `/dashboard`, telas e CSV, relatórios sigilosos + PDF, dossiê do processo |
| 12 | `SISTEMA-12-GUIA-DESENVOLVIMENTO.md` | Setup, scripts, convenções, checklists (nova rota/tela), testes, deploy, arquivos vazios/mocks |

## Documentos pré-existentes (contexto histórico)

Mantidos intactos: `PRD-NEVIM.md` (normativo), `PLANO_FRIDA.md`, `PLANO_FRONTEND_FRIDA.md`, `PLANO_TRIAGEM_PSICOLOGO.md`, `DASHBOARDS_CONCEITO.md`, `DASHBOARDS_IMPLEMENTACAO.md`, `AUTH_CHANGES.md`, `ANALISE_DIRECIONADO_PARA.md`, `REQUISITOS_*`, `ROADMAP.md`, `ALTERACOES*.md`, `MUDANCAS_*.md`, `cadastro.md`, `Plano de backend para o Vitor…md`, `telas/`, `telasVitima/`. Em caso de divergência, vale o código + `SISTEMA-*`.

## Glossário rápido

- **Demanda:** pedido inicial (`PENDENTE/APROVADA/REJEITADA`).
- **Processo:** caso (`ABERTO/EM_TRIAGEM/ENCAMINHADO/ENCERRADO`).
- **Consulta:** atendimento (`TRIAGEM/PSICOLOGO/ASSISTENTE_SOCIAL/ASSESSOR_JURIDICO` × `AGENDADA/REALIZADA/CANCELADA/FALTOU`).
- **FRIDA:** avaliação de risco (19 perguntas + estruturada; `BAIXO/MEDIO/ELEVADO`).
- **Encaminhamento:** interno (`direcionadoPara`) XOR externo (`DEFENSORIA/REDE_SAUDE/DELEGACIA/OUTRO`).
- **Roles front:** `user (/user)`, `manager (/manager)`, `professional (/professional)`, `admin (/admin mock)`.
