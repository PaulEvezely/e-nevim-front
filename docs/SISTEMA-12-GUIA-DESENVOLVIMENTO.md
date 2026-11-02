# NEVIM — Guia de Desenvolvimento

**Documento:** SISTEMA-12-GUIA-DESENVOLVIMENTO

> Nenhum `.env` foi lido. Variáveis citadas apenas pelo nome. Consulte o responsável pelo ambiente para valores/segredos.

---

## 1. Pré-requisitos

- Node 22+, npm, PostgreSQL local (ou `TEST_DATABASE_URL` isolado p/ testes — nunca aponte testes para banco compartilhado; `setup.ts` trava banco não-local).
- Variáveis **apenas por nome** (não documentar valores): front `API_URL`, `SESSION_SECRET`, `JWT_SECRET`; backend `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`(front), `CORS_ORIGIN`, `RATE_LIMIT_*` (`WINDOW_MS`, `LOGIN_MAX`, `EMAIL_MAX`, `RESET_MAX`), `AES_SECRET_KEY` (32B hex), SMTP (`SMTP_*`), WhatsApp (`WHATSAPP_*`), Google (`GOOGLE_*`), `GESTOR_*` (bootstrap), `PORT`, `REQUIRE_EMAIL_VERIFICATION`, `NODE_ENV`.

## 2. Setup

### Backend (`nevim-backend/`)

```bash
npm install
npm run prisma:generate
npm run prisma:migrate        # dev (migrate dev)
npm run prisma:deploy         # prod (migrate deploy)
npm run gestor:create          # bootstrap primeiro GESTOR (scripts/create-gestor.ts)
npm run dev                    # tsx watch src/index.ts (:3000, GET /health)
npm test                       # vitest run (usa .env.test → TEST_DATABASE_URL)
```

Prisma Studio: `npm run prisma:studio`.

### Frontend (raiz)

```bash
npm install
npm run dev        # react-router dev (:5173, SSR)
npm run build      # react-router build (build/client + build/server)
npm start          # react-router-serve ./build/server/index.js
npm run typecheck  # react-router typegen + tsc
```

Fluxo típico: subir backend (`:3000`) → apontar `API_URL` → `npm run dev` no front.

## 3. Scripts úteis

| Comando | Onde | O que faz |
|---|---|---|
| `npm run prisma:migrate/deploy/studio/generate` | backend | Migrações e client Prisma |
| `npm run gestor:create` | backend | Cria primeiro gestor |
| `npm test` | backend | 20 suítes (`tests/`) |
| `npx tsx scripts/backfill-cpf.ts --dry-run` | backend | Migra CPF claro → hash+cripto |
| `npx tsx scripts/backfill-local-ocorrencia.ts` | backend | Preenche local filtrável (legado `confiavel=false`) |
| `npx tsx scripts/backfill-processos-cadastro.ts` | backend | Cria `ABERTO` p/ `APROVADA` sem processo |
| `npx tsx scripts/benchmark-dashboard.ts` | backend | Seeda e mede dashboards |
| `npx tsx scripts/smoke-*.ts` | backend | Smokes (referrals, segurança, paridade social/jurídico) |
| `bash scripts/deploy-vm.sh` | backend | Deploy VM Debian/Ubuntu |
| `npm run typecheck` | raiz | Typegen + `tsc` |

## 4. Convenções de código (PRD §6.1)

- **Inglês no código** (exceto `console.log`, mensagens de erro, textos UI em pt-BR).
- Clean Code; componentização + Tailwind; `cn(clsx + twMerge)`; cores PRD via `StatusBadge`/`chartTheme` (sem hex espalhado).
- Validação: Zod no backend (`validators.ts` + `normalizarEmail`); mensagens por campo no front (RFF03); erros amigáveis + toast + retry (RFF12/RFF17); confirmação em ações críticas (RFF10); skeleton/spinner em async perceptível (RFF11).
- A11y/responsivo: `useReducedMotion`, contraste, ARIA nos gráficos; `DecoyClima`/`EmergencyExitButton` testados com teclado (`Esc`).
- Camadas: rota → Zod → `authenticate` → `allowProfiles/onlyOwnResource` → Prisma → `logAudit` → `notification.service` (best-effort) → JSON. Front: `loader/action` → `*Api.server.ts` → `apiFetchJson` → UI (`Toast/ConfirmModal/Pagination`).

## 5. Adicionando uma rota backend (checklist)

1. Schema Zod em `utils/validators.ts`.
2. Handler em `src/routes/*.routes.ts` com `authenticate` + `allowProfiles`/`onlyOwnResource` (+ `login/email/resetLimiter` se pública sensível).
3. `logAudit` quando criar/editar/entidade sensível.
4. `notification.service` quando o evento importa p/ outro ator (in-app + e-mail best-effort, sem sigilo).
5. Teste em `tests/` (positivo + 401/403/404/409/410 + RBAC cruzado).
6. Documentar em `SISTEMA-06-API-REFERENCE.md`.

## 6. Adicionando uma tela front (checklist)

1. Registrar em `app/routes.ts` (`route/layout/prefix` + papel).
2. `loader` (`requireUser` + `*Api.server.ts`) e/ou `action` (JSON, `fieldErrors`, `Toast`).
3. Reutilizar `shared/` (`Button/StatusBadge/ConfirmModal/Toast/Pagination/Sidebar/AppHeader`, hooks `useToast/useDebounce/useReducedMotion`).
4. Proxies `/api/*` quando precisar polling client sem expor JWT.
5. `roleHome`/`mapPerfil` se novo papel; `notificationRouting` se nova entidade notificável.

## 7. Testes

- Backend: `npm test` (vitest, `dir tests`, sequencial). Padrão `helpers.ts` (`criarGestor/login`, `futuro/depoisDe`). Cobrem: triagem/FRIDA, confirmação dupla + Meet mock, conflito agenda, cripto, dashboards (agregação/campus/demográfico), filtros demanda, bloqueio ativo (409), verificação e-mail, encerramento em cascata, fluxo ponta a ponta, notificações, rate-limit, RBAC, recuperação senha, relatórios, paridade social/jurídico, vítimas.
- Front: `npm run typecheck` (sem suíte unitária; validação via Zod + testes backend + revisão manual das jornadas por perfil).

## 8. Deploy

- `scripts/deploy-vm.sh` (VM Debian/Ubuntu: repo privado, banco, systemd/nginx).
- Produção front: `npm run build` → servir `build/` (`build/client` estático + `build/server`); backend: `npm run build` (`tsc`) → `node dist/index.js`.
- Bootstrap: `gestor:create` antes do primeiro login; Google OAuth via `/google/auth-url → /callback`; SMTP/WhatsApp como best-effort (sistema funciona sem, só perde notificação externa).

## 9. Arquivos intencionalmente vazios/mocks (não apagar sem plano)

- `app/routes/public/demand-confirmation.tsx` (0B, rota morta), `app/routes/public/terms.tsx` (0B), `app/routes/professional/process.tsx` (vazio, fora de `routes.ts`), `features/admin/` e `features/professionals/` (vazios), `/admin/painel.tsx` (mock `INITIAL_USERS`).
