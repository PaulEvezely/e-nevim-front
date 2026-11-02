# NEVIM — Fluxos de Negócio e Regras

**Documento:** SISTEMA-07-FLUXOS-DE-NEGOCIO
**Base:** PRD §8 + implementação (`demands/processes/appointments/frida/referrals` routes, `vitima.service`, front wizards)

---

## 1. Fluxo principal (12 passos, PRD §8.1)

| Passo | Ator | Ação | Tela / Endpoint | Próxima |
|---|---|---|---|---|
| 01 | Vítima | Registra demanda espontânea | `/demanda` → `POST /demands/public` | 02 |
| 02 | Vítima | Preenche formulário (3 etapas + LGPD + e-mail verificado) | wizard `demand.tsx`, gate `awaitingVerification` | 03 |
| 03 | Sistema | Recebe, cria `PENDENTE + convite 48h`, notifica gestores | `notifyGestoresNovaDemanda` (`NOVA_DEMANDA`) | 04 |
| 04 | Gestor | Analisa fila priorizada | `/manager/demandas`, `GET /demands?sort=fila` | 05 |
| 05a | Gestor | Aprova → gera/renova convite, notifica (WhatsApp→e-mail) | `PATCH /demands/:id/aprovar` | 06 |
| 05b | Gestor | Rejeita com motivo ≥10 chars | `PATCH /demands/:id/rejeitar` + `DEMANDA_REJEITADA` | fim |
| 06 | Vítima | Acessa link e completa cadastro (4 etapas) | `/register/:token` → `POST /auth/register/:token` | 07 |
| 07 | Sistema | Cria usuário+vítima, `APROVADA`, `processo ABERTO` (transação) | `notifyGestores` (`CADASTRO_VITIMA`) | 08 |
| 08 | Gestor | Agenda 1ª triagem (`TRIAGEM`) | `/manager/consultas\|pacientes\|painel` → `POST /appointments` | 09 |
| 09 | Gestor/Prof | Agenda acompanhamentos (`PSICOLOGO/ASSISTENTE_SOCIAL/ASSESSOR_JURIDICO`) | `POST /appointments` (só `ENCAMINHADO`) | 10 |
| 10 | Sistema | Notifica vítima + profissionais (12h lembretes + e-mails) | `CONSULTA_AGENDADA`, `useAppointmentReminders` | 11 |
| 11 | Profissionais | Realizam consultas (confirmam, registram status/relatório) | `/professional/appointments/:id` | 12 |
| 12 | — | Consulta concluída (`REALIZADA/CANCELADA/FALTOU`) | `PATCH /appointments/:id/status` | — |

### Tarefas opcionais/paralelas (PRD §8.2)

| Categoria | Ator | Quando | Endpoint |
|---|---|---|---|
| Encaminhamento interno | `GESTOR` | Durante análise ou após consulta (`EM_TRIAGEM/ENCAMINHADO`) | `PATCH /processes/:id/encaminhar {direcionadoPara}` |
| Encaminhamento externo | `GESTOR` | Avulso em `ENCAMINHADO` | `POST /referrals {destino, detalhes?}` |
| Relatórios | Sistema/profissional | Após agendamentos; relatório por consulta `REALIZADA` | `POST /appointments/:id/relatorio`, `GET /reports/meus(.pdf)` |

## 2. Regras de negócio (PRD §6.2 + código)

1. **Status processo (backend):** `ABERTO → EM_TRIAGEM → ENCAMINHADO → ENCERRADO`. UI usa `StatusBadge` (Pendente/Ativo/Inativo/Encerrado + triagem + risco).
2. **Risco FRIDA:** `BAIXO/MEDIO/ELEVADO` (cálculo + nível profissional justificado; detalhe em SISTEMA-09).
3. **Alerta campus (RF06):** `solicitanteLocalOcorrencia` filtrável (`onlyCampus`); badge "dentro do campus" no painel (`isDentroCampusItem`).
4. **Quem vê/preenche FRIDA:** PRD diz gestor+psicólogo; implementação: `GESTOR` (triagem própria) + `PSICOLOGO` (consulta própria) escrevem; `ASSISTENTE_SOCIAL` escreve em triagem e corrige; `ASSESSOR_JURIDICO` só leitura vinculada; vítima 403.
5. **Ações destrutivas exigem confirmação (RFF10):** `ConfirmModal` em encerrar/desativar/excluir; backend exige motivo (rejeição) e valida transições.
6. **Código em inglês** (exceto `console.log`, mensagens, UI), Clean Code, componentização Tailwind, a11y/responsivo (PRD §6.1).
7. **Trava 1 ativo/vítima:** índice parcial + 409 em `POST /demands/public`, `POST /demands`, `POST /processes`.
8. **1 triagem ativa/processo + 1 FRIDA/processo + 1 relatório/consulta** (409).
9. **Conflito agenda:** 409 em sobreposição `[start,end)` por profissional; adjacente permitido; legado +30min; limite 8h.
10. **Triagem move processo:** `REALIZADA` (triagem) `ABERTO→EM_TRIAGEM`; cancelar triagem reverte; `ENCERRADO` cancela `AGENDADA`s e bloqueia triagem/encaminhar/agendar/FRIDA/confirmar/recusar.
11. **Compatibilidade:** `TRIAGEM` só em `ABERTO/EM_TRIAGEM`; demais só em `ENCAMINHADO`; jurídico não faz triagem (400); FRIDA só em `TRIAGEM/PSICOLOGO REALIZADA` própria.
12. **Dupla confirmação:** gestor nunca confirma; vítima + profissional confirmam; duplo `CONFIRMADO` em `ONLINE` sem link → Meet automático; recusa → `CANCELADA`.

## 3. Jornada da vítima (front, `victimJourney.ts`)

- `REJEITADA` → 2 steps (encerrada).
- Senão 5 steps: registrada → em análise → triagem → acompanhamento → (encerramento).
- Fontes: `listMyDemands` (mais recente) + `consultasApi.listMine` (próxima) + `fetchNotificationsPage(limit:1)`.

## 4. Fluxos por perfil (telas)

- **Vítima:** `/demanda` (sem login) → `/register/:token` → `/login` → `/user` (jornada) → `/user/process` (timeline) → `/user/consultas` (confirmar/recusar) → `/user/notificacoes`.
- **Gestor:** `/manager` (KPIs + filas + agendar triagem) → `/manager/demandas[/:id]` (aprovar/rejeitar) → `/manager/pacientes` (triagem/encaminhar) → `/manager/processos/:id` (dossiê + encerrar) → `/manager/consultas[/:id]` (agendar/editar) → `/manager/frida/:consultaId` → `/manager/dashboards` → `/manager/cadastro` (profissionais).
- **Profissional:** `/professional` (agenda hoje/próxima) → `/professional/appointments[/:id]` (editar/confirmar/status/relatório) → `/professional/frida/:consultaId` → `/professional/notificacoes`.
- **Admin:** `/admin` (mock; gestão real em `/manager/cadastro`).

## 5. Fluxo de erro e validação (RFF03/RFF17)

- Client: validação por campo, mensagens específicas, sem bloquear demais campos; `fieldErrors` do backend mapeados no form.
- Server: Zod (`validators.ts`); `ApiError` → `toFriendlyMessage` (401 sessão expirada, 403 sem permissão, 404 não encontrado, 409 já existe, 410 expirado, 400/422 corrija campos, 5xx tente instantes) + `Toast` + retry; nunca expõe stack (exceto `process-search` que garante não vazar).
