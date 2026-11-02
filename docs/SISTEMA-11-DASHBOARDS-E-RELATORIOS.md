# NEVIM — Dashboards e Relatórios

**Documento:** SISTEMA-11-DASHBOARDS-E-RELATORIOS
**Backend:** `dashboard.routes.ts` (`/dashboard`), `reports.routes.ts` (`/reports`), `relatorio-pdf.service.ts`
**Front:** `app/routes/manager/dashboards.tsx`, `features/manager/dashboardApi.server.ts|dashboardUtils.ts|exportUtils.ts`, `features/manager/components/Dashboard*|Grafico*|KpiRow|FiltroPeriodo|ExportButton*`
**Referências:** `DASHBOARDS_CONCEITO.md`, `DASHBOARDS_IMPLEMENTACAO.md` (conceito *Storytelling with Data*, 7 blocos; CSV MVP, PDF/XLSX adiados no front)

---

## 1. Dashboards gerenciais (só `GESTOR`)

Todos com `?de=&ate=` (ISO) + `?campus=` (case-insensitive; demandas via solicitante/vítima, resto via vítima). Agregações `groupBy` + `$queryRaw` (`date_trunc` mês, `COALESCE` curso, `AGE` idade).

| Endpoint | Retorna |
|---|---|
| `GET /dashboard/summary` | KPIs: demandas/processos por status, consultas semana (seg–dom), risco triagem+frida |
| `GET /dashboard/demandas` | porStatus/Tipo/Vínculo/Campus/Local/Curso (`COALESCE solicitanteCurso/vitima`)/Mês + `taxaConversao` |
| `GET /dashboard/processos` | porStatus/Direcionado (`SEM_DESTINO` p/ null)/Risco/Mês |
| `GET /dashboard/consultas` | porStatus/Tipo/Mês |
| `GET /dashboard/frida` | porNivelRisco |
| `GET /dashboard/encaminhamentos` | porDestino/Mês |
| `GET /dashboard/demografico` | `total, porSexo/Genero/Etnia/FaixaIdade` (0–17…60+; null→`NAO_INFORMADO`/`SEM_IDADE`), base `Processo→Vitima` |

Testes: `dashboard-agregacoes.test.ts` (multi-mês, `COALESCE`, `SEM_IDADE/SEM_DESTINO`, janelas), `dashboard-campus.test.ts` (filtro em todos endpoints, case-insensitive, 403, limite 120), `dashboard-demografico.test.ts` (nulos, janela, 403/400).

### Front (`/manager/dashboards`)

- `loader`: `parseDashboardPeriod → dashboardApi.getAll` (paralelo: `getSummary/getAll + buildPeriodQuery(?de&ate&campus)`).
- Layout: `DashboardLayout + KpiRow (KpiCard) + ChartCard + GraficoBarras/Donut/Linha/Horizontal + FiltroPeriodo + ExportButton CSV + DashboardSkeleton/ErrorState` (RFF11/RFF14).
- Cores: `chartTheme.ts` + paleta PRD; a11y `prefers-reduced-motion`, contraste, ARIA (fase E do plano).
- Exportação (RFF15 parcial): `exportUtils.ts` CSV nativo com BOM + `;` por bloco e global (`ExportButton`); sem PDF/XLSX nativo no MVP (RF23 parcial no front).
- Utils: `dashboardUtils.ts` (`DashboardPeriod`, `DashboardData` summary/demandas/processos/consultas/demográfico/FRIDA/encaminhamentos, `toChartData/toMonthlySeries`); gráficos `recharts` + `date-fns`.
- Benchmark: `scripts/benchmark-dashboard.ts` (seeda N vítimas + mede `GET /dashboard/*`; padrão 2000/5) + `limpar-benchmark.ts`.

## 2. Relatórios de consulta (sigilosos, por autor)

| Método | Path | RBAC | Descrição |
|---|---|---|---|
| `POST` | `/appointments/:id/relatorio` | autor `PSI, ASSIST, JURID` | 1/`REALIZADA`, AES, 10–10k chars, 409 duplicado |
| `GET` | `/appointments/:id/relatorio` | autor | Só autor lê (decrypt) |
| `PATCH` | `/appointments/:id/relatorio` | autor | Edição, log sem conteúdo |
| `GET` | `/reports/meus?processoId=&de=&ate=` | `PSI, ASSIST, JURID` | Consolidado JSON só do autor (decrypt) |
| `GET` | `/reports/meus.pdf?...` | idem | Mesmo filtro, `gerarRelatoriosPdf` (pdfkit), `attachment` |

Teste `relatorios.test.ts` (CRUD autor, AES, 409, 400 se não `REALIZADA`, sigilo, JSON/PDF `%PDF`). Front: `relatorioApi.server.ts` (`get/create/updateRelatorio`), dossiê em `/professional/appointments/:id` e `/manager/consultas/:id` (gestor vê metadados, não conteúdo alheio).

## 3. Dossiê do processo (`GET /processes/:id/report`, GESTOR + vinculados)

Janela do caso: processo + vítima + demanda (decrypt) + consultas (sem `observacoes`) + FRIDAs + encaminhamentos + histórico. Base da tela `/manager/processos/:id` (`processReportApi.getProcessReport/encerrar/encaminharExterno`).
