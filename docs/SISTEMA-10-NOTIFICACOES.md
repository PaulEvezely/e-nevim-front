# NEVIM — Notificações e Lembretes

**Documento:** SISTEMA-10-NOTIFICACOES
**Pasta front:** `features/notifications/` · **Backend:** `notifications.routes.ts` (`/notifications`), `services/notification.service.ts`
**Proxies:** `app/routes/api/notifications.tsx`, `app/routes/api/reminders.tsx`

---

## 1. Modelo (`TipoNotificacao`, 17 valores no Prisma)

`NOVA_DEMANDA, CADASTRO_VITIMA, CONSULTA_AGENDADA, CONSULTA_CANCELADA, CONSULTA_CONFIRMADA, CONSULTA_CONFIRMADA_PARCIAL, CONSULTA_REALIZADA, CONSULTA_FALTA, LINK_MEET_DISPONIVEL, MEET_GERACAO_FALHOU, TRIAGEM_REGISTRADA, PROCESSO_ENCAMINHADO, PROCESSO_ENCERRADO, DEMANDA_REJEITADA, FRIDA_PREENCHIDO, FRIDA_ATUALIZADO`.

`Notificacao {id, usuarioId, tipo, titulo, mensagem (mínimo LGPD), lida/lidaEm, entidade/entidadeId, criadoEm}`. Índice `[usuarioId, lida, criadoEm]`.

Tipos front (`types.ts`, 16 espelhados): `NotificationItem`, `NotificationsResponse {total, naoLidas, limite, offset, notificacoes}`, `AppointmentReminder {id, tipoProfissional, dataHora, modalidade, linkMeet}`.

## 2. Emissão (backend, `notification.service.ts`, 627 linhas)

- `criarNotificacao` (in-app) + `notificarGestores` (fan-out) + e-mail best-effort (nunca lança; sem sigilo clínico).
- `notifyInvite` (convite): **WhatsApp → e-mail fallback** (`whatsapp.service.ts` provider-agnostic + mock; `email.service.ts` SMTP/nodemailer ou mock).
- Cobertura ponta a ponta: `notificarGestoresNovaDemanda` → `CadastroVitima` → `ConsultaAgendada/Cancelada/Confirmada/ConfirmacaoParcial/LinkMeetDisponivel/Realizada/Falta` → `TriagemRegistrada` → `FridaPreenchido/Atualizado` → `ProcessoEncaminhado/Encerrado` → `DemandaRejeitada`; `MEET_GERACAO_FALHOU` avisa gestores quando o Meet automático falha.

## 3. Consumo

### API backend

| Método | Path | Descrição |
|---|---|---|
| `GET` | `/notifications?lida=&limit=&offset=` | Só próprias + `{total, naoLidas}` |
| `PATCH` | `/notifications/:id/ler` | Só dono |
| `PATCH` | `/notifications/ler-todas` | Todas do dono |

Testes: `notifications.test.ts` (fan-out, cancelamento, leitura/badge/`ler-todas`, filtro `lida`).

### Front

- `notificationsApi.server.ts`: `fetchPage` (`GET /notifications`), `markRead` (`PATCH /:id/ler`), `markAll` (`PATCH /ler-todas`) via `apiFetchJson`.
- `notificationsApi.client.ts`: via proxies same-origin (`/api/notifications` `intent read/read-all`, `/api/reminders`).
- `NotificationProvider.tsx` (contexto global, montado em `root.tsx`): `{notifications, unreadCount, total, markAsRead/markAllAsRead/refresh/loadMore}`, polling 60s (`REFRESH_INTERVAL_MS`) + `visibilitychange`, `LIST_LIMIT=20`, `loadMore` com dedupe, otimista com rollback, toasts de lembrete (`bottom-4 left-4`; pânico fica à direita).
- `useAppointmentReminders.ts`: só `user/professional` (`manager/admin` ignorados); poll 60s, `localStorage nevim:reminder:<id>` dedup, autodismiss 10s; título `Consulta em X h`, mensagem PT com dia (`hoje/amanhã/data`) + hora São Paulo; rotas `/user/consultas` vs `/professional/appointments`.
- `notificationRouting.ts`: `resolveNotificationRoute(entidade × role)` — `demanda→/manager/demandas/:id`, `consulta→/manager/consultas|/professional/appointments|/user/process`, `processo→/manager/processos/:id|/user/process|/professional/appointments`.
- `notificationUi.ts`: chips `BLUE/AMBER/RED/GREEN/NEUTRAL` (ex.: `CANCELADA/FALTA/REJEITADA/MEET_FALHOU=RED`, `FRIDA=AMBER`, `ENCERRADO=NEUTRAL`).
- `format.ts`: fuso `America/Sao_Paulo` (`formatSaoPauloTime/Date/DayLabel`, `formatRelativeTime/DayKey`, `hoursUntil`).
- Telas: `/user/notificacoes`, `/manager/notificacoes`, `/professional/notificacoes` (guard + lista client); sino `NotificationBell/Dropdown` no `AppHeader` + `Avatar`.

## 4. Regras

- RF16/RFF12: toda escrita relevante gera toast + notificação; lembretes só janela 12h (`reminders.tsx`: `user → /appointments/minhas`, `professional → /appointments?de=&ate=`).
- LGPD: nunca incluir descrição da demanda, observação de triagem ou conteúdo de relatório na mensagem.
- Falhas de e-mail/WhatsApp/Meet nunca bloqueiam a operação principal.
