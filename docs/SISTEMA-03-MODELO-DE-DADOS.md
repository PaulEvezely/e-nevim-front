# NEVIM — Modelo de Dados

**Documento:** SISTEMA-03-MODELO-DE-DADOS
**Fonte:** `nevim-backend/prisma/schema.prisma` (PostgreSQL, `prisma-client-js`)

> Nomes de variáveis de ambiente citados sem valores. Nenhum `.env` foi lido.

---

## 1. Enums

### 1.1 Perfis e vínculos

| Enum | Valores | Uso |
|---|---|---|
| `PerfilUsuario` | `VITIMA, PSICOLOGO, ASSISTENTE_SOCIAL, ASSESSOR_JURIDICO, GESTOR` | `Usuario.perfil`. `ADMIN` existe só no front mock |
| `VinculoUespi` | `DISCENTE, DOCENTE, TECNICO_ADMINISTRATIVO` | `Vitima.vinculo` + snapshot na demanda |

### 1.2 Ciclo do caso

| Enum | Valores | Uso |
|---|---|---|
| `StatusDemanda` | `PENDENTE, APROVADA, REJEITADA` | `Demanda.status` (default `PENDENTE`) |
| `StatusProcesso` | `ABERTO, EM_TRIAGEM, ENCAMINHADO, ENCERRADO` | `Processo.status`. UI mapeia para Pendente/Ativo/Inativo/Encerrado via `StatusBadge` |
| `StatusConsulta` | `AGENDADA, REALIZADA, CANCELADA, FALTOU` | `Consulta.status` |
| `ConfirmacaoConsulta` | `PENDENTE, CONFIRMADO, RECUSADO` | Dupla confirmação: `confirmacaoProfissional/Vitima` |
| `TipoProfissional` | `TRIAGEM, PSICOLOGO, ASSISTENTE_SOCIAL, ASSESSOR_JURIDICO` | `Consulta.tipoProfissional`; triagem é tipo próprio, não perfil |
| `ModalidadeAtendimento` | `PRESENCIAL, ONLINE` | `Consulta.modalidade`; `ONLINE` + duplo `CONFIRMADO` sem link → Meet auto |
| `PrioridadeTriagem` | `BAIXA, MEDIA, ALTA` | `Processo.prioridadeTriagem` |
| `NivelRisco` | `BAIXO, MEDIO, ELEVADO` | `Processo.classificacaoRisco` + `FormularioFrida.nivelRisco` |
| `TipoDestinoEncaminhamento` | `DEFENSORIA, REDE_SAUDE, DELEGACIA, OUTRO` | `Encaminhamento.destino` (externo) |

### 1.3 Auditoria, tokens, notificações

| Enum | Valores |
|---|---|
| `AcaoAuditoria` | `CRIACAO, LEITURA, EDICAO, EXCLUSAO` |
| `TipoTokenAuth` | `VERIFICACAO_EMAIL, RESET_SENHA` (opacos, só `sha256` persistido) |
| `TipoNotificacao` | 17 valores: `NOVA_DEMANDA, CADASTRO_VITIMA, CONSULTA_AGENDADA, CONSULTA_CANCELADA, CONSULTA_CONFIRMADA, CONSULTA_CONFIRMADA_PARCIAL, CONSULTA_REALIZADA, CONSULTA_FALTA, LINK_MEET_DISPONIVEL, MEET_GERACAO_FALHOU, TRIAGEM_REGISTRADA, PROCESSO_ENCAMINHADO, PROCESSO_ENCERRADO, DEMANDA_REJEITADA, FRIDA_PREENCHIDO, FRIDA_ATUALIZADO` |

### 1.4 Dados sociodemográficos da vítima

| Enum | Valores |
|---|---|
| `EstadoCivil` | `SOLTEIRO, CASADO, UNIAO_ESTAVEL, VIUVO, DIVORCIADO, SEPARADO` |
| `Sexo` | `FEMININO, MASCULINO, NAO_INFORMADO` |
| `Genero` | `MULHER, CISGENDER, TRANSGENDER, NAO_BINARIO, NAO_INFORMADO` |
| `Etnia` | `BRANCA, PRETA, PARDA, AMARELA, INDIGENA, NAO_INFORMADO` |
| `Escolaridade` | 7 níveis de `FUNDAMENTAL_INCOMPLETO` a `POS_GRADUACAO` |

---

## 2. Models

### 2.1 `Usuario` (`usuarios`)

Identidade de login. `email@unique`, `senhaHash` (Argon2id), `perfil`, `ativo`, `emailVerificado`, `emailVerificadoEm`, `senhaAlteradaEm` (revoga JWTs com `iat` anterior), `criadoEm/atualizadoEm`.

Relações 1:1: `vitima, psicologo, assistenteSocial, assessorJuridico`; 1:1 `GoogleCredential`; 1:N `logsAuditoria, notificacoes`; 1:N `fridasComoGestor`.

### 2.2 Perfis vinculados (1:1 com `Usuario`)

- `Vitima` (`vitimas`, `usuarioId@unique`): `vinculo, campus, curso`, `cpfHash@unique` (HMAC-SHA256, blind index p/ busca/dedup) + `cpfCriptografado` (AES-256-CBC), `matricula, dataNascimento (@db.Date), estadoCivil, sexo, genero, etnia, escolaridade, cotista, endereco, cidade, cep, lgpdConsent`. Índices: `campus, curso, vinculo`. 1:N `demandas, processos`.
- `Psicologo` (`usuarioId@unique, crp@unique`) → 1:N `formulariosFrida`.
- `AssistenteSocial` (`usuarioId@unique, cress@unique`) → 1:N `formulariosFrida`.
- `AssessorJuridico` (`usuarioId@unique, oab@unique`) — sem FRIDA (só leitura vinculada).

### 2.3 `Demanda` (`demandas`)

Pedido de ajuda + snapshot do solicitante (permite demanda sem conta):

- Chaves: `vitimaId?` (quando autenticada/vinculada), `tipoViolencia, descricao` (AES), `status=PENDENTE`.
- Snapshot: `Nome/Email/Phone/Vinculo/Campus/Cidade/Curso`, `solicitanteLocalOcorrencia` (coluna filtrável, RF06) + `localOcorrenciaConfiavel` (`false` = parse legado via `extractLocalOcorrenciaLegado`), `emailVerificado`, `motivoRejeicao`.
- Relações: `processo?` (1:1), `convite?` (1:1).
- Índices: `[status, criadoEm], [solicitanteCampus, status], [criadoEm]`.

### 2.4 `ConviteCadastro` + `TokenAuth`

- `ConviteCadastro` (`demandaId@unique`): `tokenHash@unique, expiraEm` (48h), `usado`.
- `TokenAuth`: `tipo (VERIFICACAO_EMAIL/RESET_SENHA), email, tokenHash@unique, expiraEm` (24h/60min), `verificadoEm, usado`. Índices `[email, tipo], [expiraEm]`.

### 2.5 `Processo` (`processos`)

- `demandaId@unique, vitimaId`, `status=ABERTO`.
- Triagem: `prioridadeTriagem, classificacaoRisco, direcionadoPara` (encaminhamento **interno**), `observacaoTriagem` (AES), `triadoEm`, `abertoEm/encerradoEm`.
- **Regra "1 ativo por vítima":** índice parcial SQL na migration (não expressável no Prisma): impede 2 processos `ABERTO/EM_TRIAGEM/ENCAMINHADO` para a mesma vítima. Leitura otimista em `vitima.service.ts`.
- Índices: `[vitimaId], [status, abertoEm], [status, direcionadoPara]`.
- Relações 1:N: `consultas, encaminhamentos`.

### 2.6 `Consulta` (`consultas`)

- `processoId, tipoProfissional, profissionalId` (= `Usuario.id`, sem FK), `dataHora, dataHoraFim?` (`null` = legado, assume +30min), `status=AGENDADA, observacoes, linkMeet, modalidade`.
- Dupla confirmação: `confirmacaoProfissional/Vitima + confirmado*Em + motivoRecusa`.
- 1:1 `formularioFrida?, relatorio?`.
- Índices: `[processoId, dataHora], [profissionalId, dataHora(+Fim)]` (base do 409 de conflito `[start, end)`).

### 2.7 `FormularioFrida` (`formularios_frida`)

- `consultaId@unique` (1 por consulta), `psicologoId?/gestorId?/assistenteSocialId?` (autor por perfil), `respostas: Json` (`{version, answers, subanswers, assessment}`), `nivelRisco`.
- 1 FRIDA por **processo** (regra de aplicação + 409).

### 2.8 `RelatorioConsulta` (`relatorios_consulta`)

- `consultaId@unique, autorId` (sem FK), `conteudo` AES. Sigiloso: só autor lê (`GET/PATCH /appointments/:id/relatorio`).

### 2.9 `Encaminhamento` (`encaminhamentos`)

- `processoId, destino (DEFENSORIA/REDE_SAUDE/DELEGACIA/OUTRO), detalhes?`. Encaminhamento **externo** avulso (interno vai em `Processo.direcionadoPara`).

### 2.10 `Notificacao` (`notificacoes`)

- `usuarioId, tipo (17 valores), titulo, mensagem` (mínimo LGPD, sem sigilo), `lida/lidaEm, entidade/entidadeId, criadoEm`.
- Índice `[usuarioId, lida, criadoEm]`.

### 2.11 `GoogleCredential` + `LogAuditoria`

- `GoogleCredential` (`usuarioId@unique`, só GESTOR que autorizou): `accessTokenEnc/refreshTokenEnc` (AES), `expiraEm, escopo`.
- `LogAuditoria`: `usuarioId?, acao, entidade, entidadeId?, ip?, detalhes? (Json)`.

---

## 3. Diagrama entidade-relacionamento (textual)

```
Usuario 1──1 Vitima 1──N Demanda 1──1 Processo 1──N Consulta 1──1 FormularioFrida
              │              │           │                    └─1 RelatorioConsulta
              │              │           └─N Encaminhamento
              │              └─1 ConviteCadastro
              └─N Processo (direto, além de via demanda)
Usuario 1──1 Psicologo / AssistenteSocial / AssessorJuridico (perfis)
Usuario 1──N Notificacao | LogAuditoria | FormularioFrida (como gestor)
Usuario 1──1 GoogleCredential
TokenAuth (sem FK, por e-mail + hash opaco)
```

## 4. Regras de integridade implementadas fora do Prisma

1. **1 processo ativo/vítima** — índice parcial SQL (`ABERTO/EM_TRIAGEM/ENCAMINHADO`), checado em demandas e criação de processo (409).
2. **1 triagem ativa/processo** — `POST /appointments` rejeita 2ª `TRIAGEM AGENDADA` (409).
3. **1 FRIDA/processo** — `POST /frida-forms` 409 se já existe; `consultaId@unique`.
4. **1 relatório/consulta** — `POST /appointments/:id/relatorio` 409 se já existe; `consultaId@unique`.
5. **Conflito de agenda** — 409 em sobreposição `[start, end)` por `profissionalId` (legado +30min).
6. **Transições de status** — triagem `REALIZADA` avança `ABERTO→EM_TRIAGEM`; cancelar triagem reverte; `ENCERRADO` bloqueia triagem/encaminhar/agendar/FRIDA/confirmar/recusar; `ENCERRADO` cancela `AGENDADA`s em transação.
7. **Compatibilidade perfil×tipo** — `TRIAGEM` só em `ABERTO/EM_TRIAGEM`, demais só em `ENCAMINHADO`; jurídico não faz triagem (400); FRIDA só em `TRIAGEM/PSICOLOGO REALIZADA` própria.
