# NEVIM — Núcleo de Proteção às Mulheres (UESPI)

Plataforma web para gerenciar o fluxo de atendimento do NEVIM — Núcleo de Enfrentamento à Violência contra a Mulher da UESPI — desde o registro de uma **demanda espontânea** (feita pela própria vítima, sem login) até o **encerramento do processo**, passando por triagem, avaliação de risco (**FRIDA**), agendamentos, encaminhamentos e dashboards gerenciais.

Este repositório contém o **frontend** (React Router v8 com SSR). O backend é uma API Express + Prisma + PostgreSQL consumida via `API_URL`.

> Base normativa: [`PRD-NEVIM.md`](./PRD-NEVIM.md) v1.2. Documentação detalhada em [`docs/`](./docs) (ver `SISTEMA-00-INDICE.md`).

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Rotas](#rotas)
- [Pré-requisitos](#pré-requisitos)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Como rodar](#como-rodar)
- [Scripts](#scripts)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Convenções de código](#convenções-de-código)
- [Documentação](#documentação)
- [Deploy](#deploy)

## Funcionalidades

### Área pública (sem login)

- Landing page `PORTAL E-NEVIM` (`/`).
- Wizard de **demanda espontânea** em 3 etapas (`/demanda`) com rascunho em `sessionStorage`, validação por campo e gate de verificação de e-mail.
- Verificação de e-mail (`/verificar-email`), login (`/login`), recuperação/redefinição de senha (`/recuperar-senha`, `/redefinir-senha`).
- Cadastro via **convite de 48h** (`/register/:token`), com aceite explícito do termo LGPD.

### Vítima — `/user/*`

- Painel com jornada do caso (stepper), demanda recente, próxima consulta e notificações.
- Linha do tempo do processo (`/user/process`), agenda de consultas com **confirmar/recusar** (`/user/consultas`), central de notificações.
- **Botão de saída rápida ("pânico")** fixo em todas as telas: troca o conteúdo por tela neutra (clima), limpa rascunhos e redireciona sem confirmação.

### Gestor — `/manager/*`

- Painel com KPIs (demandas pendentes, casos dentro do campus, fila de triagem) e agendamento direto de triagem.
- Fila de demandas com filtros/busca sem reload (`/manager/demandas`), detalhe com aprovar / rejeitar (motivo) / reenviar convite.
- Gestão de profissionais (psicólogo, assistente social, assessor jurídico) e de pacientes.
- Processos: dossiê completo (vínculo, risco, consultas, FRIDA), encaminhamento interno/externo e encerramento com confirmação.
- Consultas: agendar, editar, reagendar, cancelar, detalhar; triagens próprias; aplicação/edição do **FRIDA**.
- **Dashboards** com filtros por período/campus, gráficos (Recharts) e exportação CSV.

### Profissional — `/professional/*`

- Painel com agenda de hoje, próxima consulta e contadores (aguardando confirmação, FRIDA pendente, online hoje).
- Agenda com filtros, confirmação, mudança de status (REALIZADA exige FRIDA) e edição.
- Detalhe da consulta com dossiê + **relatório sigiloso** (somente o autor lê).
- Preenchimento do **FRIDA** em triagens (psicólogo e assistente social escrevem; assessor jurídico só lê).

### FRIDA

Formulário de Avaliação de Risco com 19 perguntas (Sim / Não / Não sabe / Não se aplica) + avaliação estruturada, 1 por processo, classificação `BAIXO / MÉDIO / ELEVADO` que sincroniza o risco do processo. Telas em `/manager/frida/:consultaId` e `/professional/frida/:consultaId`.

### Notificações e lembretes

17 tipos de notificação in-app + e-mail (best-effort), polling de 60s via `NotificationProvider`, sino com badge, lembretes de consultas na janela de 12h e roteamento por perfil/entidade.

## Stack

| Camada | Tecnologias |
|---|---|
| Framework | React 19, React Router 8 (SSR ligado) |
| Linguagem | TypeScript (strict, ES2022) |
| Estilo | Tailwind CSS v4 (`@tailwindcss/vite`), `clsx` + `tailwind-merge` (`cn`) |
| Dados/UI | Recharts (dashboards), React Day Picker, jsPDF + jspdf-autotable (exportação PDF), date-fns |
| Auth front | Cookie `__nevim_session` (8h) + JWT do backend (`jsonwebtoken`) |
| Build/serve | Vite 8, `react-router-serve` |

## Estrutura do projeto

```text
nevim/
├── app/
│   ├── routes.ts              # mapa central de rotas (index/layout/prefix)
│   ├── root.tsx               # loader de role + NotificationProvider + ErrorBoundary
│   ├── app.css                # Tailwind + estilos globais
│   ├── data/                  # brasil.json, brazilLocations, uespiCourses, violenceTypes
│   └── routes/
│       ├── public/            # home, demanda, login/logout, register/:token, recover/reset, 403
│       ├── user/              # painel, process, consultas, notificacoes (+layout)
│       ├── manager/           # painel, demandas, pacientes, processos, consultas, dashboards (+layout)
│       ├── professional/      # painel, appointments, appointment-detail, notificacoes (+layout)
│       └── api/               # proxies same-origin: notifications, reminders, process-search
├── features/                  # lógica por domínio (client + *.server.ts)
│   ├── auth/                  # cookie, require-user, roleHome, mapPerfil, authApi, apiFetch
│   ├── public/                # demandsApi, emailVerification, passwordRecovery, registerApi
│   ├── user/                  # consultasApi, demandsApi, victimJourney, components
│   ├── manager/               # managerApi, appointmentApi, dashboardApi, processReportApi + components
│   ├── professional/          # consultasUtils, labels, relatorioApi, frida/
│   ├── notifications/         # types, apis, NotificationProvider, routing, format, reminders
├── libs/
│   ├── api.server.ts          # BASE, ApiError, mensagens amigáveis (RFF17)
│   └── utils.ts               # cn()
├── shared/
│   ├── components/            # Button, StatusBadge, EmergencyExitButton, Toast, ConfirmModal,
│   │                          # Pagination, Sidebar, NotificationBell, Comboboxes, KpiCard, Spinner/Skeleton…
│   ├── hooks/                 # useToast, useDebounce, useReducedMotion
│   ├── layouts/               # AppHeader
│   └── utils/                 # date.ts (pt-BR, America/Sao_Paulo)
├── public/                    # favicons, imagens
├── docs/                      # documentação SISTEMA-* + PRD e planos históricos
├── PRD-NEVIM.md               # documento normativo de requisitos
└── build/                     # saída de `npm run build` (client + server, não versionar à mão)
```

## Rotas

| URL | Acesso | Descrição |
|---|---|---|
| `/` | público | Landing page |
| `/demanda` | público | Wizard de demanda espontânea |
| `/verificar-email`, `/login`, `/logout`, `/recuperar-senha`, `/redefinir-senha`, `/register/:token`, `/403` | público | Auth e convites |
| `/api/notifications`, `/api/reminders`, `/api/process-search` | logado | Proxies same-origin (não expõem o JWT ao browser) |
| `/user`, `/user/process`, `/user/consultas`, `/user/notificacoes` | `user` (vítima) | Jornada, processo, consultas, notificações |
| `/manager`, `/manager/demandas`, `/manager/demandas/:id`, `/manager/cadastro`, `/manager/pacientes`, `/manager/processos/:id`, `/manager/consultas`, `/manager/consultas/:id`, `/manager/minhas-triagens`, `/manager/frida/:consultaId`, `/manager/dashboards`, `/manager/notificacoes` | `manager` (gestor) | Fila, processos, agenda, FRIDA, dashboards |
| `/professional`, `/professional/appointments`, `/professional/appointments/:id`, `/professional/frida/:consultaId`, `/professional/notificacoes` | `professional` | Agenda, detalhe, relatório sigiloso, FRIDA |

Guards: `requireUser(request, [roles])` — sem sessão válida vai para `/login`; papel errado vai para a home do próprio perfil (`ROLE_HOME`). Sessão persiste entre reloads (RFF18).

## Pré-requisitos

- Node 22+ e npm.
- Backend NEVIM rodando e acessível (Express + PostgreSQL) — o frontend só faz `fetch` para a base configurada em `API_URL`.
- Porta livre `5173` (dev) e `3000` (produção via `react-router-serve`, se rodar local junto do backend ajuste as portas).

## Variáveis de ambiente

Crie um arquivo `.env` na raiz (não versionado). Apenas os **nomes** das variáveis — nunca commite valores/segredos:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `API_URL` | sim | URL base da API do backend (ex.: endereço do Express). Sem ela as chamadas SSR retornam 503 amigável. |
| `SESSION_SECRET` | sim | Segredo para assinar o cookie de sessão do frontend (`__nevim_session`). **Não** é o `JWT_SECRET` do backend. |
| `JWT_SECRET` | sim | Segredo para verificar o JWT emitido pelo backend no `requireUser`/`getOptionalUser`. Deve ser igual ao do backend. |
| `NODE_ENV` | não | `development` / `production` (ajusta `secure` do cookie e mocks). |

Exemplo de shape (preencha com os valores do seu ambiente):

```bash
API_URL=http://localhost:3000
SESSION_SECRET=troque-por-um-segredo-longo
JWT_SECRET=igual-ao-JWT_SECRET-do-backend
NODE_ENV=development
```

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar o .env (ver tabela acima) apontando API_URL para o backend

# 3. Desenvolvimento (SSR + HMR em http://localhost:5173)
npm run dev

# 4. Conferência de tipos
npm run typecheck

# 5. Build de produção (gera build/client + build/server)
npm run build

# 6. Servir o build (produção)
npm start
```

Fluxo típico: subir o backend primeiro (`:3000` + `/health`) → apontar `API_URL` no `.env` do frontend → `npm run dev`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | `react-router dev` — dev server com SSR/HMR (`:5173`) |
| `npm run build` | `react-router build` — build de produção (`build/client` + `build/server`) |
| `npm start` | `react-router-serve ./build/server/index.js` — serve o build |
| `npm run typecheck` | `react-router typegen && tsc` — tipos + validação |

## Segurança e privacidade

- Autenticação por JWT (8h) em cookie `httpOnly`, `sameSite: lax`, `secure` em produção; RBAC por perfil em todos os layouts.
- Botão de saída rápida em todas as telas da vítima (sem confirmação, com tela disfarçada + `Esc`).
- Consentimento LGPD explícito antes de concluir demanda/cadastro; mensagens de erro amigáveis sem vazar detalhes técnicos (RFF17).
- Ações críticas (encerrar processo, excluir, desativar usuário) exigem modal de confirmação.
- Dados sensíveis (descrições, relatórios, CPF, tokens) são criptografados no backend (AES-256 + HMAC + Argon2id) — o frontend nunca descriptografa nada.

## Convenções de código

- **Código em inglês**, exceto `console.log`, mensagens de erro e textos de UI (pt-BR).
- Clean Code, componentização e Tailwind; cores da paleta do PRD centralizadas em `StatusBadge` / `chartTheme` (não espalhar hex).
- Padrão loader/action: `loader` valida sessão e busca via `*Api.server.ts`; `action` processa forms, converte `ApiError` em `fieldErrors`/toast.
- Feedback padrão: `Toast` após escritas, `ConfirmModal` em ações destrutivas, `Skeleton`/`Spinner` em carregamentos perceptíveis, `Pagination` em listas.
- Validação no cliente por campo (mensagens específicas) + validação normativa com Zod no backend.

## Documentação

- [`PRD-NEVIM.md`](./PRD-NEVIM.md) — requisitos normativos (RF01–RF23, RFF01–RFF18, fluxos, paleta).
- [`docs/SISTEMA-00-INDICE.md`](./docs/SISTEMA-00-INDICE.md) — índice navegável da documentação técnica.
- `docs/SISTEMA-01…12` — visão geral, arquitetura, modelo de dados, backend, frontend, referência da API, fluxos, auth/segurança, FRIDA, notificações, dashboards e guia de desenvolvimento. Em caso de divergência, vale o código + `SISTEMA-*`.

## Deploy

```bash
npm run build
npm start
```

Saída do build:

```text
├── package.json
├── package-lock.json
├── build/
│   ├── client/    # assets estáticos
│   └── server/    # código SSR
```

Pode ser containerizada com Docker ou servida em qualquer plataforma Node (o servidor `react-router-serve` é production-ready). O backend precisa estar acessível via `API_URL`, com CORS liberando a origem do frontend.
