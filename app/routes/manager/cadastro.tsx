import { useEffect, useState } from "react";
import {
  data,
  Form,
  Link,
  useFetcher,
  useRevalidator,
} from "react-router";
import type { Route } from "./+types/cadastro";
import { requireUser } from "../../../features/auth/require-user.server";
import { ApiError } from "../../../libs/api.server";
import {
  createProfessional,
  listProfessionals,
  mapCreateFieldError,
  toggleProfessionalActive,
} from "../../../features/manager/professionalsApi.server";
import {
  EMPTY_PROFESSIONAL_FORM,
  getProfessionalProfileLabel,
  getRegistroLabel,
  parseProfessionalFilters,
  parseProfessionalPage,
  PROFESSIONAL_PROFILE_LABELS,
  PROFESSIONAL_PROFILES,
  PROFESSIONALS_PER_PAGE,
  toCreateProfessionalInput,
  validateProfessionalForm,
  type ManagedProfessional,
  type ProfessionalActionData,
  type ProfessionalCounts,
  type ProfessionalFilters as ProfessionalFilterValues,
  type ProfessionalFormData,
  type ProfessionalProfile,
  type ProfessionalProfileFilter,
} from "../../../features/manager/professionalsUtils";
import { Pagination } from "../../../shared/components/Pagination";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { SkeletonCard } from "../../../shared/components/LoadingOverlay";
import { Toast } from "../../../shared/components/Toast";
import { useToast } from "../../../shared/hooks/useToast";
import { formatDate } from "../../../shared/utils/date";

type CadastroLoaderData = {
  professionals: ManagedProfessional[];
  page: number;
  totalPages: number;
  total: number;
  counts: ProfessionalCounts;
  filters: ProfessionalFilterValues;
  loadError: string | null;
};

const EMPTY_COUNTS: ProfessionalCounts = {
  ALL: 0,
  PSICOLOGO: 0,
  ASSISTENTE_SOCIAL: 0,
  ASSESSOR_JURIDICO: 0,
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["manager"]);
  const url = new URL(request.url);
  const filters = parseProfessionalFilters(url.searchParams);
  const requestedPage = parseProfessionalPage(url.searchParams);
  try {
    const result = await listProfessionals(
      request,
      filters,
      requestedPage,
      PROFESSIONALS_PER_PAGE,
    );
    const counts: ProfessionalCounts = {
      ...EMPTY_COUNTS,
      ...result.counts,
      ALL:
        result.counts.PSICOLOGO +
        result.counts.ASSISTENTE_SOCIAL +
        result.counts.ASSESSOR_JURIDICO,
    };
    const page = Math.min(
      Math.max(1, result.page),
      Math.max(1, result.totalPages),
    );
    return {
      professionals: result.professionals,
      page,
      totalPages: Math.max(1, result.totalPages),
      total: result.total,
      counts,
      filters,
      loadError: null,
    } satisfies CadastroLoaderData;
  } catch {
    return {
      professionals: [],
      page: 1,
      totalPages: 1,
      total: 0,
      counts: EMPTY_COUNTS,
      filters,
      loadError:
        "Não foi possível carregar os profissionais. Tente novamente em instantes.",
    } satisfies CadastroLoaderData;
  }
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request, ["manager"]);
  const form = await request.formData().catch(() => null);
  if (!form) {
    return data<ProfessionalActionData>(
      { error: "Não foi possível concluir a ação." },
      { status: 400 },
    );
  }
  const intent = String(form.get("intent") ?? "");

  if (intent === "cadastrar") {
    const formData: ProfessionalFormData = {
      nome: String(form.get("nome") ?? ""),
      email: String(form.get("email") ?? ""),
      perfil: String(form.get("perfil") ?? "") as ProfessionalFormData["perfil"],
      registro: String(form.get("registro") ?? ""),
      senha: String(form.get("senha") ?? ""),
      confirmarSenha: String(form.get("confirmarSenha") ?? ""),
    };
    const validationErrors = validateProfessionalForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      return data<ProfessionalActionData>(
        {
          error: "Corrija os campos destacados antes de enviar.",
          fieldErrors: validationErrors as Record<string, string>,
        },
        { status: 400 },
      );
    }
    const input = toCreateProfessionalInput(formData);
    if (!input) {
      return data<ProfessionalActionData>(
        { error: "Dados inválidos. Revise o formulário." },
        { status: 400 },
      );
    }
    try {
      const created = await createProfessional(request, input);
      return data<ProfessionalActionData>(
        {
          ok: true,
          action: "cadastrar",
          id: created.id,
          nome: created.nome,
          email: created.email,
          notificationStatus: created.notificationStatus ?? null,
        },
        { status: 201 },
      );
    } catch (err) {
      const fieldErrors = mapCreateFieldError(err);
      if (Object.keys(fieldErrors).length > 0) {
        return data<ProfessionalActionData>(
          {
            error: "Corrija os campos destacados antes de enviar.",
            fieldErrors,
          },
          { status: err instanceof ApiError ? err.status : 409 },
        );
      }
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : "Não foi possível cadastrar o profissional. Tente novamente em instantes.";
      const status =
        err instanceof ApiError && err.status >= 400 && err.status < 600
          ? err.status
          : 500;
      return data<ProfessionalActionData>({ error: message }, { status });
    }
  }

  if (intent === "ativo") {
    const id = String(form.get("id") ?? "");
    const ativo = String(form.get("ativo") ?? "") === "true";
    if (!id) {
      return data<ProfessionalActionData>(
        { error: "Profissional inválido." },
        { status: 400 },
      );
    }
    try {
      const updated = await toggleProfessionalActive(request, id, ativo);
      return data<ProfessionalActionData>({
        ok: true,
        action: "ativo",
        id: updated.id,
        ativo: updated.ativo,
      });
    } catch (err) {
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : "Não foi possível atualizar o profissional. Tente novamente em instantes.";
      const status =
        err instanceof ApiError && err.status >= 400 && err.status < 600
          ? err.status
          : 500;
      return data<ProfessionalActionData>({ error: message }, { status });
    }
  }

  return data<ProfessionalActionData>(
    { error: "Ação inválida." },
    { status: 400 },
  );
}

const PROFILE_OPTIONS: { value: ProfessionalProfileFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "PSICOLOGO", label: PROFESSIONAL_PROFILE_LABELS.PSICOLOGO },
  {
    value: "ASSISTENTE_SOCIAL",
    label: PROFESSIONAL_PROFILE_LABELS.ASSISTENTE_SOCIAL,
  },
  {
    value: "ASSESSOR_JURIDICO",
    label: PROFESSIONAL_PROFILE_LABELS.ASSESSOR_JURIDICO,
  },
];

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30";
const inputErrorClass =
  "w-full rounded-xl border border-red-400 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";

function buildPerfilHref(
  filters: ProfessionalFilterValues,
  perfil: ProfessionalProfileFilter,
): string {
  const params = new URLSearchParams();
  if (perfil !== "ALL") params.set("perfil", perfil);
  if (filters.search) params.set("q", filters.search);
  const query = params.toString();
  return query ? `/manager/cadastro?${query}` : "/manager/cadastro";
}

type CreatedCredentials = {
  nome: string;
  email: string;
  senha: string;
  notificationStatus: string | null;
};

function ProfessionalRow({
  professional,
  busy,
  onToggle,
}: {
  professional: ManagedProfessional;
  busy: boolean;
  onToggle: (professional: ManagedProfessional, ativo: boolean) => void;
}) {
  return (
    <tr className="border-t border-stone-200 first:border-t-0">
      <td className="px-3 py-3 align-top">
        <span className="block max-w-52 truncate text-xs font-medium text-gray-800">
          {professional.nome?.trim() || "—"}
        </span>
        <span className="block max-w-52 truncate text-[11px] text-gray-500">
          {professional.email?.trim() || ""}
        </span>
      </td>
      <td className="px-3 py-3 align-top text-xs text-gray-700">
        {getProfessionalProfileLabel(professional.perfil)}
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap text-xs font-mono text-gray-600">
        {professional.registro?.trim() || "—"}
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap">
        <StatusBadge status={professional.ativo ? "Ativo" : "Inativo"} />
      </td>
      <td className="px-3 py-3 align-top text-right whitespace-nowrap">
        {professional.ativo ? (
          <button
            type="button"
            onClick={() => onToggle(professional, false)}
            disabled={busy}
            className="inline-block rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#791F1F] transition-colors hover:bg-[#FCEBEB] disabled:opacity-50"
          >
            Desativar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggle(professional, true)}
            disabled={busy}
            className="inline-block rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0C447C] transition-colors hover:bg-[#E6F1FB] disabled:opacity-50"
          >
            Reativar
          </button>
        )}
      </td>
    </tr>
  );
}

export default function ManagerCadastro({ loaderData }: Route.ComponentProps) {
  const { professionals, page, totalPages, total, counts, filters, loadError } =
    loaderData;
  const revalidator = useRevalidator();
  const reloading = revalidator.state !== "idle";
  const { toast, showToast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] =
    useState<ProfessionalFormData>(EMPTY_PROFESSIONAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submittedSenha, setSubmittedSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    professional: ManagedProfessional;
    ativo: boolean;
  } | null>(null);
  const [createdCreds, setCreatedCreds] = useState<CreatedCredentials | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const createFetcher = useFetcher<ProfessionalActionData>();
  const toggleFetcher = useFetcher<ProfessionalActionData>();
  const createBusy = createFetcher.state !== "idle";
  const toggleBusy = toggleFetcher.state !== "idle";

  function setField<K extends keyof ProfessionalFormData>(
    key: K,
    value: ProfessionalFormData[K],
  ) {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      // Trocar o perfil atualiza o rótulo do registro (CRP/CRESS/OAB).
      return next;
    });
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationErrors = validateProfessionalForm(formData);
    setErrors(validationErrors as Record<string, string>);
    if (Object.keys(validationErrors).length > 0) return;
    setSubmittedSenha(formData.senha);
    createFetcher.submit(
      { ...formData, intent: "cadastrar" },
      { method: "post" },
    );
  }

  useEffect(() => {
    const result = createFetcher.data;
    if (createFetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok && result.action === "cadastrar") {
      setCreatedCreds({
        nome: result.nome,
        email: result.email,
        senha: submittedSenha,
        notificationStatus: result.notificationStatus ?? null,
      });
      setFormOpen(false);
      setFormData(EMPTY_PROFESSIONAL_FORM);
      setErrors({});
      setSubmittedSenha("");
      setShowSenha(false);
      setShowConfirmar(false);
      if (result.notificationStatus === "email_sent") {
        showToast("Profissional cadastrado e convite enviado por e-mail.", "success");
      } else {
        showToast(
          "Profissional cadastrado. Repasse o acesso (e-mail e senha) por canal seguro.",
          "success",
        );
      }
      revalidator.revalidate();
      return;
    }
    if ("error" in result && result.error) {
      showToast(result.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createFetcher.data, createFetcher.state]);

  useEffect(() => {
    const result = toggleFetcher.data;
    if (toggleFetcher.state !== "idle" || !result) return;
    if ("ok" in result && result.ok && result.action === "ativo") {
      showToast(
        result.ativo
          ? "Profissional reativado. O acesso foi liberado."
          : "Profissional desativado. O acesso foi bloqueado na hora.",
        "success",
      );
      setPendingToggle(null);
      revalidator.revalidate();
      return;
    }
    if ("error" in result && result.error) {
      showToast(result.error, "error");
      setPendingToggle(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleFetcher.data, toggleFetcher.state]);

  const backendFieldErrors =
    createFetcher.data && "fieldErrors" in createFetcher.data
      ? (createFetcher.data.fieldErrors ?? {})
      : {};
  const fieldError = (key: string): string | undefined =>
    backendFieldErrors[key] ?? errors[key];

  function handleConfirmToggle() {
    if (!pendingToggle) return;
    toggleFetcher.submit(
      {
        intent: "ativo",
        id: pendingToggle.professional.id,
        ativo: String(pendingToggle.ativo),
      },
      { method: "post" },
    );
  }

  async function handleCopyCredentials() {
    if (!createdCreds) return;
    const text = `NEVIM — acesso do profissional\nE-mail: ${createdCreds.email}\nSenha inicial: ${createdCreds.senha}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
  }

  const registroLabel = getRegistroLabel(
    formData.perfil === "" ? null : (formData.perfil as ProfessionalProfile),
  );

  return (
    <section className="mx-auto max-w-6xl" aria-label="Cadastro de profissionais">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            Profissionais
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie a equipe do NEVIM (Psicologia, Serviço Social, Assessoria
            Jurídica).
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {total === 0
              ? "Nenhum profissional cadastrado."
              : `${total} ${total === 1 ? "profissional" : "profissionais"} no total.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormData(EMPTY_PROFESSIONAL_FORM);
            setErrors({});
            setFormOpen(true);
          }}
          className="rounded-xl bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C]"
        >
          Novo profissional
        </button>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => revalidator.revalidate()}
            disabled={reloading}
            className="text-xs font-semibold underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
          >
            {reloading ? "Carregando…" : "Tentar novamente"}
          </button>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filtrar por perfil"
        >
          {PROFILE_OPTIONS.map((option) => {
            const active = filters.perfil === option.value;
            const count = counts[option.value] ?? 0;
            return (
              <Link
                key={option.value}
                to={buildPerfilHref(filters, option.value)}
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "rounded-full bg-[#0C447C] px-3 py-1.5 text-xs font-semibold text-white shadow"
                    : "rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-stone-100"
                }
              >
                {option.label} · {count}
              </Link>
            );
          })}
        </div>

        <Form
          method="get"
          action="/manager/cadastro"
          aria-label="Buscar profissionais"
          className="mt-3"
        >
          <input type="hidden" name="perfil" value={filters.perfil} />
          <label className="block max-w-md">
            <span className="mb-1 block text-xs font-semibold text-gray-600">
              Buscar
            </span>
            <input
              type="search"
              name="q"
              key={filters.search}
              defaultValue={filters.search}
              placeholder="Nome ou e-mail…"
              autoComplete="off"
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/manager/cadastro"
              className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-stone-50"
            >
              Limpar
            </Link>
            <button
              type="submit"
              className="rounded-xl bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C]"
            >
              Buscar
            </button>
          </div>
        </Form>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">
            Profissionais cadastrados
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Desativar bloqueia o acesso na hora. Não é possível desativar a
            própria conta.
            {totalPages > 1 ? ` Página ${page} de ${totalPages}.` : ""}
          </p>
        </div>
        {reloading && professionals.length === 0 ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2" aria-hidden="true">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : (
          <>
            {professionals.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-500">
                Nenhum profissional encontrado para os filtros aplicados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-180 border-collapse">
                  <caption className="sr-only">
                    Profissionais cadastrados com filtros aplicados
                  </caption>
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Profissional
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Perfil
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Registro
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Situação
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 font-semibold text-right"
                      >
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#E6F1FB]/40">
                    {professionals.map((professional) => (
                      <ProfessionalRow
                        key={professional.id}
                        professional={professional}
                        busy={toggleBusy}
                        onToggle={(item, ativo) =>
                          setPendingToggle({ professional: item, ativo })
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={page} totalPages={totalPages} />
          </>
        )}
      </div>

      {formOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="novo-profissional-titulo"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => {
            if (!createBusy) setFormOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="novo-profissional-titulo"
              className="text-lg font-semibold text-gray-800"
            >
              Novo profissional
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              A senha inicial é definida por você e repassada fora do sistema —
              anote antes de enviar, pois não poderá ser recuperada.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 grid gap-3" noValidate>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600">
                  Nome <span className="text-red-600">*</span>
                </span>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(event) => setField("nome", event.target.value)}
                  placeholder="Nome completo"
                  autoComplete="off"
                  aria-invalid={Boolean(fieldError("nome"))}
                  className={fieldError("nome") ? inputErrorClass : inputClass}
                />
                {fieldError("nome") ? (
                  <span className="mt-1 block text-xs text-red-700">
                    {fieldError("nome")}
                  </span>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600">
                  E-mail <span className="text-red-600">*</span>
                </span>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) => setField("email", event.target.value)}
                  placeholder="profissional@uespi.br"
                  autoComplete="off"
                  aria-invalid={Boolean(fieldError("email"))}
                  className={fieldError("email") ? inputErrorClass : inputClass}
                />
                {fieldError("email") ? (
                  <span className="mt-1 block text-xs text-red-700">
                    {fieldError("email")}
                  </span>
                ) : null}
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600">
                    Perfil <span className="text-red-600">*</span>
                  </span>
                  <select
                    value={formData.perfil}
                    onChange={(event) =>
                      setField(
                        "perfil",
                        event.target.value as ProfessionalFormData["perfil"],
                      )
                    }
                    aria-invalid={Boolean(fieldError("perfil"))}
                    className={fieldError("perfil") ? inputErrorClass : inputClass}
                  >
                    <option value="">Selecione…</option>
                    {PROFESSIONAL_PROFILES.map((perfil) => (
                      <option key={perfil} value={perfil}>
                        {PROFESSIONAL_PROFILE_LABELS[perfil]}
                      </option>
                    ))}
                  </select>
                  {fieldError("perfil") ? (
                    <span className="mt-1 block text-xs text-red-700">
                      {fieldError("perfil")}
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600">
                    {registroLabel} <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="text"
                    value={formData.registro}
                    onChange={(event) =>
                      setField("registro", event.target.value)
                    }
                    placeholder={registroLabel}
                    autoComplete="off"
                    aria-invalid={Boolean(fieldError("registro"))}
                    className={
                      fieldError("registro") ? inputErrorClass : inputClass
                    }
                  />
                  {fieldError("registro") ? (
                    <span className="mt-1 block text-xs text-red-700">
                      {fieldError("registro")}
                    </span>
                  ) : null}
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600">
                    Senha inicial <span className="text-red-600">*</span>
                  </span>
                  <div className="relative">
                    <input
                      type={showSenha ? "text" : "password"}
                      value={formData.senha}
                      onChange={(event) =>
                        setField("senha", event.target.value)
                      }
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      aria-invalid={Boolean(fieldError("senha"))}
                      className={
                        fieldError("senha")
                          ? `${inputErrorClass} pr-16`
                          : `${inputClass} pr-16`
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha((v) => !v)}
                      className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-[#0C447C] hover:opacity-80"
                    >
                      {showSenha ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  {fieldError("senha") ? (
                    <span className="mt-1 block text-xs text-red-700">
                      {fieldError("senha")}
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600">
                    Confirmar senha <span className="text-red-600">*</span>
                  </span>
                  <div className="relative">
                    <input
                      type={showConfirmar ? "text" : "password"}
                      value={formData.confirmarSenha}
                      onChange={(event) =>
                        setField("confirmarSenha", event.target.value)
                      }
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      aria-invalid={Boolean(fieldError("confirmarSenha"))}
                      className={
                        fieldError("confirmarSenha")
                          ? `${inputErrorClass} pr-16`
                          : `${inputClass} pr-16`
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmar((v) => !v)}
                      className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-[#0C447C] hover:opacity-80"
                    >
                      {showConfirmar ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  {fieldError("confirmarSenha") ? (
                    <span className="mt-1 block text-xs text-red-700">
                      {fieldError("confirmarSenha")}
                    </span>
                  ) : null}
                </label>
              </div>

              <div className="mt-1 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!createBusy) setFormOpen(false);
                  }}
                  disabled={createBusy}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-stone-50 disabled:opacity-60"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="rounded-xl bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C] disabled:opacity-60"
                >
                  {createBusy ? "Cadastrando…" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {createdCreds ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="credenciais-titulo"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h2
              id="credenciais-titulo"
              className="text-lg font-semibold text-gray-800"
            >
              Profissional cadastrado
            </h2>
            {createdCreds.notificationStatus === "email_sent" ? (
              <p className="mt-2 text-sm text-gray-600">
                Convite enviado por e-mail para {createdCreds.email}. Guarde
                também o acesso abaixo como backup.
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                Repasse o acesso abaixo para {createdCreds.nome} por canal
                seguro — esta é a única exibição, a senha não poderá ser
                recuperada.
              </p>
            )}
            <dl className="mt-4 space-y-2 rounded-xl bg-stone-50 p-4 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  E-mail
                </dt>
                <dd className="font-mono text-gray-800">
                  {createdCreds.email}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Senha inicial
                </dt>
                <dd className="font-mono text-gray-800">
                  {createdCreds.senha}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-[#0C447C] hover:bg-[#E6F1FB]"
              >
                {copied ? "Copiado!" : "Copiar acesso"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatedCreds(null);
                  setCopied(false);
                }}
                className="rounded-xl bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={pendingToggle !== null}
        title={
          pendingToggle?.ativo ? "Reativar profissional?" : "Desativar profissional?"
        }
        description={
          pendingToggle
            ? pendingToggle.ativo
              ? `${pendingToggle.professional.nome} voltará a ter acesso ao sistema.`
              : `${pendingToggle.professional.nome} perderá o acesso ao sistema imediatamente.`
            : ""
        }
        consequences={
          pendingToggle && !pendingToggle.ativo
            ? "Verifique as consultas futuras deste profissional e reagende com outro profissional, se necessário."
            : undefined
        }
        confirmLabel={pendingToggle?.ativo ? "Reativar" : "Desativar"}
        confirmVariant={pendingToggle?.ativo ? "primary" : "danger"}
        cancelLabel="Voltar"
        loading={toggleBusy}
        onConfirm={handleConfirmToggle}
        onCancel={() => {
          if (!toggleBusy) setPendingToggle(null);
        }}
      />

      <Toast toast={toast} />
    </section>
  );
}
