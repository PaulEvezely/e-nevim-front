import {
  type RouteConfig,
  route,
  index,
  layout,
  prefix,
} from "@react-router/dev/routes";

export default [
  index("routes/public/home.tsx"),

  route("api/notifications", "routes/api/notifications.tsx"),
  route("api/reminders", "routes/api/reminders.tsx"),
  route("api/process-search", "routes/api/process-search.tsx"),

  layout("routes/public/PublicLayout.tsx", [
    route("demanda", "routes/public/demand.tsx"),
    route("demanda/confirmacao", "routes/public/demand-confirmation.tsx"),
    route("verificar-email", "routes/public/verify-email.tsx"),
    route("recuperar-senha", "routes/public/recover-password.tsx"),
    route("redefinir-senha", "routes/public/reset-password.tsx"),
    route("login", "routes/public/login.tsx"),
    route("logout", "routes/public/logout.tsx"),
    route("403", "routes/public/403.tsx"),
    route("register/:token", "routes/public/register.tsx"),
    route("terms", "routes/public/terms.tsx"),
  ]),

  ...prefix("user", [
    layout("routes/user/layout.tsx", [
      index("routes/user/painel.tsx"),
      route("process", "routes/user/process.tsx"),
      route("consultas", "routes/user/consultas.tsx"),
      route("notificacoes", "routes/user/notificacoes.tsx"),
      // route("dados", "routes/vitima/dados.tsx"),
    ]),
  ]),

  ...prefix("manager", [
    layout("routes/manager/layout.tsx", [
      index("routes/manager/painel.tsx"),
      route("demandas", "routes/manager/demandas.tsx"),
      route("demandas/:id", "routes/manager/demanda-detalhe.tsx"),
      route("cadastro", "routes/manager/cadastro.tsx"),
      route("pacientes", "routes/manager/pacientes.tsx"),
      route("processos/:id", "routes/manager/processo-detalhe.tsx"),
      route("consultas", "routes/manager/consultas.tsx"),
      route("consultas/:id", "routes/manager/consulta-detalhe.tsx"),
      route("notificacoes", "routes/manager/notificacoes.tsx"),
      route("minhas-triagens", "routes/manager/minhas-triagens.tsx"),
      route("frida/:consultaId", "routes/manager/frida.tsx"),
      route("dashboards", "routes/manager/dashboards.tsx"),
    ]),
  ]),

  ...prefix("professional", [
    layout("routes/professional/layout.tsx", [
      index("routes/professional/painel.tsx"),
      route("appointments", "routes/professional/appointments.tsx"),
      route("appointments/:id", "routes/professional/appointment-detail.tsx"),
      route("notificacoes", "routes/professional/notificacoes.tsx"),
      route("frida/:consultaId", "routes/professional/frida.tsx"),
    ]),
  ]),

  ...prefix("admin", [
    layout("routes/admin/layout.tsx", [
      index("routes/admin/painel.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
