# NEVIM — Frontend

**Documento:** SISTEMA-05-FRONTEND
**Stack:** React 19 · React Router 8 (SSR) · Tailwind v4 · Recharts · React Day Picker · jsPDF
**Pastas:** `app/` · `features/` · `libs/` · `shared/`

> Nenhum `.env` foi lido. Variáveis citadas apenas pelo nome (`API_URL`, `JWT_SECRET`, `SESSION_SECRET`).

---

## 1. Configuração

| Arquivo | Relevante |
|---|---|
| `vite.config.ts` | `plugins: [tailwindcss(), reactRouter()]`, `resolve.tsconfigPaths: true` |
| `react-router.config.ts` | `ssr: true` |
| `tsconfig.json` | `target/module ES2022`, `jsx: react-jsx`, `strict`, `paths {"~/*": ["./app/*"]}` |
| `app/app.css` | Tailwind + estilos globais |
| `app/data/` | `brasil.json` + `brazilLocations.ts` (`getBrazilStatesSync/getCitiesByUfSync`), `uespiCourses.ts` (`getCampusOptionsSync/getCoursesByCampusSync`), `violenceTypes.ts` (`getViolenceTypeOptions`) — wizard de demanda/cadastro |
| `package.json` (raiz) | `dev` (react-router dev), `build`, `start` (react-router-serve), `typecheck`; deps `react-router, recharts, jspdf(+autotable), date-fns, react-day-picker, jsonwebtoken, clsx, tailwind-merge` |

## 2. Mapa de rotas (`app/routes.ts`)

| URL | Arquivo | Acesso |
|---|---|---|
| `/` | `routes/public/home.tsx` | público |
| `/api/notifications` | `routes/api/notifications.tsx` | logado (401 JSON senão) |
| `/api/reminders` | `routes/api/reminders.tsx` | logado |
| `/api/process-search` | `routes/api/process-search.tsx` | `manager` |
| Layout `routes/public/PublicLayout.tsx` | shell header/footer + `Outlet` | público |
| `/demanda` | `routes/public/demand.tsx` | público (wizard 3 etapas + gate verificação) |
| `/demanda/confirmacao` | `routes/public/demand-confirmation.tsx` | **arquivo vazio (0B), rota morta** |
| `/verificar-email` | `routes/public/verify-email.tsx` | público |
| `/recuperar-senha` | `routes/public/recover-password.tsx` | público |
| `/redefinir-senha` | `routes/public/reset-password.tsx` | público |
| `/login`, `/logout`, `/403` | `login\|logout\|403.tsx` | público |
| `/register/:token` | `routes/public/register.tsx` | público (convite 48h) |
| `/terms` | `routes/public/terms.tsx` | **arquivo vazio (0B)** |
| `/user` (+ layout) | `routes/user/layout.tsx` + `painel.tsx` | `user` |
| `/user/process`, `/user/consultas`, `/user/notificacoes` | `process|consultas|notificacoes.tsx` | `user` |
| `/manager` (+ layout) | `routes/manager/layout.tsx` + `painel.tsx` | `manager` |
| `/manager/demandas`, `/manager/demandas/:id` | `demandas.tsx`, `demanda-detalhe.tsx` | `manager` |
| `/manager/cadastro`, `/manager/pacientes` | `cadastro.tsx`, `pacientes.tsx` | `manager` |
| `/manager/processos/:id` | `processo-detalhe.tsx` | `manager` |
| `/manager/consultas`, `/manager/consultas/:id` | `consultas.tsx`, `consulta-detalhe.tsx` | `manager` |
| `/manager/notificacoes`, `/manager/minhas-triagens` | `notificacoes.tsx`, `minhas-triagens.tsx` | `manager` |
| `/manager/frida/:consultaId` | `frida.tsx` | via `loadFridaPage(..., "manager")` |
| `/manager/dashboards` | `dashboards.tsx` | `manager` |
| `/professional` (+ layout) | `routes/professional/layout.tsx` + `painel.tsx` | `professional` |
| `/professional/appointments`, `/professional/appointments/:id` | `appointments.tsx`, `appointment-detail.tsx` | `professional` |
| `/professional/notificacoes` | `notificacoes.tsx` | `professional` |
| `/professional/frida/:consultaId` | `frida.tsx` | via `loadFridaPage(..., "professional")` |
| `/professional/process` | `process.tsx` | **vazio, não registrado em `routes.ts`** |
| `/admin` (+ layout) | `routes/admin/layout.tsx` + `painel.tsx` | `admin` (mock client) |

Guard padrão: `requireUser(request, [roles])` → `/login` (sem token/inválido, destrói cookie) ou `ROLE_HOME[role]` (papel errado). RFF01.

### `app/root.tsx`

`loader` → `getOptionalUser()` → `{role}`; `App` envolve `Outlet` em `NotificationProvider(authenticated, role)`; `links` Inter + favicons; `ErrorBoundary` 404/403/500 pt-BR. RFF17.

---

## 3. Rotas públicas

- `home.tsx`: sem loader/action. Landing `PORTAL E-NEVIM` + `DemandButton → /demanda`, `LoginButton → /login`, `EmergencyExitButton`, footers.
- `login.tsx`: `loader` (`getOptionalUser` → `getHomeRoute(role)`; limpa cookie inválido). `action` (`authApi.login` → `session.set(token)` → `mapPerfilParaUser` → `getHomeRoute`). Valida e-mail regex client+server (RFF03), `Button primary`, links recuperar/registrar.
- `logout.tsx`: `loader` + `action` (`destroySession` → `/login`).
- `demand.tsx`: `action` só JSON — exige `lgpdConsent===true` + `emailVerificationToken`, chama `demandsApi.createPublicDemand`, mapeia `fieldErrors` (409 "processo ativo" vira erro no e-mail). UI: wizard 3 etapas (Identificação/Vínculo/Ocorrência, RFF02) + gate `awaitingVerification` (reenvio 60s, `localStorage` 24h, `sessionStorage` draft, auto-submit ao confirmar em outra aba) + sucesso "Aguarde e-mail de cadastro".
- `verify-email.tsx`: `loader ?token` → `emailVerificationApi.confirm` (`{verified|error invalid/expired/used/rate_limited/unavailable}`). `action {email}` reenvia. Salva `saveEmailVerification` + lê `readDemandPending` p/ fechar gate.
- `recover-password.tsx`: `action {email}` → `passwordRecoveryApi.request`. Cooldown 60s + sucesso genérico.
- `reset-password.tsx`: `loader ?token` → `{token, tokenPresent}`. `action {token, newPassword, confirm}` (min 8).
- `register.tsx`: `loader :token` → `registerApi.validateInvite` (`{invite|inviteError}`). `action` → `registerApi.complete` (CPF com DV, senha, curso/matrícula). UI 3 etapas (Conta/Dados/Endereço) pré-preenchida, e-mail `readOnly`, LGPD front-only, `inviteStale` em 404/410, `shouldRevalidate=false`.
- `403.tsx`: estático "Acesso negado".

### Proxies `/api/*` (same-origin, evitam expor JWT ao browser)

- `notifications.tsx`: `getOptionalUser` (401 JSON); `loader ?limit/offset/lida` → `fetchNotificationsPage`; `action {intent: read/read-all, id}`.
- `reminders.tsx`: `manager/admin → []`; `user → GET /appointments/minhas` (janela 12h `AGENDADA`); `professional → GET /appointments?de=&ate=` (12h). Retorna `AppointmentReminder[]`.
- `process-search.tsx`: `requireUser(["manager"])`. `GET ?q&triage&limit&tipo` → `appointmentApi.searchProcessOptions` (+ filtro `TRIAGEM→ABERTO/EM_TRIAGEM`, fallback UUID). Nunca vaza stack.

---

## 4. Área da vítima (`/user`, `requireUser(["user"])`, `UserSidebar + AppHeader`)

| Rota | Loader/action | UI |
|---|---|---|
| `painel.tsx` (index) | `listMyDemands + consultasApi.listMine + fetchNotificationsPage(limit:1)` → demanda recente + próxima consulta + `unreadCount` | Stepper `getVictimJourneySteps`, `StatusBadge`, links processo/consultas |
| `process.tsx` | idem | Linha do tempo da jornada + consultas + `formatDate` |
| `consultas.tsx` | `loader listMine`; `action confirmar/recusar` (`validateRefusalReason`) | `ConsultationCard` (chips modalidade/tipo) + `ConfirmModal` + `Toast` (RFF10/RFF12) |
| `notificacoes.tsx` | só guard; lista 100% client via `NotificationProvider` + `resolveNotificationRoute` + `formatRelativeTime` | sino + lista |

`features/user/`: `consultasApi` (`listMine GET /appointments/minhas`, `confirm POST /:id/confirmar`, `refuse POST /:id/recusar`), `demandsApi` (`listMyDemands GET /demands → MyDemand{id, status, processo{id,status}}`), `victimJourney.getVictimJourneySteps` (REJEITADA = 2 steps; senão 5: registrada/análise/triagem/acompanhamento), `consultasUtils` (labels, `isConfirmedByVictim`, `validateRefusalReason`), `UserSidebar`, `ConsultationCard`. RFF04 (saída rápida fixa) via `EmergencyExitButton` no layout.

## 5. Área do gestor (`/manager`, `requireUser(["manager"])`, `ManagerSidebar` 8 itens + `AppHeader GESTOR`)

| Rota | Loader/action | UI |
|---|---|---|
| `painel.tsx` (index) | `listFilaDemandas, listTriageQueue, listTriageProcessOptions, getGestor, professionals, myTriagemAppointments` | KPIs `KpiCard` (pendentes/dentro-campus/triagem), filas + `AppointmentForm` p/ triagem (RFF05) |
| `demandas.tsx` | `parseDemandFilters/Page` → `managerApi.listDemands` | `DemandTable + DemandFilters + Pagination` (RFF08) |
| `demandas/:id` | `getDemand(id)`; `action aprovar/rejeitar(motivo)/reenviar` | Detalhe + `ConfirmModal + StatusBadge + Toast` |
| `cadastro.tsx` | `listProfessionals`; `action cadastrar (validateProfessionalForm→toCreate)/ativo(toggle)` | Tabela `PSICOLOGO/ASSISTENTE_SOCIAL/ASSESSOR_JURIDICO` (CRP/CRESS/OAB) + `Pagination` |
| `pacientes.tsx` | `listPatients + triage/emTriagem/processOptions + professionals + calendar` | `PatientTable + PatientFilters + AppointmentForm` |
| `processos/:id` | `getProcessReport + professionalNames + triageStatus + options + calendar`; `action encerrar/encaminhar-externo` | Dossiê (vínculo, risco, consultas, FRIDA) + `EncaminharExternoModal` |
| `consultas.tsx` | `listAppointments + processOptions + professionals + calendar + triageToSchedule`; `action agendar/editar` | `AppointmentTable/Filters/Form(960L ProcessCombobox+DateTime)/EditForm` |
| `consultas/:id` | `detail + report + hasFrida`; `action status REALIZADA/CANCELADA/FALTOU` | Detalhe + link FRIDA |
| `minhas-triagens.tsx` | como `consultas`, só triagens do gestor | `ManagerTriagemCard` |
| `notificacoes.tsx` | guard + lista client → `/manager/*` | sino + lista |
| `frida/:consultaId` | `loadFridaPage(req, id, "manager")` / `handleFridaAction` | `FridaPage backHref=/manager/consultas` |
| `dashboards.tsx` | `parseDashboardPeriod → dashboardApi.getAll` | `DashboardLayout + KpiRow + GraficoBarras/Donut/Linha/Horizontal + FiltroPeriodo + ExportButton CSV + Skeleton/ErrorState` (RFF11/RFF14/RFF15) |

`features/manager/`: `managerApi` (fila, demandas, pacientes), `appointmentApi` (CRUD + `searchProcessOptions/getProcessOptionById`), `professionalsApi`, `victimsApi` (`fetchVictimsAwaitingTriage/InTriagem`), `dashboardApi` (`getSummary/getAll + buildPeriodQuery`), `processReportApi` (`getProcessReport/encerrar/encaminharExterno`); puros `managerUtils` (filtros/pag, `isDentroCampusItem`, `shortId`), `appointmentUtils` (`validateAppointmentForm/Details`, `filter/sort/paginate`), `patientUtils` (labels triagem/risco), `professionalsUtils` (CRP/CRESS/OAB), `dashboardUtils` (`DashboardPeriod/Data`, `toChartData/toMonthlySeries`), `externalReferral` (`DEFENSORIA/…`), `exportUtils` (CSV `;` + BOM).

## 6. Área profissional (`/professional`, `requireUser(["professional"])`)

Header label por `getProfessionalHeaderLabel`; `ProfessionalSidebar` (Início/agenda/notificações).

| Rota | Loader/action | UI |
|---|---|---|
| `painel.tsx` (index) | `listAppointments + processOptions` → enrich/sort → `counts {today, awaitingConfirmation, overdue, fridaPendente, onlineToday}`, `next`, `todayList`, `isPsicologo/isFridaWriter/papel` | Agenda hoje + próxima (RFF06) |
| `appointments.tsx` | `list + fridaPorProcesso + counts`; `action editar/status/confirmar` (REALIZADA exige FRIDA) | `ProfessionalAppointmentCard + StatusFilter + EditForm` |
| `appointments/:id` | `detail + report + hasFrida + relatorio` (só autor, 404 senão); `action status/confirmar/relatorio(create/update)` | Dossiê + relatório sigiloso |
| `notificacoes.tsx` | guard + lista client → `/professional/appointments` | sino + lista |
| `frida/:consultaId` | `loadFridaPage(req, id, "professional")` | `FridaPage backHref=/professional/appointments` |

`features/professional/`: `consultasUtils` (parse/filter/count), `professionalLabels` (`isPsicologo/isFridaWriter`: psico + assistente em triagem escrevem, jurídico só lê), `relatorioApi` (sigiloso por consulta). FRIDA em `features/professional/frida/` (ver SISTEMA-09).

## 7. Área admin (`/admin`, mock)

`layout` (`requireUser(["admin"])` + `AppHeader ADMIN + Fotter`); `painel.tsx` sem loader/action — `INITIAL_USERS` client (gestor + psicóloga), desativar com `ConfirmModal` + reativar + `StatusBadge`. Gestão real está em `/manager/cadastro` + `/users`.

## 8. `features/auth/` (sessão e RBAC front)

- `cookie.server.ts`: `createCookieSessionStorage __nevim_session`, `httpOnly, sameSite lax, 8h, secure prod`, `secrets [SESSION_SECRET]`. `get/commit/destroySession`.
- `require-user.server.ts`: `jwt.verify(token, JWT_SECRET)` → `PayloadToken {sub, email, profile/perfil, name/nome}`; sem token/inválido/sem campos → `/login` (destrói cookie); papel errado → `ROLE_HOME[role]`; `getOptionalUser` null-safe. RFF01/RFF18.
- `mapPerfil.ts`: `VITIMA→user, GESTOR→manager, ADMIN→admin, demais→professional` (+ `speciality`).
- `roleHome.ts`: `{user:/user, manager:/manager, professional:/professional, admin:/admin}`, `getHomeRoute` fallback `/`.
- `apiFetch.server.ts`: `getTokenFromRequest/getAuthHeaders/apiFetch(req, path, init)` (injeta `Bearer` + JSON, preserva `FormData`), `apiFetchJson` lança `ApiError` amigável (RFF17), 204 → undefined.
- `authApi.server.ts`: `POST /auth/login`, `GET /auth/me`, `PATCH /auth/me`, `PATCH /auth/me/password` (+ `parseApiError/toFriendlyMessage`).
- `types/login.ts`: `Role user|manager|professional|admin`, `speciality`, `User{id, name, email, role, speciality}`.

## 9. `features/notifications/` (resumo; detalhe em SISTEMA-10)

`types` (16 tipos + `NotificationItem/Response`), `notificationsApi.server` (`GET /notifications`, `PATCH /:id/ler`, `/ler-todas`), `notificationsApi.client` (via `/api/*`), `NotificationProvider` (polling 60s, limite 20, `loadMore`, otimista com rollback, toasts lembretes), `useAppointmentReminders` (janela 12h, dedup `localStorage`, autodismiss 10s), `notificationRouting` (`resolveNotificationRoute` por entidade×role), `notificationUi` (chips azul/âmbar/vermelho/verde/neutro), `format` (fuso `America/Sao_Paulo`).

## 10. `libs/` e `shared/`

- `libs/api.server.ts`: `ApiError{status, fieldErrors, formErrors}`, `getApiBaseUrl()` (lê nome `API_URL`, 503 se vazio), `toFriendlyMessage` (401 sessão expirada, 403 sem permissão, 404 não encontrado, 409 já existe, 410 expirado, 400/422 corrija campos, 5xx tente instantes — RFF17), `parseApiError`. `libs/utils.ts`: `cn(clsx + twMerge)`.
- `shared/components/`: `Button` (primary/secondary/outline/danger + loading), `StatusBadge` (processo, risco, triagem, campus — cores PRD inline, RFF09), `EmergencyExitButton` (overlay `DecoyClima` + `Esc`, `replaceState /` + troca title, limpa drafts; fallback Google — RFF04), `DecoyClima` (clima falso p/ disfarce), `Toast` (RFF12), `ConfirmModal` (RFF10), `Sidebar` genérico (drawer mobile), `Pagination`, `CityCombobox/ProcessCombobox` (busca sem acento, teclado, `onQueryChange`), `NotificationBell/Dropdown` (badge + routing), `Avatar`, `Spinner/Skeleton/LoadingOverlay` (RFF11), `KpiCard`, `Fotter`.
- `shared/hooks/`: `useToast` (4s), `useDebounce/useDebouncedValue`, `useReducedMotion` (SSR-safe).
- `shared/layouts/AppHeader.tsx`: logo → `getHomeRoute(role)`, chip `perfilLabel`, `NotificationBell`, `EmergencyExitButton`, logout.
- `shared/utils/date.ts`: `formatDate/formatDateTime/formatTime` pt-BR, `—` se inválido.
