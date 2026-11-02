# NEVIM — Backend

**Documento:** SISTEMA-04-BACKEND
**Pasta:** `nevim-backend/` · **Stack:** Express 4 · Prisma 5 · PostgreSQL · Zod · Argon2 · JWT · Nodemailer · PDFKit

> Nenhum `.env` foi lido. Variáveis citadas apenas pelo nome.

---

## 1. Boot e middlewares globais

### `src/index.ts` (8 linhas)

Apenas `dotenv/config` + `app.listen(PORT || 3000)`.

### `src/app.ts` (89 linhas)

- `trust proxy = 1` — IP real atrás de 1 proxy; evita `ERR_ERL_PERMISSIVE_TRUST_PROXY` no rate-limit.
- `helmet()` — HSTS, noSniff, frameguard etc.
- CORS: `CORS_ORIGIN` (csv, default `*`), normaliza trailing `/`, permite requisições sem `Origin` (curl/health), `credentials: true`; origem inválida → erro tratado como 403.
- `express.json()` + `GET /health → {status:"ok"}`.
- Montagem (sem versionamento):

| Prefixo | Router |
|---|---|
| `/auth` | `authRouter` |
| `/demands` | `demandsRouter` |
| `/processes` | `processesRouter` |
| `/appointments` | `appointmentsRouter` |
| `/frida-forms` | `fridaRouter` |
| `/referrals` | `referralsRouter` |
| `/dashboard` | `dashboardRouter` |
| `/audits` | `auditsRouter` |
| `/users` | `usersRouter` |
| `/patients` | `patientsRouter` |
| `/victims` | `victimsRouter` |
| `/reports` | `reportsRouter` |
| `/notifications` | `notificationsRouter` |
| `/google` | `googleRouter` |

- Error handler: CORS → 403, JSON malformado (`entity.parse.failed`) → 400, resto → 500.

### `src/lib/prisma.ts` + `src/types/express.d.ts`

- Singleton `PrismaClient` (`global.__prisma` em dev).
- `req.usuario?: {id, email, perfil}`.

---

## 2. Middlewares

| Arquivo | O que faz |
|---|---|
| `middlewares/auth.ts` (110 linhas) | `authenticate`: exige `Authorization: Bearer`, verifica JWT (`JWT_SECRET`), carrega conta com cache 60s (`ativo, senhaAlteradaEm`); 401 se inativo ou `iat < senhaAlteradaEm` (revogação). `invalidarCacheConta(id)` usado em reset/desativação |
| `middlewares/rbac.ts` (58) | `allowProfiles(...perfis)`: 401 sem `req.usuario`, 403 fora do perfil. `onlyOwnResource(getId)`: não-vítima passa; vítima só recurso próprio (`GET demands/:id, processes/:id(+historico)`) |
| `middlewares/audit.ts` (42) | `logAudit({req, acao, entidade, entidadeId, detalhes})` → `logs_auditoria` com `usuarioId, ip` |
| `middlewares/rateLimit.ts` (64) | `loginLimiter` (janela `RATE_LIMIT_WINDOW_MS` 15min, max `RATE_LIMIT_LOGIN_MAX` 20, chave IP+e-mail, `ipKeyGenerator` p/ IPv6), `emailLimiter` (verificação+forgot, `RATE_LIMIT_EMAIL_MAX` 10/IP), `resetLimiter` (`RATE_LIMIT_RESET_MAX` 10). Aplicado por rota, não global |

---

## 3. Rotas

### 3.1 `auth.routes.ts` → `/auth` (908 linhas)

| Método + Path | Auth/RBAC | Descrição |
|---|---|---|
| `POST /register-victim` | pública | Self-service vítima (nome/e-mail/senha + perfil completo, CPF com DV, `cpfHash` + encrypt). 409 e-mail/CPF. Envia verificação best-effort |
| `GET /invite/:token/validate` | pública | Valida convite (404/410 usado/expirado); retorna solicitante pré-preenchido |
| `POST /register/:token` | pública | Completa cadastro em transação (usuário+vítima, `demanda.vitimaId` + `APROVADA`, `processo ABERTO` upsert, `convite.usado`). Herda `emailVerificado` |
| `POST /login` | pública + `loginLimiter` | Todos os perfis (argon2), JWT `{sub, email, profile}` |
| `POST /email/verify/request` | pública + `emailLimiter` | Sempre 202 genérico; dev retorna `_debugLink/Token` |
| `GET /email/verify/confirm?token=` | pública | Marca `verificadoEm` (idempotente); se conta existe, marca `emailVerificado` |
| `POST /forgot-password` | pública + `emailLimiter` | Sempre 202; só envia se conta ativa; cooldown anti-spam |
| `POST /reset-password` | pública + `resetLimiter` | Consome token, nova hash argon2, `senhaAlteradaEm` (revoga JWTs), invalida cache e demais resets |
| `GET /me` | `authenticate` | Próprio usuário sem `senhaHash`; CPF descriptografado só p/ dona |
| `GET /vitimas/minha` | `authenticate + VITIMA` | DTO LGPD "Meus Dados" (sem cpf/hash/motivo) |
| `PATCH /me` | `authenticate` | Edita nome (todos) + campos vítima só se `VITIMA`; e-mail/cpf/vínculo/perfil bloqueados |
| `PATCH /me/password` | `authenticate` | Troca com senha atual; **não** grava `senhaAlteradaEm` (não derruba sessão atual) |
| `POST /register-professional` | `authenticate + GESTOR` | Cria `PSICOLOGO/ASSISTENTE_SOCIAL/ASSESSOR_JURIDICO` com CRP/CRESS/OAB único |

### 3.2 `demands.routes.ts` → `/demands` (773 linhas)

| Método + Path | Auth/RBAC | Descrição |
|---|---|---|
| `POST /public` | pública | Demanda espontânea sem vítima; exige token de e-mail verificado (salvo `REQUIRE_EMAIL_VERIFICATION=false`), 409 se e-mail tem processo ativo, cria `PENDENTE + convite 48h` em transação, `notifyGestoresNovaDemanda` |
| `GET /` | todos autenticados | GESTOR: filtros `status/campus/violenceType/q tokens AND-OR/de-ate/onlyCampus/registration/sort=fila\|recent`, paginado + `counts {ALL, PENDENTE, AGUARDANDO_CADASTRO, EM_PROCESSO, REJEITADA}`, decrypt preview. VITIMA: só próprias + `processo{id,status}`, nunca `motivoRejeicao`. Profissionais: envelope vazio |
| `PATCH /:id/aprovar` | `GESTOR` | `PENDENTE→APROVADA`, gera/renova convite, cria `ABERTO` se já tem `vitimaId`, `notifyInvite` (WhatsApp→e-mail) |
| `POST /:id/reenviar-convite` | `GESTOR` | Renova 48h p/ `APROVADA`, re-notifica |
| `PATCH /:id/rejeitar` | `GESTOR` | `PENDENTE→REJEITADA` com motivo ≥10 chars, `notificarDemandaRejeitada` |
| `POST /` | `VITIMA` | Demanda autenticada; 409 se processo ativo; snapshot campus/curso/local |
| `GET /:id` | `authenticate + onlyOwnResource` | Não-vítima passa; vítima só própria; decrypt + fallback local legado |

### 3.3 `processes.routes.ts` → `/processes` (732 linhas, `authenticate` global)

| Método + Path | RBAC | Descrição |
|---|---|---|
| `POST /` | `GESTOR` | Cria processo de demanda `APROVADA` com vítima; 409 se já tem |
| `GET /` | `GESTOR, PSI, ASSIST, JURID` | `?status/vitimaId/direcionadoPara`, sem `observacaoTriagem` |
| `GET /:id` | `onlyOwnResource` | VITIMA: DTO parcial `{id, status, areaAtual, abertoEm, triadoEm, encerradoEm, totalAtendimentos, historicoAtividades}`; demais: completo com decrypt |
| `GET /:id/historico` | `onlyOwnResource` | Histórico mínimo p/ vítima |
| `GET /:id/appointments` | `GESTOR + profissionais` | Desc; profissional filtra `profissionalId==eu OR direcionadoPara==meu tipo` |
| `GET /:id/report` | `GESTOR + prof vinculados` | Janela do caso (processo+vítima+demanda decrypt + consultas sem `observacoes` + fridas + encaminhamentos + histórico) |
| `GET /:id/frida` | `GESTOR + prof vinculados` | FRIDA do processo ou `{frida:null}`; VITIMA 403 |
| `PATCH /:id/triagem` | `GESTOR, PSI, ASSIST` | `ABERTO/EM_TRIAGEM→EM_TRIAGEM` (risco+prioridade+obs AES); profissional só com `TRIAGEM` própria; notifica |
| `PATCH /:id/encaminhar` | `GESTOR` | `EM_TRIAGEM/ENCAMINHADO→ENCAMINHADO`; XOR interno (`direcionadoPara`) / externo (`Encaminhamento` em transação) |
| `PATCH /:id/status` | `GESTOR` | Qualquer não-terminal → `ENCERRADO`; cancela `AGENDADA`s em transação + auditoria por consulta + notificações |

### 3.4 `appointments.routes.ts` → `/appointments` (858 linhas, `authenticate` global)

Criação exclusiva do GESTOR; profissionais só realizam/relatam.

| Método + Path | RBAC | Descrição |
|---|---|---|
| `POST /` | `GESTOR` | Cria consulta (`TRIAGEM` só em `ABERTO/EM_TRIAGEM`, demais só `ENCAMINHADO`), valida compatibilidade perfil×tipo, 1 triagem ativa/processo, 409 conflito `[start,end)` (legado +30min) |
| `GET /` | `GESTOR, PSI, ASSIST, JURID` | Calendário `?de/ate/processoId/profissionalId`; não-gestor só próprio |
| `GET /minhas/historico` | `VITIMA` | Passadas `REALIZADA/CANCELADA/FALTOU`, paginado, select mínimo LGPD |
| `GET /minhas` | `VITIMA` | Próximas `AGENDADA` futuras, sem `observacoes` (antes de `/:id`) |
| `GET /:id` | `GESTOR + prof` | Dono ou gestor |
| `PATCH /:id` | `GESTOR + prof dono` | Edita `observacoes/linkMeet/modalidade/dataHoraFim` de `AGENDADA`; valida 8h, reconflito; link manual novo notifica |
| `PATCH /:id/status` | `GESTOR + prof dono` | `AGENDADA→REALIZADA/CANCELADA/FALTOU`, `REALIZADA→CANCELADA`; triagem `REALIZADA` avança `ABERTO→EM_TRIAGEM`, cancelar triagem reverte |
| `POST /:id/confirmar` | `VITIMA, PSI, ASSIST, JURID` (dono/vítima, nunca GESTOR) | Confirmação idempotente; duplo `CONFIRMADO` em `ONLINE` sem link → Meet automático |
| `POST /:id/recusar` | idem | Motivo opcional → `CANCELADA`, avisa gestor/outra parte sem motivo |
| `POST /:id/relatorio` | `PSI, ASSIST, JURID` autor | 1 relatório/`REALIZADA`, conteúdo AES |
| `GET /:id/relatorio` | idem | Só autor lê (decrypt) |
| `PATCH /:id/relatorio` | idem | Edição autor, log sem conteúdo |

### 3.5 `frida.routes.ts` → `/frida-forms` (270 linhas, `authenticate` global)

| Método + Path | RBAC | Descrição |
|---|---|---|
| `POST /` | `GESTOR, PSI, ASSIST` | FRIDA em `TRIAGEM/PSICOLOGO AGENDADA/REALIZADA` própria; autor por perfil; 1 FRIDA/processo; `ABERTO→EM_TRIAGEM` + sincroniza risco |
| `GET /:id` | autenticado (checa dono/GESTOR dentro) | Dono ou gestor; resto 403 |
| `PATCH /:id` | `PSI, ASSIST, GESTOR` | Correção auditada (dono, gestor ou qualquer assistente social); notifica se risco mudou |

### 3.6 `referrals.routes.ts` → `/referrals` (106 linhas)

| Método + Path | RBAC | Descrição |
|---|---|---|
| `POST /` | `GESTOR` | Encaminhamento externo avulso em `ENCAMINHADO` |
| `GET /?processoId=` | `GESTOR + prof` | Gestor tudo; profissional só onde atua; VITIMA 403 |

### 3.7 `dashboard.routes.ts` → `/dashboard` (399 linhas, `authenticate + GESTOR`)

Todos com `?de=&ate=` (ISO) + `?campus=` (case-insensitive). Agregações `groupBy` + `$queryRaw` (`date_trunc` mês, `COALESCE` curso, `AGE` idade).

| Endpoint | Retorna |
|---|---|
| `GET /summary` | KPIs: demandas/processos por status, consultas semana (seg–dom), risco triagem+frida |
| `GET /demandas` | porStatus/Tipo/Vínculo/Campus/Local/Curso (`COALESCE solicitanteCurso/vitima`)/Mês + `taxaConversao` |
| `GET /processos` | porStatus/Direcionado (`SEM_DESTINO` p/ null)/Risco/Mês |
| `GET /consultas` | porStatus/Tipo/Mês |
| `GET /frida` | porNivelRisco |
| `GET /encaminhamentos` | porDestino/Mês |
| `GET /demografico` | `total, porSexo/Genero/Etnia/FaixaIdade` (0–17…60+; null→`NAO_INFORMADO`/`SEM_IDADE`), base `Processo→Vitima` |

### 3.8 Demais rotas

| Router | Endpoints |
|---|---|
| `audits.routes.ts` → `/audits` (GESTOR) | `GET /?de=&ate=&entidade=&acao=&page=&limit=` — logs desc paginado; leitura não gera log |
| `users.routes.ts` → `/users` (GESTOR) | `GET /?perfil=&q=&page=&limit=` (sem `senhaHash`); `PATCH /:id/ativo` (bloqueia auto-desativar, `invalidarCacheConta`) |
| `patients.routes.ts` → `/patients` (GESTOR+prof) | `GET /?profissionalId=&page=&limit=` — gestor sem filtro: todos `ENCAMINHADO`; com filtro/profissional: `direcionadoPara==tipo OR consulta própria`; retorna `{processoId, status, risco, vitima{nome, campus, curso, vinculo}, totalConsultas, ultimaConsulta}` |
| `victims.routes.ts` → `/victims` (GESTOR) | `GET /?triage=ALL\|SEM_TRIAGEM\|EM_TRIAGEM\|ENCAMINHADO\|ENCERRADO&q=&risk=&area=&campus=&course=&bond=&from=&to=&sort=recent&page=&limit=` — pacientes = vítimas com cadastro (mesmo sem processo); `counts/facets` refletem busca sem filtro triagem; LGPD sem cpf/endereço/obs; `q` só nome |
| `reports.routes.ts` → `/reports` | `GET /meus?processoId=&de=&ate=` (`PSI, ASSIST, JURID`, consolidado JSON só do autor); `GET /meus.pdf?...` (idem, `Content-Disposition attachment`) |
| `notifications.routes.ts` → `/notifications` | `GET /?lida=&limit=&offset=` (só próprias + `{total, naoLidas}`); `PATCH /:id/ler` (só dono); `PATCH /ler-todas` |
| `google.routes.ts` → `/google` | `GET /status` (GESTOR), `GET /auth-url` (GESTOR, `state` AES), `GET /callback` (pública, redirect browser `?google=ok\|erro`), `DELETE /desconectar` (GESTOR) |

---

## 4. Serviços (`src/services/`)

| Serviço | Responsabilidade |
|---|---|
| `consulta-confirmacao.service.ts` (219) | `confirmarConsulta/recusarConsulta` — deduz papel (dono vs vítima, gestor nunca), idempotente, só `AGENDADA`; duplo `CONFIRMADO` em `ONLINE` → `criarLinkMeet` + notificações; recusa → `CANCELADA` + motivo p/ gestor |
| `email.service.ts` (253) | `isEmailEnabled, renderEmailTemplate, sendEmail` (SMTP/nodemailer ou mock), `sendInviteEmail/VerificationEmail/PasswordResetEmail/DemandaRejeitadaEmail/NotificacaoEmail` |
| `google-auth.service.ts` (237) | OAuth institucional p/ Meet (`meetings.space.created`): `googleHabilitado, gerarUrlAutorizacao, trocarCodigoPorTokens, obterAccessToken` (auto-refresh), `obterStatusGoogle, desconectarGoogle` |
| `meet.service.ts` (73) | `criarLinkMeet()` via `fetch POST /v2/spaces`; sem conta: mock em dev/teste, em prod reserva `meet:criando` + avisa gestores |
| `notification.service.ts` (627) | `notifyInvite` (WhatsApp→e-mail fallback, nunca lança), `criarNotificacao, notificarGestores` (fan-out), `notificarGestoresNovaDemanda/CadastroVitima`, `notificarConsultaAgendada/Cancelada/Confirmada/LinkMeetDisponivel/Realizada/Falta/ConfirmacaoParcial`, `notificarTriagemRegistrada/ProcessoEncaminhado/Encerrado/DemandaRejeitada/FridaPreenchido/Atualizado` — in-app + e-mail best-effort, LGPD sem sigilo |
| `relatorio-pdf.service.ts` (73) | `gerarRelatoriosPdf(autor, itens, filtros)` — consolidado pdfkit só do autor |
| `token.service.ts` (182) | Tokens opacos: `criarTokenAuth` (invalida anteriores), `validarTokenAuth` (hash+tipo+uso+expiração), `invalidarTokensPendentes, solicitarVerificacaoEmail/ResetSenha, resetRecente/cooldown, buscarUsuarioPorEmail, frontendBase`. TTLs 24h/60min |
| `vitima.service.ts` (42) | Trava "1 ativo": `encontrarProcessoAtivoPorVitima/PorEmail` (`ABERTO/EM_TRIAGEM/ENCAMINHADO`; leitura otimista, dureza no índice parcial) |
| `whatsapp.service.ts` (182) | Provider-agnostic + mock: `normalizePhoneBR, renderWhatsAppTemplate/getTemplate/isEnabled, sendInviteWhatsApp` |

## 5. Utils (`src/utils/`)

| Util | Responsabilidade |
|---|---|
| `crypto.ts` (76) | AES-256-CBC `encrypt/decrypt` (`iv:conteudo` hex, chave 32B), `generateSecureToken/InviteToken`, `hashToken` (sha256), `hashCpf` (HMAC-SHA256 blind index) |
| `hash.ts` (24) | Argon2id `generatePasswordHash/verifyPassword` (19MB, t=2) |
| `validators.ts` (730) | Schemas Zod: cadastro/login, verificação/reset, demanda pública/autenticada, convite, rejeição, `filtrosDemandas/Processo/Dashboard/Audits/Referral/Vitimas/Usuarios/Relatorios/Agenda`, triagem/encaminhamento, consulta (futuro, fim>início, ≤8h, link https, modalidade), `atualizarMeuPerfil/TrocarSenha`, `criarProfissional`, FRIDA (respostas ≥1, ≤50k), relatório (10–10k). `normalizarEmail` |
| `data.ts` (19) | `formatarDataHoraBR` (`America/Sao_Paulo`, `DD/MM/AAAA HH:mm`) |
| `ocorrencia.ts` (11) | `extractLocalOcorrenciaLegado` — parse `[Meta]…Local:…` p/ backfill |

---

## 6. Testes (`tests/`, vitest + supertest)

Setup: `setup.ts` carrega `.env.test` → `TEST_DATABASE_URL`, trava banco não-local; `helpers.ts` (app/request/prisma, `futuro/depoisDe`, `criarGestor/login`); `vitest.config.mjs` (`dir tests`, sem paralelismo entre arquivos).

| Arquivo | Cobre |
|---|---|
| `acceptance-triagem.test.ts` (362) | Triagem `REALIZADA→EM_TRIAGEM`, FRIDA avança + sincroniza risco, cancelar triagem permite nova, 409 2ª triagem ativa |
| `confirmacao-consulta.test.ts` (379) | Confirmação dupla + Meet mockado, idempotência, `PRESENCIAL` sem link, recusa→`CANCELADA`, link manual preservado, `/minhas` |
| `conflito-agenda.test.ts` (176) | 409 sobreposição `[start,end)`, adjacente 201, validações término/8h, legado +30min, PATCH estender/limpar |
| `crypto.test.ts` (80) | AES roundtrip/IV único/formato inválido, HMAC CPF, parse `[Meta]`, validators demanda/consulta |
| `dashboard-agregacoes.test.ts` (239) | `porMes` multi-mês, `porCurso COALESCE`, `SEM_IDADE`, `SEM_DESTINO`, janelas `de/ate` |
| `dashboard-campus.test.ts` (298) | Filtro `?campus` em todos endpoints, case-insensitive, 403 não-gestor, limite 120 |
| `dashboard-demografico.test.ts` (178) | Sexo/gênero/etnia/idade, null→`NAO_INFORMADO/SEM_IDADE`, janela, 403/400 |
| `demand-filters.test.ts` (319) | 13 casos: paginação, status, campus, violenceType, `q` tokenizado, `de/ate`, `onlyCampus`, `registration`, 400, vítima/profissionais, counts, `sort=fila` |
| `demandas-bloqueio-ativo.test.ts` (151) | 409 processo ativo (pública case-insensitive + autenticada), liberado se `ENCERRADO` |
| `email-verificacao.test.ts` (229) | Request/confirm, 400 sem/não-confirmado/outro e-mail, 201 consome token, 410 expirado, reenvio invalida anterior, convite não reenvia se já verificado |
| `encerrar-processo-cancelamento.test.ts` (421) | `ENCERRADO` auto-cancela `AGENDADA`s, auditoria/notificações, `ENCERRADO` bloqueia triagem/encaminhar/agendar/FRIDA/confirmar/recusar |
| `flow.test.ts` (269) | Ponta a ponta social + Meet + referral, CPF criptografado/409 + `/me` legível, psicólogo + FRIDA, gestor + triagem + FRIDA |
| `notifications.test.ts` (264) | Fan-out gestores/vítima/profissional, cancelamento, leitura/badge/`ler-todas`, filtro `lida` |
| `rate-limit.test.ts` (60) | 5 passam, 6ª → 429, cotas separadas por conta no mesmo IP |
| `rbac.test.ts` (77) | 401 sem token, vítima 403 agenda/pacientes/referrals, jurídico fora FRIDA/triagem, profissional não vê alheios nem cria referral |
| `relatorios.test.ts` (160) | CRUD relatório autor (AES, 409 duplicado, 400 se não `REALIZADA`, sigilo), consolidado JSON/PDF, `%PDF` |
| `triagem-profissional.test.ts` (258) | Gestor designa triagem (jurídico 400), designado registra triagem, sem designação 403, assistente registra, FRIDA autor por perfil |
| `victims.test.ts` (304) | `triageStatus`, filtros `q/risk/area/campus/course/bond/from-to/combinados`, paginação/`sort=recent`, counts sem triagem, facets pt-BR, LGPD |
| `simple.test.ts` (7) | Sanidade |

## 7. Scripts (`scripts/`)

| Script | O que faz |
|---|---|
| `backfill-cpf.ts` | Migra `vitimas.cpf` claro → `cpf_hash + cpf_criptografado`; `--dry-run` |
| `backfill-local-ocorrencia.ts` | Preenche `solicitante_local_ocorrencia` via decrypt + `extractLocalOcorrenciaLegado`, marca `confiavel=false` |
| `backfill-processos-cadastro.ts` | Cria `ABERTO` p/ `APROVADA` com vítima sem processo (idempotente) |
| `benchmark-dashboard.ts` | Seeda N vítimas + mede `GET /dashboard/*` (padrão 2000/5, requer servidor) |
| `create-gestor.ts` (`gestor:create`) | Bootstrap primeiro `GESTOR` (via variáveis `GESTOR_*`) — sem seed pela API |
| `deploy-vm.sh` | Deploy VM Debian/Ubuntu (repo privado via token/SSH, banco, systemd/nginx) |
| `limpar-benchmark.ts` | Remove usuários `bench-*` em ordem de dependência |
| `smoke-paridade-social-juridico.ts` | Smoke paridade assistente/jurídico (porta 3191, fluxo + negativos) |
| `smoke-referrals.ts` | Smoke `POST/GET /referrals` |
| `smoke-seguranca.ts` | Smoke helmet + rate-limit login |
| `testar-email-notificacao.ts` | Envia e-mail real p/ validar remetente; bloqueado em produção |

## 8. Dependências (`package.json`)

Scripts: `dev` (tsx watch), `build` (tsc), `start` (node dist), `postinstall/prisma:generate`, `prisma:migrate/deploy/studio`, `gestor:create`, `test` (vitest run).
Deps: `@prisma/client, argon2, cors, dotenv, express, express-rate-limit, helmet, jsonwebtoken, nodemailer, pdfkit, zod`. Dev: `@types/*, supertest, tsx, typescript, vite, vitest`.
