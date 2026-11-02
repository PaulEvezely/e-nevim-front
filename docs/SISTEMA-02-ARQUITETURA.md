# NEVIM — Arquitetura

**Documento:** SISTEMA-02-ARQUITETURA

---

## 1. Visão de alto nível

```
┌─────────────────────────────┐      HTTPS/JSON (Bearer JWT)      ┌──────────────────────────────┐
│  FRONTEND (React Router v8) │ ───────────────────────────────▶ │  BACKEND (Express + Prisma)  │
│  SSR em Node                │ ◀─────────────────────────────── │  PostgreSQL                    │
│  app/ features/ libs/       │      ApiError amigável (RFF17)    │  nevim-backend/src            │
│  shared/                    │                                   │  prisma/schema.prisma          │
└─────────────────────────────┘                                   └──────────────────────────────┘
        │                                                                    │
        │ cookie __nevim_session (JWT 8h)                                     │ SMTP / WhatsApp / Google Meet
        │ localStorage drafts/lembretes                                       │ (best-effort, nunca bloqueia)
        ▼                                                                     ▼
  Browser (vítima/gestor/prof)                                     E-mail, WhatsApp, Meet links
```

- **Monorepo em um único repositório:** frontend na raiz (`app/`, `features/`, `libs/`, `shared/`), backend em `nevim-backend/`, dados estáticos em `app/data/`, mocks em `docs/telas/` e `docs/telasVitima/`.
- **Sem versionamento de API:** prefixos diretos (`/auth`, `/demands`, `/processes`, …) montados em `nevim-backend/src/app.ts`.
- **SSR ligado:** `react-router.config.ts` (`ssr: true`), servidor Node servindo `build/server` + `build/client` (`package.json`: `build`, `start` com `react-router-serve`).
- **Comunicação:** frontend SSR faz `fetch(BASE + path)` com `Authorization: Bearer <JWT>` extraído do cookie (`features/auth/apiFetch.server.ts` + `libs/api.server.ts`). Base URL vem do nome da variável `API_URL` (valor não documentado aqui).

## 2. Estrutura de pastas

```
nevim/
├── app/                          # React Router: rotas, root, css, dados estáticos
│   ├── routes.ts                 # mapa central de rotas (index/layout/prefix)
│   ├── root.tsx                  # loader de role + NotificationProvider + ErrorBoundary
│   ├── routes/
│   │   ├── public/               # home, demanda, login/logout, register/:token, recover/reset, 403
│   │   ├── user/                 # painel, process, consultas, notificacoes (+layout user)
│   │   ├── manager/              # painel, demandas, pacientes, processos, consultas, dashboards (+layout)
│   │   ├── professional/         # painel, appointments, appointment-detail, notificacoes (+layout)
│   │   ├── admin/                # painel mock (+layout)
│   │   └── api/                  # proxies same-origin: notifications, reminders, process-search
│   ├── data/                     # brasil.json, brazilLocations.ts, uespiCourses.ts, violenceTypes.ts
│   └── app.css
├── features/                     # lógica por domínio (client + *.server.ts)
│   ├── auth/                     # cookie, require-user, roleHome, mapPerfil, authApi, apiFetch
│   ├── public/                   # demandsApi, emailVerification, passwordRecovery, registerApi, storages
│   ├── user/                     # consultasApi, demandsApi, victimJourney, utils, components
│   ├── manager/                  # managerApi, appointmentApi, professionalsApi, victimsApi,
│   │                             # dashboardApi, processReportApi + 30+ components/
│   ├── professional/             # consultasUtils, labels, relatorioApi + frida/
│   ├── notifications/            # types, apis, NotificationProvider, routing, ui, format, reminders
│   ├── admin/                    # vazio (painel admin é mock)
│   └── professionals/            # vazio (legado)
├── libs/                         # api.server.ts (BASE + ApiError + mensagens), utils.ts (cn)
├── shared/                       # components/, hooks/, layouts/, utils/ reutilizáveis
├── nevim-backend/                # Express API
│   ├── src/
│   │   ├── app.ts / index.ts     # middlewares globais + boot
│   │   ├── routes/               # 14 routers
│   │   ├── middlewares/          # auth, rbac, audit, rateLimit
│   │   ├── services/             # notification, email, whatsapp, meet, google-auth, token, relatorio-pdf, etc.
│   │   ├── utils/                # crypto, hash, validators (Zod), data, ocorrencia
│   │   ├── lib/prisma.ts         # singleton Prisma
│   │   └── types/express.d.ts    # req.usuario
│   ├── prisma/schema.prisma       # 16+ models, 20+ enums
│   ├── tests/                    # 20 suítes vitest + supertest
│   └── scripts/                  # backfills, benchmark, smokes, create-gestor, deploy-vm.sh
├── public/                       # favicons, imagens, frida/ (instruções PDF)
├── docs/                         # PRD + planos + ESTA documentação SISTEMA-*
└── frida/                        # material de referência do formulário (fora do build)
```

Referência PRD §11 previa `features/{admin,auth,manager,professionals,public,user}` + `shared/components` — a implementação renomeou `professionals → professional` e adicionou `features/notifications`.

## 3. Frontend (React Router v8, SSR)

- `app/routes.ts`: `index` (`/`), 3 proxies `/api/*`, `layout PublicLayout` (10 rotas públicas), `prefix user/manager/professional/admin` com layouts por perfil.
- `app/root.tsx`: `loader` (`getOptionalUser` → `{role}`) → `NotificationProvider` → `Outlet`; `ErrorBoundary` pt-BR (404/403/500).
- Guards: `requireUser(request, [roles])` em cada `layout` (`user/layout.tsx`, `manager/layout.tsx`, `professional/layout.tsx`, `admin/layout.tsx`); sem token → `/login`; papel errado → `ROLE_HOME[role]` (RFF01).
- Padrão loader/action: `loader` valida sessão + busca dados via `*Api.server.ts` (SSR); `action` processa forms JSON, converte `ApiError` em `fieldErrors`/toast (RFF03/RFF12/RFF17); listas pesadas usam polling client via `NotificationProvider`.
- Estado efêmero: `sessionStorage nevim:demand-draft` (wizard demanda), `localStorage nevim:email-verification` (gate 24h) e `nevim:reminder:<id>` (dedup lembretes), rascunho FRIDA ofuscado TTL 24h.
- Estilo: Tailwind v4 (`@tailwindcss/vite`), `cn(clsx + twMerge)`, paleta PRD em `StatusBadge`/`chartTheme`.

## 4. Backend (Express 4 + Prisma 5 + PostgreSQL)

- `src/index.ts`: `dotenv/config` + `app.listen(PORT || 3000)`.
- `src/app.ts`: `trust proxy=1`, `helmet()`, CORS (`CORS_ORIGIN` csv, permite sem `Origin`, `credentials:true`), `express.json()`, `GET /health`, 14 prefixos, error handler (CORS→403, JSON malformado→400, resto→500).
- Camadas por rota: `validators.ts` (Zod) → `authenticate` → `allowProfiles`/`onlyOwnResource` → handler Prisma → `logAudit` → `notification.service` (best-effort) → JSON.
- Rate-limit **por rota** (não global): `loginLimiter` (IP+e-mail), `emailLimiter`, `resetLimiter` (`express-rate-limit`, janelas/máximos via nomes de variáveis `RATE_LIMIT_*`).
- Segurança de dados: AES-256-CBC (`descricao`, `observacaoTriagem`, `conteudo` relatório, tokens Google, CPF), HMAC-SHA256 blind index para CPF, Argon2id para senhas, JWT com revogação por `senhaAlteradaEm`, auditoria em `logs_auditoria`.
- Testes: vitest + supertest (`tests/`, 20 arquivos), banco isolado via `TEST_DATABASE_URL` (nome da variável; valor não documentado).

## 5. Integrações externas

| Integração | Serviço backend | Uso | Falha |
|---|---|---|---|
| SMTP | `email.service.ts` (nodemailer) | Convites, verificação, reset, notificações | Mock em dev/teste; best-effort (nunca lança) |
| WhatsApp | `whatsapp.service.ts` (provider-agnostic) | Convite prioritário (`notifyInvite`: WhatsApp → e-mail fallback) | Silencioso, cai para e-mail |
| Google Meet | `meet.service.ts` + `google-auth.service.ts` (OAuth, `GoogleCredential` AES) | Link automático quando duplo `CONFIRMADO` em `ONLINE` sem link | Reserva `meet:criando` + avisa gestores (`MEET_GERACAO_FALHOU`); mock em dev/teste |
| PDF relatórios | `relatorio-pdf.service.ts` (pdfkit) | `GET /reports/meus.pdf` | Erro amigável RFF17 |

## 6. Decisões arquiteturais relevantes

1. **SSR com proxies `/api/*`:** `routes/api/notifications|reminders|process-search.tsx` evitam expor o JWT ao browser e reutilizam `apiFetch` SSR.
2. **Trava "1 processo ativo por vítima":** índice parcial SQL na migration (não expressável no Prisma) + checagem otimista em `vitima.service.ts` + 409 nas demandas.
3. **FRIDA 1 por processo:** `consultaId@unique` + checagem por processo (409), sincroniza `Processo.classificacaoRisco`.
4. **Relatórios sigilosos:** `RelatorioConsulta.conteudo` AES, só autor lê; consolidado/PDF filtram por autor.
5. **Admin mock:** `app/routes/admin/painel.tsx` sem loader/action (`INITIAL_USERS` client) — gestão real de usuários está em `/manager/cadastro` + `GET/PATCH /users`.
6. **Demanda pública sem vítima:** snapshot do solicitante na `Demanda` + `solicitanteLocalOcorrencia` filtrável + `localOcorrenciaConfiavel=false` para legado.
7. **Fuso único:** `America/Sao_Paulo` em `format.ts`, `data.ts` e exibições (`DD/MM/AAAA HH:mm`).

## 7. Diagrama de deploy (lógico)

```
Browser ──HTTPS──▶ Frontend SSR (react-router-serve, build/server+client)
                        │ Bearer JWT (cookie __nevim_session)
                        ▼
                   Backend Express (:3000, /health, helmet, CORS, rate-limit)
                        ├── PostgreSQL (Prisma, AES/HMAC em colunas sensíveis)
                        ├── SMTP (e-mails transacionais)
                        ├── WhatsApp provider (convites)
                        └── Google OAuth (Meet)
Script deploy: nevim-backend/scripts/deploy-vm.sh (repo privado, banco, systemd/nginx)
Bootstrap: npm run gestor:create (scripts/create-gestor.ts via variáveis GESTOR_*)
```
