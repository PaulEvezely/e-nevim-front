# NEVIM — Referência de API (Backend)

**Documento:** SISTEMA-06-API-REFERENCE
**Base URL:** nome da variável `API_URL` (sem `/` final; valor não documentado aqui)
**Auth:** `Authorization: Bearer <JWT>` exceto rotas marcadas "pública"
**Erros:** `{error, details?, fieldErrors?}`; mensagens amigáveis no front via `toFriendlyMessage` (RFF17)

Convenções: `GESTOR` = manager; `PSI` = `PSICOLOGO`; `ASSIST` = `ASSISTENTE_SOCIAL`; `JURID` = `ASSESSOR_JURIDICO`. RBAC via `allowProfiles`; vítima restrita via `onlyOwnResource`.

---

## 1. Utilidades

| Método | Path | Auth | Descrição |
|---|---|---|---|
| `GET` | `/health` | — | `{status:"ok"}` |

## 2. `/auth`

| Método | Path | Auth/RBAC | Body / Query | Resposta / Efeito |
|---|---|---|---|---|
| `POST` | `/auth/register-victim` | pública | perfil vítima completo (nome/e-mail/senha, CPF com DV, vínculo, etc.) | 201 usuário+vítima; 409 e-mail/CPF; envia verificação best-effort |
| `GET` | `/auth/invite/:token/validate` | pública | — | `{demandaId, solicitante, expiraEm}`; 404/410 usado/expirado |
| `POST` | `/auth/register/:token` | pública | conta + perfil vítima + LGPD | Transação: usuário+vítima, `demanda.vitimaId` + `APROVADA`, `processo ABERTO` upsert, `convite.usado` |
| `POST` | `/auth/login` | pública + `loginLimiter` | `{email, senha}` | `{token, usuario{id, email, profile/perfil, nome}}` (JWT `{sub, email, profile}`) |
| `POST` | `/auth/email/verify/request` | pública + `emailLimiter` | `{email}` | Sempre 202 genérico; dev pode retornar `_debugLink/Token` |
| `GET` | `/auth/email/verify/confirm?token=` | pública | `token` | Idempotente; marca `verificadoEm` + `emailVerificado` se conta existe |
| `POST` | `/auth/forgot-password` | pública + `emailLimiter` | `{email}` | Sempre 202; envia só se conta ativa; cooldown |
| `POST` | `/auth/reset-password` | pública + `resetLimiter` | `{token, newPassword, confirm}` | Consome token, argon2, `senhaAlteradaEm` (revoga JWTs), invalida demais resets |
| `GET` | `/auth/me` | `authenticate` | — | Usuário sem `senhaHash`; CPF descriptografado só p/ dona |
| `GET` | `/auth/vitimas/minha` | `VITIMA` | — | DTO LGPD "Meus Dados" |
| `PATCH` | `/auth/me` | `authenticate` | `{nome}` + campos vítima se `VITIMA` | E-mail/cpf/vínculo/perfil bloqueados |
| `PATCH` | `/auth/me/password` | `authenticate` | `{atual, nova}` | Não grava `senhaAlteradaEm` (mantém sessão atual) |
| `POST` | `/auth/register-professional` | `GESTOR` | `{nome, email, senha, perfil, crp/cress/oab}` | 201 profissional; documento único |

## 3. `/demands`

| Método | Path | Auth/RBAC | Query/Body | Resposta |
|---|---|---|---|---|
| `POST` | `/demands/public` | pública | demanda + `emailVerificationToken` (+ `lgpdConsent`) | `PENDENTE + convite 48h` (transação); 409 se e-mail com processo ativo; `notifyGestoresNovaDemanda` |
| `GET` | `/demands` | todos autenticados | GESTOR: `status/campus/violenceType/q/de/ate/onlyCampus/registration/sort=fila\|recent/page/limit` | GESTOR: página + `counts {ALL, PENDENTE, AGUARDANDO_CADASTRO, EM_PROCESSO, REJEITADA}`; VITIMA: próprias + `processo{id,status}`; profissionais: envelope vazio |
| `PATCH` | `/demands/:id/aprovar` | `GESTOR` | — | `PENDENTE→APROVADA` + convite + `ABERTO` se tem vítima + `notifyInvite` |
| `POST` | `/demands/:id/reenviar-convite` | `GESTOR` | — | Renova 48h p/ `APROVADA` + re-notifica |
| `PATCH` | `/demands/:id/rejeitar` | `GESTOR` | `{motivoRejeicao ≥10}` | `PENDENTE→REJEITADA` + `notificarDemandaRejeitada` |
| `POST` | `/demands` | `VITIMA` | demanda autenticada | 409 se processo ativo |
| `GET` | `/demands/:id` | `authenticate + onlyOwnResource` | — | Decrypt + fallback local legado; nunca `motivoRejeicao` p/ vítima |

## 4. `/processes`

`authenticate` global.

| Método | Path | RBAC | Descrição |
|---|---|---|---|
| `POST` | `/processes` | `GESTOR` | Cria de demanda `APROVADA` com vítima; 409 se já tem |
| `GET` | `/processes?status=&vitimaId=&direcionadoPara=` | `GESTOR, PSI, ASSIST, JURID` | Sem `observacaoTriagem` |
| `GET` | `/processes/:id` | `onlyOwnResource` | VITIMA: DTO parcial; demais: completo decrypt |
| `GET` | `/processes/:id/historico` | `onlyOwnResource` | Histórico mínimo p/ vítima |
| `GET` | `/processes/:id/appointments` | `GESTOR + prof` | Profissional: `dono OU direcionadoPara==tipo` |
| `GET` | `/processes/:id/report` | `GESTOR + vinculados` | Janela do caso (sem `observacoes` das consultas) |
| `GET` | `/processes/:id/frida` | `GESTOR + vinculados` | FRIDA ou `{frida:null}`; VITIMA 403 |
| `PATCH` | `/processes/:id/triagem` | `GESTOR, PSI, ASSIST` | `ABERTO/EM_TRIAGEM→EM_TRIAGEM` (risco+prioridade+obs AES); profissional só com triagem própria |
| `PATCH` | `/processes/:id/encaminhar` | `GESTOR` | `→ENCAMINHADO`; XOR `{direcionadoPara}` interno / `{destinoExterno}` + `Encaminhamento` |
| `PATCH` | `/processes/:id/status` | `GESTOR` | Não-terminal → `ENCERRADO` + cancela `AGENDADA`s (transação + auditoria + notificações) |

## 5. `/appointments`

`authenticate` global. Criação só GESTOR.

| Método | Path | RBAC | Descrição |
|---|---|---|---|
| `POST` | `/appointments` | `GESTOR` | `{processoId, tipoProfissional, profissionalId, dataHora, dataHoraFim?, modalidade, linkMeet?, observacoes?}`; valida ativo, compatibilidade, 1 triagem ativa, 409 conflito |
| `GET` | `/appointments?de=&ate=&processoId=&profissionalId=` | `GESTOR, PSI, ASSIST, JURID` | Não-gestor: só próprio |
| `GET` | `/appointments/minhas/historico` | `VITIMA` | `REALIZADA/CANCELADA/FALTOU`, paginado, mínimo LGPD |
| `GET` | `/appointments/minhas` | `VITIMA` | `AGENDADA` futuras, sem `observacoes` |
| `GET` | `/appointments/:id` | `GESTOR + prof` | Dono ou gestor |
| `PATCH` | `/appointments/:id` | `GESTOR + dono` | Edita `AGENDADA` (`observacoes/linkMeet/modalidade/dataHoraFim`); valida 8h + reconflito; link novo notifica |
| `PATCH` | `/appointments/:id/status` | `GESTOR + dono` | `AGENDADA→REALIZADA/CANCELADA/FALTOU`, `REALIZADA→CANCELADA`; triagem move processo |
| `POST` | `/appointments/:id/confirmar` | `VITIMA, PSI, ASSIST, JURID` dono/vítima | Idempotente; duplo `CONFIRMADO` em `ONLINE` sem link → Meet auto |
| `POST` | `/appointments/:id/recusar` | idem | Motivo opcional → `CANCELADA` |
| `POST` | `/appointments/:id/relatorio` | autor `PSI, ASSIST, JURID` | 1/`REALIZADA`, AES, 10–10k chars, 409 duplicado |
| `GET` | `/appointments/:id/relatorio` | autor | Só autor (decrypt) |
| `PATCH` | `/appointments/:id/relatorio` | autor | Edição, log sem conteúdo |

## 6. `/frida-forms`

`authenticate` global.

| Método | Path | RBAC | Descrição |
|---|---|---|---|
| `POST` | `/frida-forms` | `GESTOR, PSI, ASSIST` | `{consultaId, respostas{version, answers, subanswers, assessment}, nivelRisco}`; só `TRIAGEM/PSICOLOGO AGENDADA/REALIZADA` própria; autor por perfil; 1/processo (409); `ABERTO→EM_TRIAGEM` + risco |
| `GET` | `/frida-forms/:id` | dono/GESTOR (checado dentro) | 403 resto |
| `PATCH` | `/frida-forms/:id` | `PSI, ASSIST, GESTOR` | Correção auditada; notifica se risco mudou |

## 7. `/referrals`, `/patients`, `/victims`, `/reports`, `/notifications`, `/google`, `/audits`, `/users`, `/dashboard`

| Método | Path | RBAC | Descrição |
|---|---|---|---|
| `POST` | `/referrals` | `GESTOR` | Externo avulso em `ENCAMINHADO` (`{processoId, destino, detalhes?}`) |
| `GET` | `/referrals?processoId=` | `GESTOR + prof` | Gestor tudo; profissional onde atua; VITIMA 403 |
| `GET` | `/patients?profissionalId=&page=&limit=` | `GESTOR + prof` | `{processoId, status, risco, vitima{nome, campus, curso, vinculo}, totalConsultas, ultimaConsulta}` |
| `GET` | `/victims?triage=&q=&risk=&area=&campus=&course=&bond=&from=&to=&sort=&page=&limit=` | `GESTOR` | Pacientes (com cadastro, mesmo sem processo); `total/counts/facets`; LGPD sem cpf/endereço/obs |
| `GET` | `/reports/meus?processoId=&de=&ate=` | `PSI, ASSIST, JURID` | Consolidado JSON só do autor (decrypt) |
| `GET` | `/reports/meus.pdf?...` | idem | Mesmo filtro, PDF (`attachment`) |
| `GET` | `/notifications?lida=&limit=&offset=` | `authenticate` | Só próprias + `{total, naoLidas}` |
| `PATCH` | `/notifications/:id/ler` | dono | Marca lida |
| `PATCH` | `/notifications/ler-todas` | `authenticate` | Marca todas do dono |
| `GET` | `/google/status` | `GESTOR` | Estado integração |
| `GET` | `/google/auth-url` | `GESTOR` | URL consentimento (`state` AES) |
| `GET` | `/google/callback` | pública (browser) | Troca code → tokens; redirect `?google=ok\|erro` |
| `DELETE` | `/google/desconectar` | `GESTOR` | Remove credencial |
| `GET` | `/audits?de=&ate=&entidade=&acao=&page=&limit=` | `GESTOR` | Logs desc paginado |
| `GET` | `/users?perfil=&q=&page=&limit=` | `GESTOR` | Sem `senhaHash` |
| `PATCH` | `/users/:id/ativo` | `GESTOR` | Ativa/desativa (bloqueia auto-desativar) |
| `GET` | `/dashboard/summary` | `GESTOR` | KPIs (demandas/processos, consultas semana, risco) |
| `GET` | `/dashboard/demandas?de=&ate=&campus=` | `GESTOR` | porStatus/Tipo/Vínculo/Campus/Local/Curso/Mês + `taxaConversao` |
| `GET` | `/dashboard/processos?...` | `GESTOR` | porStatus/Direcionado/Risco/Mês |
| `GET` | `/dashboard/consultas?...` | `GESTOR` | porStatus/Tipo/Mês |
| `GET` | `/dashboard/frida?...` | `GESTOR` | porNivelRisco |
| `GET` | `/dashboard/encaminhamentos?...` | `GESTOR` | porDestino/Mês |
| `GET` | `/dashboard/demografico?...` | `GESTOR` | `total, porSexo/Genero/Etnia/FaixaIdade` |

Códigos típicos: `401` sem token/inválido/inativo; `403` perfil/recurso; `404` inexistente; `409` duplicado/ativo/conflito; `410` convite/token expirado; `400/422` validação Zod; `429` rate-limit; `503` base não configurada (front).
