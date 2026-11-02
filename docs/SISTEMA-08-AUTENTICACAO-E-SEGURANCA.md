# NEVIM — Autenticação e Segurança

**Documento:** SISTEMA-08-AUTENTICACAO-E-SEGURANCA
**Arquivos-chave:** `features/auth/*`, `libs/api.server.ts`, `nevim-backend/src/middlewares/*`, `src/utils/crypto.ts|hash.ts`, `src/services/token.service.ts`

> Nenhum `.env` foi lido. Variáveis citadas apenas pelo nome.

---

## 1. Sessão front (RFF18)

- Cookie `__nevim_session` (`features/auth/cookie.server.ts`): `createCookieSessionStorage`, `httpOnly, sameSite lax, 8h, secure` em prod, `secrets [SESSION_SECRET]`. `get/commit/destroySession`.
- JWT decodificado em `require-user.server.ts` (`jwt.verify` com `JWT_SECRET`): `PayloadToken {sub, email, profile/perfil, name/nome}`.
- `requireUser(request, [roles])`: sem token/inválido/sem `sub/email/profile` → redirect `/login` (destrói cookie); papel errado → redirect `ROLE_HOME[role]`. `getOptionalUser` null-safe p/ `root.tsx` e proxies `/api/*`.
- `mapPerfil.ts` + `roleHome.ts`: `VITIMA→user (/user)`, `GESTOR→manager (/manager)`, `ADMIN→admin (/admin)`, `PSICOLOGO/ASSISTENTE_SOCIAL/ASSESSOR_JURIDICO→professional (/professional)` (+ `speciality`).

## 2. Login e senhas

- `POST /auth/login` + `loginLimiter` (IP+e-mail): Argon2id (`hash.ts`, 19MB, t=2) → JWT `{sub, email, profile}`.
- Troca: `PATCH /auth/me/password` (exige atual; **não** revoga sessão atual). Reset: `POST /auth/forgot-password` (sempre 202, cooldown) → `POST /auth/reset-password` (consome token, grava `senhaAlteradaEm` → **revoga JWTs** com `iat` anterior, `invalidarCacheConta`, invalida demais resets).
- Cadastro profissional: `POST /auth/register-professional` (só `GESTOR`), CRP/CRESS/OAB únicos.

## 3. RBAC

- Backend: `authenticate` global na maioria dos routers + `allowProfiles(...)` por rota + `onlyOwnResource` p/ vítima (`GET demands/:id, processes/:id(+historico)`). Matriz completa em SISTEMA-06; negativos cobertos em `tests/rbac.test.ts` (401 sem token, vítima 403 agenda/pacientes/referrals, jurídico fora FRIDA/triagem).
- Front: guards por `layout` + `ROLE_HOME`; `ProfessionalSidebar/ManagerSidebar/UserSidebar` e `AppHeader` exibem só o permitido (RFF01/RFF06).

## 4. Convites e tokens opacos

- `ConviteCadastro`: `tokenHash@unique` (só sha256 persistido), 48h, `usado`. `GET /auth/invite/:token/validate` + `POST /auth/register/:token` (transação cria usuário+vítima+processo).
- `TokenAuth` (`VERIFICACAO_EMAIL` 24h / `RESET_SENHA` 60min): `criarTokenAuth` invalida anteriores; `validarTokenAuth` checa hash+tipo+uso+expiração; `resetRecente/cooldown` anti-spam. Demanda pública exige token de e-mail verificado (salvo flag `REQUIRE_EMAIL_VERIFICATION=false`).

## 5. Criptografia e LGPD

| Dado | Proteção |
|---|---|
| Senhas | Argon2id (`hash.ts`) |
| `Demanda.descricao`, `Processo.observacaoTriagem`, `RelatorioConsulta.conteudo`, tokens Google | AES-256-CBC `encrypt/decrypt` (`iv:conteudo` hex, chave 32B, `crypto.ts`) |
| CPF | `cpfHash` HMAC-SHA256 (blind index, busca/dedup) + `cpfCriptografado` AES; descriptografado só p/ dona em `GET /auth/me` |
| Tokens/convites | Opaques; só `sha256` no banco (`hashToken`, `generateSecureToken/InviteToken`) |
| E-mails | `normalizarEmail`; respostas sempre genéricas (202) p/ não enumerar contas |
| Notificações | Título/mensagem mínimos, sem sigilo clínico |
| Relatórios | Só autor lê (`GET/PATCH /appointments/:id/relatorio`); consolidado/PDF filtram por autor |
| Vítima (listas) | `GET /victims`, `GET /patients`, `GET /demands` (vítima) e `/minhas*` omitem cpf/endereço/obs/motivo; `GET /processes/:id` vítima recebe DTO parcial |
| Consentimento | `lgpdConsent` obrigatório na demanda (`demand.tsx` termo 7 seções) e no cadastro (RFF16); e-mail `readOnly` no convite |
| Auditoria | `LogAuditoria {usuarioId?, acao, entidade, entidadeId?, ip?, detalhes?}`; leitura de `/audits` não gera log |

## 6. Rate-limit, CORS, headers

- Rate-limit por rota (`middlewares/rateLimit.ts`, `express-rate-limit`): `loginLimiter` (`RATE_LIMIT_WINDOW_MS` 15min, `RATE_LIMIT_LOGIN_MAX` 20, chave IP+e-mail, `ipKeyGenerator` IPv6), `emailLimiter` (`RATE_LIMIT_EMAIL_MAX` 10/IP), `resetLimiter` (`RATE_LIMIT_RESET_MAX` 10). Teste: 5 passam, 6ª → 429 (`rate-limit.test.ts`); smoke helmet + login (`smoke-seguranca.ts`).
- CORS (`app.ts`): `CORS_ORIGIN` csv, permite sem `Origin`, `credentials:true`; inválida → 403.
- `helmet()`, `trust proxy=1`, `express.json()`, error handler (400 JSON malformado, 403 CORS, 500 resto).

## 7. Segurança da vítima (RFF04)

- `EmergencyExitButton` fixo na área da vítima: overlay `DecoyClima` (clima falso) + `Esc`, `replaceState /` + troca title, limpa drafts (`onExit`); fallback redirect Google. `DecoyClima.tsx` + `EmergencyExitButton.tsx`.
- Validação amigável sem detalhe técnico (RFF17): `parseApiError/toFriendlyMessage` + `Toast` + retry; `process-search` nunca vaza stack; `ErrorBoundary` pt-BR.
- Confirmação explícita antes de encerrar/desativar/excluir (`ConfirmModal`, RFF10); motivo obrigatório na rejeição.

## 8. Auditoria (`/audits`, GESTOR)

- `GET /audits?de=&ate=&entidade=&acao=&page=&limit=` — logs desc paginado com usuário. Cobertura: encerramento com auditoria por consulta cancelada (`encerrar-processo-cancelamento.test.ts`), correção FRIDA auditada.
