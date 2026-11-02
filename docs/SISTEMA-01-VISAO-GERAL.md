# NEVIM — Visão Geral do Sistema

**Documento:** SISTEMA-01-VISAO-GERAL
**Produto:** Sistema NEVIM — Núcleo de Enfrentamento à Violência contra a Mulher (UESPI)
**Base normativa:** `PRD-NEVIM.md` v1.2 (2026-09-09)
**Público-alvo:** desenvolvedores, gestores, psicólogos, assistentes sociais, assessores jurídicos e administradores

---

## 1. O que é o NEVIM

Plataforma web para automatizar e gerenciar o fluxo de atendimento do Núcleo de Proteção às Mulheres da UESPI, do registro inicial de uma demanda espontânea (feita pela própria vítima, sem login) até o encerramento do caso, passando por triagem, avaliação de risco (FRIDA), agendamentos, encaminhamentos e relatórios gerenciais.

### Objetivos (PRD §2)

1. Centralizar e organizar as demandas de atendimento psicossocial.
2. Acompanhar o ciclo de vida completo de cada caso.
3. Garantir segurança e privacidade das vítimas (saída rápida, consentimento LGPD, controle de acesso).
4. Facilitar gestão de agendas e encaminhamentos.
5. Fornecer indicadores e relatórios para tomada de decisão.

### Escopo

**No escopo (PRD §3.1):**

- Cadastro e autenticação (vítima, psicólogo, assistente social, assessor jurídico, gestor, administrador).
- Registro de demandas espontâneas.
- Análise pelo gestor e criação de processos.
- Agendamento e gerenciamento de consultas (triagem + acompanhamento).
- Formulário FRIDA + classificação de risco.
- Registro de encaminhamentos internos e externos.
- Dashboards e exportação de dados.
- Interfaces responsivas e acessíveis.

**Fora de escopo (PRD §3.2):**

- App móvel nativo (apenas web).
- Criação de conteúdo jurídico/psicológico.
- Integrações externas além do contrato de API (exceto Google Meet/OAuth para reuniões e SMTP/WhatsApp para notificações, já implementados no backend).

---

## 2. Atores e perfis

| Ator (PRD) | `PerfilUsuario` (Prisma) | Rota front (`role`) | Responsabilidades |
|---|---|---|---|
| Vítima | `VITIMA` | `user` (`/user/*`) | Registra demanda, completa cadastro via convite, visualiza jornada/processo/consultas, confirma/recusa consultas, botão de pânico |
| Gestor | `GESTOR` | `manager` (`/manager/*`) | Analisa demandas, aprova/rejeita, agenda triagem e consultas, registra triagem, preenche/corrige FRIDA, encaminha, encerra, gerencia profissionais, vê dashboards |
| Psicólogo | `PSICOLOGO` | `professional` (`/professional/*`) | Triagem (quando designado), atendimentos, FRIDA, relatórios sigilosos de consulta |
| Assistente Social | `ASSISTENTE_SOCIAL` | `professional` | Atendimentos, triagem (quando designado), FRIDA em triagem, relatórios |
| Assessor Jurídico | `ASSESSOR_JURIDICO` | `professional` | Atendimentos jurídicos, relatórios; FRIDA somente leitura |
| Administrador | (front-only, sem model dedicado) | `admin` (`/admin/*`) | Painel mock client-side de gestão de usuários (sem API no MVP) |

Mapeamento front (`features/auth/mapPerfil.ts`):

- `VITIMA → user`, `GESTOR → manager`, `ADMIN → admin`, `PSICOLOGO/ASSISTENTE_SOCIAL/ASSESSOR_JURIDICO → professional` (+ `speciality`).

---

## 3. Conceitos centrais

| Termo | Definição | Onde vive |
|---|---|---|
| **Demanda** | Pedido inicial de ajuda. Pode ser espontâneo (sem login, `POST /demands/public`) ou autenticado (`POST /demands`). Status: `PENDENTE → APROVADA / REJEITADA` | `Demanda` (Prisma), `/demanda`, `/manager/demandas` |
| **Convite de cadastro** | Token opaco de 48h enviado por e-mail/WhatsApp após aprovação. Vítima completa cadastro em `/register/:token` | `ConviteCadastro`, `GET /auth/invite/:token/validate`, `POST /auth/register/:token` |
| **Processo** | Caso vinculado a uma vítima + demanda + consultas. Status backend: `ABERTO → EM_TRIAGEM → ENCAMINHADO → ENCERRADO` (PRD usa rótulos Pendente/Ativo/Inativo/Encerrado na UI via `StatusBadge`) | `Processo`, `/manager/processos/:id`, `/user/process` |
| **Consulta** | Atendimento agendado. Tipos: `TRIAGEM, PSICOLOGO, ASSISTENTE_SOCIAL, ASSESSOR_JURIDICO`. Status: `AGENDADA, REALIZADA, CANCELADA, FALTOU`. Modalidade `PRESENCIAL/ONLINE` + confirmação dupla | `Consulta`, `/manager/consultas`, `/professional/appointments`, `/user/consultas` |
| **FRIDA** | Formulário de Avaliação de Risco, 19 perguntas + avaliação estruturada. 1 por processo. Risco `BAIXO/MEDIO/ELEVADO` | `FormularioFrida`, `/frida-forms`, `/manager|professional/frida/:consultaId` |
| **Encaminhamento** | Interno (`Processo.direcionadoPara`) XOR externo (`Encaminhamento`: `DEFENSORIA/REDE_SAUDE/DELEGACIA/OUTRO`) | `PATCH /processes/:id/encaminhar`, `POST /referrals` |
| **Notificação** | Evento in-app + e-mail best-effort (17 tipos). Polling 60s no front | `Notificacao`, `/notifications`, `NotificationProvider` |
| **Relatório de consulta** | Texto sigiloso por consulta, só o autor lê (AES) + consolidado JSON/PDF por autor | `RelatorioConsulta`, `/appointments/:id/relatorio`, `/reports/meus(.pdf)` |

---

## 4. Jornada ponta a ponta (resumo)

```
01 Vítima registra demanda espontânea (/demanda, sem login)
02 Sistema cria Demanda PENDENTE + ConviteCadastro 48h, notifica gestores (NOVA_DEMANDA)
03 Gestor analisa fila (/manager/demandas) → APROVA (reenvia convite) ou REJEITA (com motivo ≥10 chars)
04 Vítima recebe link e completa cadastro (/register/:token) → cria Usuario+Vítima, Demanda APROVADA, Processo ABERTO
05 Gestor agenda triagem (TRIAGEM) → notifica vítima + profissional (CONSULTA_AGENDADA)
06 Dupla confirmação (vítima + profissional) → se ONLINE + duplo CONFIRMADO sem link, gera Google Meet automaticamente
07 Profissional realiza triagem → gestor/profissional registra triagem (risco + prioridade + direcionadoPara)
08 FRIDA preenchido na 1ª consulta REALIZADA (1/processo) → sincroniza risco do processo
09 Acompanhamentos agendados (PSICOLOGO/ASSISTENTE_SOCIAL/ASSESSOR_JURIDICO) + relatórios sigilosos
10 Encaminhamento interno ou externo (opcional, após triagem)
11 Encerramento pelo gestor → cancela AGENDADAs futuras + notifica partes
12 Dashboards gerenciais (GESTOR) + exportação CSV
```

Detalhamento completo em `SISTEMA-07-FLUXOS-DE-NEGOCIO.md`.

---

## 5. Requisitos funcionais (RF01–RF23, PRD §7)

| Código | Descrição | Prioridade |
|---|---|---|
| RF01 | Cadastrar/autenticar psicólogo, admin, gestor, vítima (e-mail + senha) | Alta |
| RF02 | Permissões por tipo de usuário | Alta |
| RF03 | Vítima registra demanda (nome, cidade, local, vínculo, campus, tipo violência, descrição, telefone, e-mail) | Alta |
| RF04 | Envio automático da demanda ao gestor | Alta |
| RF05 | Gestor aceita (dá andamento) ao processo | Alta |
| RF06 | Alerta automático se agressão dentro do campus | Alta |
| RF07 | Cálculo de horários de triagem (disponibilidade + horário serviço) | Alta |
| RF08 | Profissional visualiza sua agenda | Média |
| RF09 | Criação de processo vinculando vítima a atendimentos | Alta |
| RF10 | Link de reunião remota por consulta | Alta |
| RF11 | FRIDA para gestor + psicólogo (Sim/Não/Não sabe/Não se aplica) | Alta |
| RF12 | Classificação de risco (baixo/médio/elevado) | Alta |
| RF13 | Visualização de status do processo | Alta |
| RF14 | Registro de encaminhamentos | Alta |
| RF15 | Mapeamento/consolidação estatística | Média |
| RF16 | Notificações de consultas próximas | Média |
| RF17 | Botão de redirecionamento rápido (pânico) | Alta |
| RF18 | Link de cadastro via e-mail/WhatsApp | Alta |
| RF19 | Encaminhamentos como tarefa opcional | Alta |
| RF20 | Relatórios e painéis de indicadores | Média |
| RF21 | Agendamento com diferentes profissionais no mesmo processo | Alta |
| RF22 | Reagendamento/cancelamento com notificação | Alta |
| RF23 | Exportação PDF/Excel via dashboards | Média |

## 6. Requisitos de front-end (RFF01–RFF18, PRD §9)

| Código | Descrição | Prioridade |
|---|---|---|
| RFF01 | Navegação por perfil + redirect em acesso indevido | Alta |
| RFF02 | Demanda em stepper, com volta sem perder dados | Alta |
| RFF03 | Validação client por campo, mensagens específicas | Alta |
| RFF04 | Saída rápida fixa na área da vítima, sem confirmação | Alta |
| RFF05 | Fila do gestor priorizada por risco, destaque elevado | Alta |
| RFF06 | Painel do profissional só com seus atendimentos | Alta |
| RFF07 | FRIDA para gestor + psicólogo | Alta |
| RFF08 | Busca/filtro de processos sem reload | Média |
| RFF09 | Status com componente padronizado (cor + ícone) | Alta |
| RFF10 | Modal de confirmação antes de ações críticas | Alta |
| RFF11 | Skeleton/spinner em requisições perceptíveis | Média |
| RFF12 | Toast após cada escrita | Alta |
| RFF13 | Upload drag-and-drop com validação | Baixa |
| RFF14 | Dashboards com filtro período/campus, gráficos dinâmicos | Média |
| RFF15 | Exportação PDF/planilha na UI | Baixa |
| RFF16 | Termo LGPD antes de concluir cadastro, aceite explícito | Alta |
| RFF17 | Erro amigável + retry, sem detalhe técnico | Alta |
| RFF18 | Sessão persistente entre reloads | Alta |

---

## 7. Paleta de cores (PRD §10)

Base neutra: `50 #E6F1FB` (fundo/badge), `400 #378ADD` (primário/links), `800 #0C447C` (hover/texto).
Status: Pendente `#FAEEDA/#854F0B`, Ativo `#E6F1FB/#0C447C`, Inativo `#F1EFE8/#5F5E5A`, Encerrado `#EAF3DE/#27500A`.
Risco: Baixo `#EAF3DE/#27500A`, Médio `#FAEEDA/#854F0B`, Elevado `#FCEBEB/#791F1F`.
Implementação: `shared/components/StatusBadge.tsx` (cores inline) + `features/manager/components/chartTheme.ts`.

## 8. Documentos relacionados nesta pasta

- `SISTEMA-00-INDICE.md` — índice navegável.
- `SISTEMA-02-ARQUITETURA.md` — monorepo, SSR, comunicação front↔back.
- `SISTEMA-03-MODELO-DE-DADOS.md` — Prisma models/enums.
- `SISTEMA-04-BACKEND.md` — rotas, middlewares, serviços, testes, scripts.
- `SISTEMA-05-FRONTEND.md` — rotas, guards, features, shared.
- `SISTEMA-06-API-REFERENCE.md` — endpoints método a método.
- `SISTEMA-07-FLUXOS-DE-NEGOCIO.md` — fluxos e regras.
- `SISTEMA-08-AUTENTICACAO-E-SEGURANCA.md` — JWT, RBAC, LGPD, rate-limit.
- `SISTEMA-09-FRIDA.md` — perguntas, scoring, permissões, PDF.
- `SISTEMA-10-NOTIFICACOES.md` — tipos, polling, lembretes.
- `SISTEMA-11-DASHBOARDS-E-RELATORIOS.md` — endpoints, gráficos, CSV.
- `SISTEMA-12-GUIA-DESENVOLVIMENTO.md` — setup, scripts, convenções.

> Nota: nomes de variáveis de ambiente são citados sem valores. Nenhum arquivo `.env` foi lido para produzir esta documentação.
