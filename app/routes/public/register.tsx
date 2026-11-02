import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useFetcher, data } from "react-router";
import type { Route } from "./+types/register";
import { Button } from "../../../shared/components/Button";
import EmergencyExitButton from "../../../shared/components/EmergencyExitButton";
import { CityCombobox } from "../../../shared/components/CityCombobox";
import { DatePicker, parseDisplayToISO } from "../../../features/manager/components/DatePicker";
import { Toast } from "../../../shared/components/Toast";
import { LoadingOverlay } from "../../../shared/components/LoadingOverlay";
import { useToast } from "../../../shared/hooks/useToast";
import {
  registerApi,
  RegisterInviteError,
} from "../../../features/public/registerApi.server";
import type { InviteValidation } from "../../../features/public/registerApi.server";
import {
  getBrazilStatesSync,
  getCitiesByUfSync,
} from "../../data/brazilLocations";

type InviteErrorKind = "invalid" | "used" | "expired" | "unavailable";

export type RegisterLoaderData =
  | { invite: InviteValidation; inviteError: null }
  | {
      invite: null;
      inviteError: { status: number; kind: InviteErrorKind; message: string };
    };

export type RegisterActionData =
  | { ok: true; nome: string }
  | {
      ok?: false;
      error: string;
      fieldErrors?: RegisterFormErrors;
      inviteStale?: boolean;
    };

interface RegisterFormData {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  cpf: string;
  dataNascimento: string;
  estadoCivil: string;
  sexo: string;
  genero: string;
  etnia: string;
  escolaridade: string;
  cotista: "" | "sim" | "nao";
  vinculo: string;
  campus: string;
  curso: string;
  matricula: string;
  rua: string;
  numero: string;
  bairro: string;
  state: string;
  cidade: string;
  cep: string;
}

type RegisterFormErrors = Partial<Record<keyof RegisterFormData, string>>;

const STEPS = [
  { id: 1, title: "Conta", subtitle: "Acesso" },
  { id: 2, title: "Dados pessoais", subtitle: "Perfil" },
  { id: 3, title: "Endereço e matrícula", subtitle: "Localização" },
];

const ESTADO_CIVIL_OPTIONS = [
  { value: "SOLTEIRO", label: "Solteiro(a)" },
  { value: "CASADO", label: "Casado(a)" },
  { value: "UNIAO_ESTAVEL", label: "União estável" },
  { value: "SEPARADO", label: "Separado(a) judicialmente" },
  { value: "DIVORCIADO", label: "Divorciado(a)" },
  { value: "VIUVO", label: "Viúvo(a)" },
];

const SEXO_OPTIONS = [
  { value: "FEMININO", label: "Feminino" },
  { value: "MASCULINO", label: "Masculino" },
  { value: "NAO_INFORMADO", label: "Prefiro não informar" },
];

const GENERO_OPTIONS = [
  { value: "CISGENDER", label: "Cisgênero" },
  { value: "TRANSGENDER", label: "Transgênero" },
  { value: "NAO_BINARIO", label: "Não-binário" },
  { value: "NAO_INFORMADO", label: "Prefiro não informar" },
];

const ETNIA_OPTIONS = [
  { value: "BRANCA", label: "Branca" },
  { value: "PRETA", label: "Preta" },
  { value: "PARDA", label: "Parda" },
  { value: "AMARELA", label: "Amarela" },
  { value: "INDIGENA", label: "Indígena" },
];

const ESCOLARIDADE_OPTIONS = [
  { value: "FUNDAMENTAL_INCOMPLETO", label: "Ensino fundamental incompleto" },
  { value: "FUNDAMENTAL_COMPLETO", label: "Ensino fundamental completo" },
  { value: "MEDIO_INCOMPLETO", label: "Ensino médio incompleto" },
  { value: "MEDIO_COMPLETO", label: "Ensino médio completo" },
  { value: "SUPERIOR_INCOMPLETO", label: "Ensino superior incompleto" },
  { value: "SUPERIOR_COMPLETO", label: "Ensino superior completo" },
  { value: "POS_GRADUACAO", label: "Pós-graduação" },
];

/** Converte DD/MM/AAAA válido em AAAA-MM-DD; retorna null se inválido. */
function parseBirthToISO(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) return null;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatCpfDisplay(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 9));
  const head = parts.join(".");
  if (digits.length <= 9) return head;
  return `${head}-${digits.slice(9)}`;
}

function formatCepDisplay(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// Espelha o algoritmo do backend (validators.ts) para feedback imediato.
function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let first = (sum * 10) % 11;
  if (first === 10) first = 0;
  if (first !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  let second = (sum * 10) % 11;
  if (second === 10) second = 0;
  return second === Number(digits[10]);
}

function validateBirthDate(value: string): string | null {
  if (!value.trim()) {
    return "Informe sua data de nascimento.";
  }
  // Aceita ISO (AAAA-MM-DD, do DatePicker) ou DD/MM/AAAA legado.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? value.trim()
    : parseDisplayToISO(value);
  if (!iso) {
    return "Informe uma data válida no formato DD/MM/AAAA.";
  }
  // Não permite data futura.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const birth = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > today) {
    return "Informe uma data válida no formato DD/MM/AAAA.";
  }
  return null;
}

/** Compõe "Rua X, 123 - Bairro Y" para o campo único `endereco` do back. */
function composeEndereco(rua: string, numero: string, bairro: string): string {
  const street = rua.trim();
  if (!street) return "";
  let composed = street;
  const number = numero.trim();
  if (number) composed += `, ${number}`;
  const district = bairro.trim();
  if (district) composed += ` - ${district}`;
  return composed;
}

function validateRegisterStep(
  step: number,
  formData: RegisterFormData,
  citiesForState: string[] = [],
): RegisterFormErrors {
  const errors: RegisterFormErrors = {};

  if (step === 1) {
    if (!formData.nome.trim()) {
      errors.nome = "Informe seu nome completo.";
    } else if (formData.nome.trim().length < 3) {
      errors.nome = "Nome deve ter pelo menos 3 caracteres.";
    }

    if (!formData.email.trim()) {
      errors.email = "Informe seu e-mail.";
    } else if (!validateEmail(formData.email.trim())) {
      errors.email = "E-mail inválido. Verifique o formato.";
    }

    if (!formData.senha) {
      errors.senha = "Crie uma senha.";
    } else if (formData.senha.length < 8) {
      errors.senha = "Senha deve ter ao menos 8 caracteres.";
    }

    if (!formData.confirmarSenha) {
      errors.confirmarSenha = "Confirme sua senha.";
    } else if (formData.confirmarSenha !== formData.senha) {
      errors.confirmarSenha = "As senhas não conferem.";
    }
  }

  if (step === 2) {
    const cpfDigits = formData.cpf.replace(/\D/g, "");
    if (!cpfDigits) {
      errors.cpf = "Informe seu CPF.";
    } else if (cpfDigits.length !== 11) {
      errors.cpf = "CPF deve ter 11 dígitos.";
    } else if (!isValidCpf(cpfDigits)) {
      errors.cpf = "CPF inválido. Confira os números.";
    }

    if (!formData.dataNascimento) {
      errors.dataNascimento = "Informe sua data de nascimento.";
    } else {
      const birthError = validateBirthDate(formData.dataNascimento);
      if (birthError) errors.dataNascimento = birthError;
    }

    if (!formData.estadoCivil) {
      errors.estadoCivil = "Selecione seu estado civil.";
    }
    if (!formData.sexo) {
      errors.sexo = "Selecione uma opção.";
    }
    if (!formData.genero) {
      errors.genero = "Selecione uma opção.";
    }
    if (!formData.etnia) {
      errors.etnia = "Selecione uma opção.";
    }
    if (!formData.escolaridade) {
      errors.escolaridade = "Selecione sua escolaridade.";
    }
    if (formData.cotista !== "sim" && formData.cotista !== "nao") {
      errors.cotista = "Informe se você é cotista (sim ou não).";
    }
  }

  if (step === 3) {
    // Vínculo, campus e curso vêm do snapshot do convite (demanda aprovada)
    // e seguem ocultos no envio — aqui valida-se só endereço e matrícula.
    if (formData.matricula.trim() && formData.matricula.trim().length < 3) {
      errors.matricula = "Matrícula inválida.";
    }

    const rua = formData.rua.trim();
    const numero = formData.numero.trim();
    const bairro = formData.bairro.trim();
    const cepDigits = formData.cep.replace(/\D/g, "");
    const hasAddress = Boolean(rua || numero || bairro || cepDigits);

    if (rua && rua.length < 3) {
      errors.rua = "Rua inválida.";
    }
    if (rua && !numero) {
      errors.numero = "Informe o número ou S/N.";
    }
    if (bairro && bairro.length < 2) {
      errors.bairro = "Bairro inválido.";
    }

    if (!formData.cidade.trim()) {
      if (hasAddress) {
        errors.cidade = "Cidade é obrigatória quando o endereço é informado.";
      }
    } else if (formData.cidade.trim().length < 2) {
      errors.cidade = "Cidade inválida.";
    } else if (
      citiesForState.length > 0 &&
      !citiesForState.includes(formData.cidade.trim())
    ) {
      errors.cidade = "Selecione uma cidade válida da lista.";
    }

    if (cepDigits && cepDigits.length !== 8) {
      errors.cep = "CEP deve ter 8 dígitos.";
    }
  }

  return errors;
}

function validateRegisterAll(
  formData: RegisterFormData,
  citiesForState: string[] = [],
): RegisterFormErrors {
  return {
    ...validateRegisterStep(1, formData, citiesForState),
    ...validateRegisterStep(2, formData, citiesForState),
    ...validateRegisterStep(3, formData, citiesForState),
  };
}

// O backend usa os mesmos nomes de campo do formulário. Mensagens padrão
// do Zod em inglês (ex.: enum inválido) ganham texto amigável em português.
function mapBackendFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
): RegisterFormErrors {
  const friendlyFallback: Partial<Record<keyof RegisterFormData, string>> = {
    nome: "Nome deve ter pelo menos 3 caracteres.",
    email: "E-mail inválido. Verifique o formato.",
    senha: "Senha deve ter ao menos 8 caracteres.",
    confirmarSenha: "As senhas não conferem.",
    cpf: "Informe um CPF válido.",
    dataNascimento: "Informe uma data de nascimento válida.",
    estadoCivil: "Selecione seu estado civil.",
    sexo: "Selecione uma opção.",
    genero: "Selecione uma opção.",
    etnia: "Selecione uma opção.",
    escolaridade: "Selecione sua escolaridade.",
    cotista: "Informe se você é cotista (sim ou não).",
    matricula: "Matrícula inválida.",
    rua: "Rua inválida.",
    numero: "Informe o número ou S/N.",
    bairro: "Bairro inválido.",
    cidade: "Cidade inválida.",
    cep: "CEP deve ter 8 dígitos.",
  };

  const knownFields = new Set<string>([
    "nome",
    "email",
    "senha",
    "confirmarSenha",
    "cpf",
    "matricula",
    "dataNascimento",
    "estadoCivil",
    "sexo",
    "genero",
    "etnia",
    "escolaridade",
    "cotista",
    "rua",
    "numero",
    "bairro",
    "cidade",
    "cep",
  ]);

  // O back usa `endereco` único; aqui ele foi desmembrado em rua/número/bairro.
  const translated: Record<string, string[] | undefined> = {
    ...fieldErrors,
  };
  if (translated.endereco && !translated.rua) {
    translated.rua = translated.endereco;
  }
  delete translated.endereco;

  const mapped: RegisterFormErrors = {};
  for (const [field, messages] of Object.entries(translated)) {
    if (!Array.isArray(messages) || messages.length === 0) continue;
    if (!knownFields.has(field)) continue;
    const rawMessage = messages[0] ?? "";
    const looksDefault =
      /^invalid/i.test(rawMessage.trim()) || /expected/i.test(rawMessage);
    const fallback = friendlyFallback[field as keyof RegisterFormData];
    (mapped as Record<string, string>)[field] =
      looksDefault && fallback ? fallback : rawMessage;
  }
  return mapped;
}

function resolveInviteError(
  status: number,
  message: string,
): { kind: InviteErrorKind; message: string } {
  const normalized = message.toLowerCase();
  if (status === 410 && normalized.includes("utilizad")) {
    return {
      kind: "used",
      message:
        "Este link já foi utilizado. Se você já concluiu seu cadastro, acesse o login com seu e-mail e senha.",
    };
  }
  if (status === 410 && normalized.includes("expir")) {
    return {
      kind: "expired",
      message:
        "Este link expirou (válido por 48 horas). Solicite o reenvio de um novo link ao NEVIM.",
    };
  }
  if (status === 404 || status === 400) {
    return {
      kind: "invalid",
      message:
        "Não encontramos este convite. Confira se o endereço foi copiado por completo ou solicite um novo link ao NEVIM.",
    };
  }
  return {
    kind: "unavailable",
    message:
      "Não foi possível validar seu convite agora. Tente novamente em instantes.",
  };
}

export async function loader({ params }: Route.LoaderArgs) {
  const token = params.token ?? "";
  if (token.length < 10) {
    return {
      invite: null,
      inviteError: {
        status: 400,
        kind: "invalid" as const,
        message:
          "Este link de cadastro é inválido. Confira se o endereço foi copiado por completo ou solicite um novo link ao NEVIM.",
      },
    } satisfies RegisterLoaderData;
  }

  try {
    const invite = await registerApi.validateInvite(token);
    return { invite, inviteError: null } satisfies RegisterLoaderData;
  } catch (err) {
    if (err instanceof RegisterInviteError) {
      const resolved = resolveInviteError(err.status, err.message);
      return {
        invite: null,
        inviteError: { status: err.status, ...resolved },
      } satisfies RegisterLoaderData;
    }
    return {
      invite: null,
      inviteError: {
        status: 503,
        kind: "unavailable" as const,
        message:
          "Não foi possível validar seu convite agora. Tente novamente em instantes.",
      },
    } satisfies RegisterLoaderData;
  }
}

// O loader valida o convite uma vez na abertura. Não revalidar após o
// action evita que um convite recém-utilizado (201) vire tela de erro.
export function shouldRevalidate() {
  return false;
}

export async function action({ request, params }: Route.ActionArgs) {
  const token = params.token ?? "";

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return data<RegisterActionData>(
      {
        error:
          "Não foi possível concluir seu cadastro. Tente novamente em instantes.",
      },
      { status: 400 },
    );
  }

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const nullable = (v: string): string | null => {
    const trimmed = v.trim();
    return trimmed ? trimmed : null;
  };

  if (!token || token.length < 10) {
    return data<RegisterActionData>(
      { error: "Convite inválido. Verifique o link recebido.", inviteStale: true },
      { status: 400 },
    );
  }

  const payload = {
    nome: str(raw.nome).trim(),
    email: str(raw.email).trim(),
    senha: str(raw.senha),
    confirmarSenha: str(raw.confirmarSenha),
    vinculo: str(raw.vinculo),
    campus: str(raw.campus),
    curso: nullable(str(raw.curso ?? "")),
    cpf: str(raw.cpf).replace(/\D/g, ""),
    matricula: nullable(str(raw.matricula ?? "")),
    dataNascimento: str(raw.dataNascimento).trim(),
    estadoCivil: str(raw.estadoCivil),
    sexo: str(raw.sexo),
    genero: str(raw.genero),
    etnia: str(raw.etnia),
    escolaridade: str(raw.escolaridade),
    cotista: raw.cotista === true,
    endereco: nullable(str(raw.endereco ?? "")),
    cidade: nullable(str(raw.cidade ?? "")),
    cep: str(raw.cep).replace(/\D/g, "") || null,
  };

  try {
    const created = await registerApi.completeRegistration(token, payload);
    return data<RegisterActionData>(
      { ok: true, nome: created.nome },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof RegisterInviteError) {
      const fieldErrors = mapBackendFieldErrors(err.fieldErrors);
      if (Object.keys(fieldErrors).length > 0) {
        return data<RegisterActionData>(
          {
            error: "Corrija os campos destacados antes de enviar.",
            fieldErrors,
          },
          { status: err.status },
        );
      }
      const inviteStale = err.status === 404 || err.status === 410;
      return data<RegisterActionData>(
        { error: err.message, inviteStale },
        { status: err.status >= 400 && err.status < 600 ? err.status : 500 },
      );
    }
    return data<RegisterActionData>(
      {
        error:
          "Não foi possível concluir seu cadastro. Tente novamente em instantes.",
      },
      { status: 500 },
    );
  }
}

const inputClass = (hasError: boolean) =>
  `w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all placeholder:text-gray-400 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
      : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
  }`;

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="text-red-700 text-xs mt-1.5">
      {message}
    </p>
  );
}

export default function VictimRegister({
  loaderData,
  params,
}: Route.ComponentProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher<RegisterActionData>();
  const token = params.token ?? "";

  const invite = loaderData.invite;
  const inviteError = loaderData.inviteError;

  const prefill = {
    nome: invite?.solicitante.nome ?? "",
    email: invite?.solicitante.email ?? "",
    vinculo: invite?.solicitante.vinculo ?? "",
    campus: invite?.solicitante.campus ?? "",
    curso: invite?.solicitante.curso ?? "",
    cidade: invite?.solicitante.cidade ?? "",
  };

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<RegisterFormData>({
    nome: prefill.nome,
    email: prefill.email,
    senha: "",
    confirmarSenha: "",
    cpf: "",
    dataNascimento: "",
    estadoCivil: "",
    sexo: "",
    genero: "",
    etnia: "",
    escolaridade: "",
    cotista: "",
    vinculo: prefill.vinculo,
    campus: prefill.campus,
    curso: prefill.curso,
    matricula: "",
    rua: "",
    numero: "",
    bairro: "",
    state: "",
    cidade: prefill.cidade,
    cep: "",
  });
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [successName, setSuccessName] = useState("");
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState<
    Partial<Record<keyof RegisterFormData, boolean>>
  >({});
  const { toast, showToast } = useToast();
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const cepAbortRef = useRef<AbortController | null>(null);

  // Cancela busca de CEP pendente ao desmontar.
  useEffect(() => {
    return () => {
      cepAbortRef.current?.abort();
    };
  }, []);

  const hasAddressFields = Boolean(
    formData.rua.trim() ||
      formData.numero.trim() ||
      formData.bairro.trim() ||
      formData.cep.replace(/\D/g, ""),
  );

  type ViaCepResponse = {
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
    erro?: boolean | string;
  };

  async function searchCep(digits: string) {
    cepAbortRef.current?.abort();
    const controller = new AbortController();
    cepAbortRef.current = controller;
    setIsSearchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`ViaCEP status ${res.status}`);
      const found = (await res.json()) as ViaCepResponse;
      if (!found || found.erro) {
        showToast("CEP não encontrado. Preencha o endereço manualmente.", "error");
        return;
      }
      const uf = String(found.uf ?? "").toUpperCase();
      const cityList = uf ? getCitiesByUfSync(uf) : [];
      const city = String(found.localidade ?? "").trim();
      const cityMatched =
        city !== "" && (cityList.length === 0 || cityList.includes(city));
      setFormData((prev) => ({
        ...prev,
        rua: String(found.logradouro ?? "").trim(),
        bairro: String(found.bairro ?? "").trim(),
        state: uf || prev.state,
        cidade: cityMatched ? city : prev.cidade,
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.rua;
        delete next.bairro;
        delete next.cidade;
        delete next.cep;
        return next;
      });
      if (city !== "" && !cityMatched) {
        showToast("Endereço localizado, mas confira a cidade.", "success");
      } else {
        showToast("Endereço localizado pelo CEP.", "success");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      showToast(
        "Não foi possível buscar o CEP. Preencha o endereço manualmente.",
        "error",
      );
    } finally {
      if (cepAbortRef.current === controller) {
        cepAbortRef.current = null;
        setIsSearchingCep(false);
      }
    }
  }

  function handleCepChange(value: string) {
    const masked = formatCepDisplay(value);
    updateField("cep", masked);
    if (masked.replace(/\D/g, "").length === 8) {
      void searchCep(masked.replace(/\D/g, ""));
    }
  }

  const isSubmitting = fetcher.state !== "idle";
  const totalSteps = STEPS.length;

  const states = useMemo(() => getBrazilStatesSync(), []);
  const cities = useMemo(
    () => getCitiesByUfSync(formData.state),
    [formData.state],
  );

  useEffect(() => {
    setHasAttemptedSubmit(false);
  }, [currentStep]);

  function markTouched(field: keyof RegisterFormData) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  function shouldShowError(field: keyof RegisterFormData): boolean {
    return Boolean(errors[field] && (touched[field] || hasAttemptedSubmit));
  }

  function updateField<K extends keyof RegisterFormData>(
    field: K,
    value: RegisterFormData[K],
  ) {
    if (field === "state") {
      const nextState = String(value).toUpperCase();
      setFormData((prev) =>
        prev.state === nextState
          ? prev
          : { ...prev, state: nextState, cidade: "" },
      );
      setErrors((prev) => {
        const next = { ...prev };
        delete next.state;
        delete next.cidade;
        return next;
      });
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleNext() {
    const stepErrors = validateRegisterStep(currentStep, formData, cities);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      showToast(
        "Verifique os campos destacados antes de continuar.",
        "error",
      );
      return;
    }
    setErrors({});
    if (currentStep < totalSteps) {
      setCurrentStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleBack() {
    setErrors({});
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Enter" && currentStep < totalSteps) {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (
        tag === "TEXTAREA" ||
        tag === "BUTTON" ||
        tag === "A" ||
        tag === "SELECT"
      )
        return;
      e.preventDefault();
      handleNext();
    }
  }

  function focusStepForErrors(errs: RegisterFormErrors) {
    if (errs.nome || errs.email || errs.senha || errs.confirmarSenha) {
      setCurrentStep(1);
    } else if (
      errs.cpf ||
      errs.dataNascimento ||
      errs.estadoCivil ||
      errs.sexo ||
      errs.genero ||
      errs.etnia ||
      errs.escolaridade ||
      errs.cotista
    ) {
      setCurrentStep(2);
    } else if (
      errs.matricula ||
      errs.rua ||
      errs.numero ||
      errs.bairro ||
      errs.state ||
      errs.cidade ||
      errs.cep
    ) {
      setCurrentStep(3);
    } else {
      setCurrentStep(3);
    }
  }

  useEffect(() => {
    const actionData = fetcher.data;
    if (fetcher.state !== "idle" || !actionData) return;
    if ("ok" in actionData && actionData.ok) {
      setSuccessName(actionData.nome);
      setIsSuccess(true);
      showToast("Cadastro concluído com sucesso!", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if ("error" in actionData && actionData.error) {
      if (actionData.fieldErrors && Object.keys(actionData.fieldErrors).length > 0) {
        setErrors(actionData.fieldErrors);
        setHasAttemptedSubmit(true);
        focusStepForErrors(actionData.fieldErrors);
        showToast(
          "Corrija os campos destacados antes de enviar.",
          "error",
        );
      } else {
        showToast(actionData.error, "error");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (currentStep < totalSteps) {
      handleNext();
      return;
    }

    setHasAttemptedSubmit(true);
    // Vínculo/campus/curso vêm do convite; sem eles o back rejeita (400).
    if (!formData.vinculo.trim() || !formData.campus.trim()) {
      showToast(
        "Dados do convite incompletos. Entre em contato com o NEVIM.",
        "error",
      );
      return;
    }
    const allErrors = validateRegisterAll(formData, cities);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      focusStepForErrors(allErrors);
      showToast(
        "Corrija os campos destacados antes de enviar.",
        "error",
      );
      return;
    }

    // Proxy server-side: browser -> action (/register/:token) -> POST {API_URL}/auth/register/:token
    // CPF e CEP vão só com dígitos; máscaras são só exibição.
    fetcher.submit(
      {
        nome: formData.nome.trim(),
        email: formData.email.trim(),
        senha: formData.senha,
        confirmarSenha: formData.confirmarSenha,
        cpf: formData.cpf.replace(/\D/g, ""),
        dataNascimento:
          /^\d{4}-\d{2}-\d{2}$/.test(formData.dataNascimento.trim())
            ? formData.dataNascimento.trim()
            : (parseBirthToISO(formData.dataNascimento) ?? ""),
        estadoCivil: formData.estadoCivil,
        sexo: formData.sexo,
        genero: formData.genero,
        etnia: formData.etnia,
        escolaridade: formData.escolaridade,
        cotista: formData.cotista === "sim",
        vinculo: formData.vinculo,
        campus: formData.campus,
        curso: formData.curso.trim(),
        matricula: formData.matricula.trim(),
        endereco: composeEndereco(formData.rua, formData.numero, formData.bairro) || null,
        cidade: formData.cidade.trim(),
        cep: formData.cep.replace(/\D/g, ""),
      },
      { method: "post", action: `/register/${token}`, encType: "application/json" },
    );
  }

  function handleStepClick(stepId: number) {
    if (stepId < currentStep) {
      setErrors({});
      setCurrentStep(stepId);
    } else if (stepId > currentStep) {
      const combinedErrors: RegisterFormErrors = {};
      for (let s = currentStep; s < stepId; s++) {
        Object.assign(
          combinedErrors,
          validateRegisterStep(s, formData, cities),
        );
      }
      if (Object.keys(combinedErrors).length === 0) {
        setErrors({});
        setCurrentStep(stepId);
      } else {
        setErrors(combinedErrors);
        showToast("Complete a etapa atual antes de avançar.", "error");
      }
    }
  }

  const expiresLabel = invite
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(invite.expiraEm))
    : null;

  if (isSuccess) {
    return (
      <div className="max-w-3xl mx-auto px-2 lg:px-0">
        <div className="bg-white rounded-xl shadow-lg p-8 lg:p-12 text-center border border-stone-200">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#EAF3DE] flex items-center justify-center mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#27500A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8"
              aria-hidden="true"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-3">
            Cadastro concluído
          </h1>
          <p className="text-gray-600 mb-2">
            {successName ? `${successName}, sua` : "Sua"} conta foi criada com
            sucesso e vinculada à sua demanda.
          </p>
          <p className="text-gray-600 text-sm mb-8">
            Use seu e-mail e senha para entrar e acompanhar seu processo. Seus
            dados estão protegidos e em sigilo.
          </p>
          <div className="flex justify-center">
            <Button
              variant="primary"
              onClick={() => navigate("/login")}
              className="h-11 px-8"
            >
              Ir para o login
            </Button>
          </div>
        </div>
        <EmergencyExitButton />
      </div>
    );
  }

  if (!invite || inviteError) {
    const kind = inviteError?.kind ?? "unavailable";
    const titles: Record<InviteErrorKind, string> = {
      invalid: "Link de cadastro inválido",
      used: "Link já utilizado",
      expired: "Link expirado",
      unavailable: "Serviço indisponível",
    };
    return (
      <div className="max-w-3xl mx-auto px-2 lg:px-0">
        <div className="bg-white rounded-xl shadow-lg p-8 lg:p-12 text-center border border-stone-200">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#FCEBEB] flex items-center justify-center mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-8 h-8 text-[#791F1F]"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-3">
            {titles[kind]}
          </h1>
          <p className="text-gray-600 mb-2">
            {inviteError?.message ??
              "Não foi possível validar seu convite."}
          </p>
          <p className="text-gray-600 text-sm mb-8">
            Precisa de ajuda? Entre em contato com o NEVIM pelo e-mail{" "}
            <a
              href="mailto:nevim@uespi.br"
              className="text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
            >
              nevim@uespi.br
            </a>
            .
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {kind === "used" ? (
              <Button
                variant="primary"
                onClick={() => navigate("/login")}
                className="h-11 px-8"
              >
                Ir para o login
              </Button>
            ) : kind === "unavailable" ? (
              <Button
                variant="primary"
                onClick={() => window.location.reload()}
                className="h-11 px-8"
              >
                Tentar novamente
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="h-11 px-8 bg-white"
            >
              Voltar ao início
            </Button>
          </div>
        </div>
        <EmergencyExitButton />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-2 lg:px-0">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800">
          Completar cadastro
        </h1>
        <p className="text-gray-600 mt-2 text-sm lg:text-base leading-relaxed">
          Seu convite foi validado. Preencha os dados abaixo para criar sua
          conta e acompanhar seu processo no{" "}
          <span className="font-medium text-gray-800">NEVIM</span>. Seus dados
          são <span className="font-medium">confidenciais</span> e protegidos.
        </p>
        {expiresLabel && (
          <p className="text-xs text-gray-500 mt-2">
            Link válido até {expiresLabel}.
          </p>
        )}
      </div>

      {/* Stepper - RFF02 */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 lg:p-6 mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const isClickable = step.id <= currentStep;

            return (
              <div
                key={step.id}
                className="flex items-center flex-1 last:flex-none"
              >
                <button
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  disabled={!isClickable && step.id > currentStep}
                  className={`flex flex-col items-center gap-1.5 lg:gap-2 group ${!isClickable && step.id > currentStep ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Etapa ${step.id}: ${step.title}`}
                >
                  <div
                    className={`w-9 h-9 lg:w-10 lg:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors border-2
                      ${
                        isCompleted
                          ? "bg-[#378ADD] border-[#378ADD] text-white"
                          : isActive
                            ? "bg-[#378ADD] border-[#378ADD] text-white shadow-md"
                            : "bg-white border-gray-300 text-gray-500 group-hover:border-[#378ADD] group-hover:text-[#378ADD]"
                      }`}
                  >
                    {isCompleted ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                        aria-hidden="true"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="text-center hidden sm:block">
                    <p
                      className={`text-xs lg:text-sm font-medium leading-none ${isActive ? "text-[#0C447C]" : isCompleted ? "text-gray-700" : "text-gray-500"}`}
                    >
                      {step.title}
                    </p>
                    <p className="text-[11px] lg:text-xs text-gray-500 hidden lg:block">
                      {step.subtitle}
                    </p>
                  </div>
                  <div className="sm:hidden text-center">
                    <p
                      className={`text-[11px] font-medium ${isActive ? "text-[#0C447C]" : "text-gray-500"}`}
                    >
                      {step.title}
                    </p>
                  </div>
                </button>

                {index < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 lg:mx-4 h-[2px] flex items-center">
                    <div
                      className={`w-full h-[2px] rounded-full transition-colors ${currentStep > step.id ? "bg-[#378ADD]" : "bg-gray-200"}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between lg:hidden">
          <p className="text-xs text-gray-500">
            Etapa {currentStep} de {totalSteps}
          </p>
          <p className="text-xs font-medium text-[#0C447C]">
            {STEPS[currentStep - 1]?.title}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        noValidate
        className="bg-blue-200 rounded-xl p-6 lg:p-10 shadow-inner"
        aria-label="Formulário de cadastro por convite"
      >
        {/* Step 1 - Conta */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Conta de acesso
              </h2>
              <p className="text-sm text-gray-600">
                Confira seus dados e crie uma senha para entrar no sistema.
              </p>
            </div>

            <div>
              <label
                htmlFor="nome"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Nome completo <span className="text-red-600">*</span>
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                autoComplete="name"
                placeholder="Ex: Maria Silva"
                value={formData.nome}
                onChange={(e) => updateField("nome", e.target.value)}
                onBlur={() => markTouched("nome")}
                className={inputClass(shouldShowError("nome"))}
                aria-invalid={shouldShowError("nome")}
                aria-describedby={shouldShowError("nome") ? "error-nome" : undefined}
              />
              {shouldShowError("nome") && (
                <FieldError id="error-nome" message={errors.nome ?? ""} />
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                E-mail <span className="text-red-600">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                readOnly
                className={`${inputClass(shouldShowError("email"))} opacity-70 cursor-not-allowed`}
                aria-invalid={shouldShowError("email")}
                aria-describedby="hint-email"
              />
              <p id="hint-email" className="text-xs text-gray-500 mt-1.5">
                E-mail informado no convite. Não pode ser alterado.
              </p>
              {shouldShowError("email") && (
                <FieldError id="error-email" message={errors.email ?? ""} />
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="senha"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Senha <span className="text-red-600">*</span>
                </label>
                <input
                  id="senha"
                  name="senha"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={formData.senha}
                  onChange={(e) => updateField("senha", e.target.value)}
                  onBlur={() => markTouched("senha")}
                  className={inputClass(shouldShowError("senha"))}
                  aria-invalid={shouldShowError("senha")}
                  aria-describedby={
                    shouldShowError("senha") ? "error-senha" : "hint-senha"
                  }
                />
                {shouldShowError("senha") ? (
                  <FieldError id="error-senha" message={errors.senha ?? ""} />
                ) : (
                  <p id="hint-senha" className="text-xs text-gray-500 mt-1.5">
                    Use ao menos 8 caracteres.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmarSenha"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Confirmar senha <span className="text-red-600">*</span>
                </label>
                <input
                  id="confirmarSenha"
                  name="confirmarSenha"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                  value={formData.confirmarSenha}
                  onChange={(e) => updateField("confirmarSenha", e.target.value)}
                  onBlur={() => markTouched("confirmarSenha")}
                  className={inputClass(shouldShowError("confirmarSenha"))}
                  aria-invalid={shouldShowError("confirmarSenha")}
                  aria-describedby={
                    shouldShowError("confirmarSenha")
                      ? "error-confirmarSenha"
                      : undefined
                  }
                />
                {shouldShowError("confirmarSenha") && (
                  <FieldError
                    id="error-confirmarSenha"
                    message={errors.confirmarSenha ?? ""}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 - Dados pessoais */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Dados pessoais
              </h2>
              <p className="text-sm text-gray-600">
                Informações de identificação e perfil. Tratadas com sigilo.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="cpf"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  CPF <span className="text-red-600">*</span>
                </label>
                <input
                  id="cpf"
                  name="cpf"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={formData.cpf}
                  onChange={(e) =>
                    updateField("cpf", formatCpfDisplay(e.target.value))
                  }
                  onBlur={() => markTouched("cpf")}
                  className={inputClass(shouldShowError("cpf"))}
                  aria-invalid={shouldShowError("cpf")}
                  aria-describedby={
                    shouldShowError("cpf") ? "error-cpf" : undefined
                  }
                />
                {shouldShowError("cpf") && (
                  <FieldError id="error-cpf" message={errors.cpf ?? ""} />
                )}
              </div>

              <div>
                <label
                  htmlFor="dataNascimento"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Data de nascimento <span className="text-red-600">*</span>
                </label>
                <DatePicker
                  value={formData.dataNascimento}
                  onChange={(iso) => updateField("dataNascimento", iso)}
                  hasError={shouldShowError("dataNascimento")}
                  errorId="error-dataNascimento"
                />
                {shouldShowError("dataNascimento") && (
                  <FieldError
                    id="error-dataNascimento"
                    message={errors.dataNascimento ?? ""}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="estadoCivil"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Estado civil <span className="text-red-600">*</span>
                </label>
                <select
                  id="estadoCivil"
                  name="estadoCivil"
                  value={formData.estadoCivil}
                  onChange={(e) => {
                    updateField("estadoCivil", e.target.value);
                    markTouched("estadoCivil");
                  }}
                  onBlur={() => markTouched("estadoCivil")}
                  className={`${inputClass(shouldShowError("estadoCivil"))} text-gray-700`}
                  aria-invalid={shouldShowError("estadoCivil")}
                  aria-describedby={
                    shouldShowError("estadoCivil")
                      ? "error-estadoCivil"
                      : undefined
                  }
                >
                  <option value="">Selecione</option>
                  {ESTADO_CIVIL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {shouldShowError("estadoCivil") && (
                  <FieldError
                    id="error-estadoCivil"
                    message={errors.estadoCivil ?? ""}
                  />
                )}
              </div>

              <div>
                <label
                  htmlFor="sexo"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Sexo <span className="text-red-600">*</span>
                </label>
                <select
                  id="sexo"
                  name="sexo"
                  value={formData.sexo}
                  onChange={(e) => {
                    updateField("sexo", e.target.value);
                    markTouched("sexo");
                  }}
                  onBlur={() => markTouched("sexo")}
                  className={`${inputClass(shouldShowError("sexo"))} text-gray-700`}
                  aria-invalid={shouldShowError("sexo")}
                  aria-describedby={
                    shouldShowError("sexo") ? "error-sexo" : undefined
                  }
                >
                  <option value="">Selecione</option>
                  {SEXO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {shouldShowError("sexo") && (
                  <FieldError id="error-sexo" message={errors.sexo ?? ""} />
                )}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="genero"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Gênero <span className="text-red-600">*</span>
                </label>
                <select
                  id="genero"
                  name="genero"
                  value={formData.genero}
                  onChange={(e) => {
                    updateField("genero", e.target.value);
                    markTouched("genero");
                  }}
                  onBlur={() => markTouched("genero")}
                  className={`${inputClass(shouldShowError("genero"))} text-gray-700`}
                  aria-invalid={shouldShowError("genero")}
                  aria-describedby={
                    shouldShowError("genero") ? "error-genero" : undefined
                  }
                >
                  <option value="">Selecione</option>
                  {GENERO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {shouldShowError("genero") && (
                  <FieldError
                    id="error-genero"
                    message={errors.genero ?? ""}
                  />
                )}
              </div>

              <div>
                <label
                  htmlFor="etnia"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Etnia <span className="text-red-600">*</span>
                </label>
                <select
                  id="etnia"
                  name="etnia"
                  value={formData.etnia}
                  onChange={(e) => {
                    updateField("etnia", e.target.value);
                    markTouched("etnia");
                  }}
                  onBlur={() => markTouched("etnia")}
                  className={`${inputClass(shouldShowError("etnia"))} text-gray-700`}
                  aria-invalid={shouldShowError("etnia")}
                  aria-describedby={
                    shouldShowError("etnia") ? "error-etnia" : undefined
                  }
                >
                  <option value="">Selecione</option>
                  {ETNIA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {shouldShowError("etnia") && (
                  <FieldError id="error-etnia" message={errors.etnia ?? ""} />
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="escolaridade"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Escolaridade <span className="text-red-600">*</span>
              </label>
              <select
                id="escolaridade"
                name="escolaridade"
                value={formData.escolaridade}
                onChange={(e) => {
                  updateField("escolaridade", e.target.value);
                  markTouched("escolaridade");
                }}
                onBlur={() => markTouched("escolaridade")}
                className={`${inputClass(shouldShowError("escolaridade"))} text-gray-700`}
                aria-invalid={shouldShowError("escolaridade")}
                aria-describedby={
                  shouldShowError("escolaridade")
                    ? "error-escolaridade"
                    : undefined
                }
              >
                <option value="">Selecione</option>
                {ESCOLARIDADE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {shouldShowError("escolaridade") && (
                <FieldError
                  id="error-escolaridade"
                  message={errors.escolaridade ?? ""}
                />
              )}
            </div>

            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-1.5">
                Você é cotista? <span className="text-red-600">*</span>
              </legend>
              <div
                className={`flex gap-6 bg-white rounded-md px-4 py-2.5 shadow-inner border ${
                  shouldShowError("cotista")
                    ? "border-red-400"
                    : "border-transparent"
                }`}
                role="radiogroup"
                aria-invalid={shouldShowError("cotista")}
                aria-describedby={
                  shouldShowError("cotista") ? "error-cotista" : undefined
                }
              >
                {(
                  [
                    { value: "sim", label: "Sim" },
                    { value: "nao", label: "Não" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="cotista"
                      value={opt.value}
                      checked={formData.cotista === opt.value}
                      onChange={() => {
                        updateField("cotista", opt.value);
                        markTouched("cotista");
                      }}
                      className="w-4 h-4 text-[#378ADD] focus:ring-[#378ADD] accent-[#378ADD]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {shouldShowError("cotista") && (
                <FieldError
                  id="error-cotista"
                  message={errors.cotista ?? ""}
                />
              )}
            </fieldset>
          </div>
        )}

        {/* Step 3 - Endereço */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Endereço e matrícula
              </h2>
              <p className="text-sm text-gray-600">
                Complete sua matrícula e endereço.
              </p>
            </div>

            <p className="text-xs text-gray-500 bg-white/60 border border-stone-200 rounded-lg px-3 py-2.5 leading-relaxed">
              Vínculo, campus e curso já constam na sua demanda aprovada e não
              precisam ser informados novamente.
            </p>

            <div>
              <label
                htmlFor="matricula"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Matrícula
                </label>
                <input
                  id="matricula"
                  name="matricula"
                  type="text"
                  autoComplete="off"
                  placeholder="Opcional"
                  value={formData.matricula}
                  onChange={(e) => updateField("matricula", e.target.value)}
                  onBlur={() => markTouched("matricula")}
                  className={inputClass(shouldShowError("matricula"))}
                  aria-invalid={shouldShowError("matricula")}
                  aria-describedby={
                    shouldShowError("matricula") ? "error-matricula" : undefined
                  }
                />
                {shouldShowError("matricula") && (
                  <FieldError
                    id="error-matricula"
                    message={errors.matricula ?? ""}
                  />
                )}
              </div>

            <div>
              <label
                htmlFor="cep"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                CEP
              </label>
              <div className="relative">
                <input
                  id="cep"
                  name="cep"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  maxLength={9}
                  value={formData.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  onBlur={() => markTouched("cep")}
                  className={`${inputClass(shouldShowError("cep"))} pr-10`}
                  aria-invalid={shouldShowError("cep")}
                  aria-describedby={
                    shouldShowError("cep") ? "error-cep" : "hint-cep"
                  }
                />
                {isSearchingCep ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#E6F1FB] border-t-[#378ADD] rounded-full animate-spin"
                  />
                ) : null}
              </div>
              {shouldShowError("cep") ? (
                <FieldError id="error-cep" message={errors.cep ?? ""} />
              ) : (
                <p id="hint-cep" className="text-xs text-gray-500 mt-1.5">
                  Preencha o CEP para buscar o endereço automaticamente.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="rua"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Rua
              </label>
              <input
                id="rua"
                name="rua"
                type="text"
                autoComplete="street-address"
                placeholder="Ex: Rua das Flores (opcional)"
                value={formData.rua}
                onChange={(e) => updateField("rua", e.target.value)}
                onBlur={() => markTouched("rua")}
                className={inputClass(shouldShowError("rua"))}
                aria-invalid={shouldShowError("rua")}
                aria-describedby={
                  shouldShowError("rua") ? "error-rua" : undefined
                }
              />
              {shouldShowError("rua") && (
                <FieldError id="error-rua" message={errors.rua ?? ""} />
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label
                  htmlFor="numero"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Número{" "}
                  {formData.rua.trim() && (
                    <span className="text-red-600">*</span>
                  )}
                </label>
                <input
                  id="numero"
                  name="numero"
                  type="text"
                  autoComplete="off"
                  placeholder="Nº ou S/N"
                  maxLength={10}
                  value={formData.numero}
                  onChange={(e) => updateField("numero", e.target.value)}
                  onBlur={() => markTouched("numero")}
                  className={inputClass(shouldShowError("numero"))}
                  aria-invalid={shouldShowError("numero")}
                  aria-describedby={
                    shouldShowError("numero") ? "error-numero" : undefined
                  }
                />
                {shouldShowError("numero") && (
                  <FieldError
                    id="error-numero"
                    message={errors.numero ?? ""}
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="bairro"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Bairro
                </label>
                <input
                  id="bairro"
                  name="bairro"
                  type="text"
                  autoComplete="address-level3"
                  placeholder="Bairro (opcional)"
                  value={formData.bairro}
                  onChange={(e) => updateField("bairro", e.target.value)}
                  onBlur={() => markTouched("bairro")}
                  className={inputClass(shouldShowError("bairro"))}
                  aria-invalid={shouldShowError("bairro")}
                  aria-describedby={
                    shouldShowError("bairro") ? "error-bairro" : undefined
                  }
                />
                {shouldShowError("bairro") && (
                  <FieldError
                    id="error-bairro"
                    message={errors.bairro ?? ""}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="state"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Estado
                </label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={(e) => {
                    updateField("state", e.target.value);
                    markTouched("state");
                  }}
                  onBlur={() => markTouched("state")}
                  className={`${inputClass(shouldShowError("state"))} text-gray-700`}
                  aria-invalid={shouldShowError("state")}
                  aria-describedby={
                    shouldShowError("state") ? "error-state" : undefined
                  }
                >
                  <option value="">Selecione o estado</option>
                  {states.map((item) => (
                    <option key={item.uf} value={item.uf}>
                      {item.name} ({item.uf})
                    </option>
                  ))}
                </select>
                {shouldShowError("state") && (
                  <FieldError id="error-state" message={errors.state ?? ""} />
                )}
              </div>

              <div>
                <label
                  htmlFor="cidade"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Cidade{" "}
                  {hasAddressFields && (
                    <span className="text-red-600">*</span>
                  )}
                </label>
                <CityCombobox
                  id="cidade"
                  value={formData.cidade}
                  cities={cities}
                  disabled={!formData.state}
                  hasError={shouldShowError("cidade")}
                  placeholder={
                    !formData.state
                      ? "Selecione o estado primeiro"
                      : "Ex: Teresina — digite para buscar"
                  }
                  onChange={(next) => {
                    updateField("cidade", next);
                    markTouched("cidade");
                  }}
                  onBlur={() => markTouched("cidade")}
                />
                {shouldShowError("cidade") && (
                  <FieldError id="error-cidade" message={errors.cidade ?? ""} />
                )}
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Se informar o endereço, a cidade passa a ser obrigatória.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <Button
              type="button"
              key="previous-button"
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="h-11 px-6 bg-white border-gray-300 text-gray-700 hover:bg-stone-50"
            >
              Voltar
            </Button>
          ) : (
            <Button
              key="cancel-button"
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              className="h-11 px-6 bg-white hidden sm:inline-flex"
            >
              Cancelar
            </Button>
          )}

          {currentStep < totalSteps ? (
            <Button
              key="next-button"
              type="button"
              variant="primary"
              onClick={handleNext}
              className="h-11 px-8 ml-auto"
            >
              Próximo
            </Button>
          ) : (
            <Button
              key="submit-button"
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="h-11 px-8 ml-auto min-w-[160px]"
            >
              {isSubmitting ? "Concluindo..." : "Concluir cadastro"}
            </Button>
          )}
        </div>

        <p className="text-xs text-center text-gray-500 mt-6">
          Etapa {currentStep} de {totalSteps} • Campos marcados com{" "}
          <span className="text-red-600">*</span> são obrigatórios
        </p>
        <EmergencyExitButton />
      </form>

      {/* Toast global - RFF12 */}
      <Toast toast={toast} />

      {/* Loading overlay - RFF11 */}
      <LoadingOverlay open={isSubmitting} message="Concluindo seu cadastro..." />
    </div>
  );
}
