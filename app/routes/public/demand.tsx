import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useFetcher, data } from "react-router";
import type { Route } from "./+types/demand";
import { Button } from "../../../shared/components/Button";
import { EmergencyExitButton } from "../../../shared/components/EmergencyExitButton";
import { CityCombobox } from "../../../shared/components/CityCombobox";
import { Toast } from "../../../shared/components/Toast";
import { LoadingOverlay } from "../../../shared/components/LoadingOverlay";
import { useToast } from "../../../shared/hooks/useToast";
import {
  demandsApi,
  PublicDemandError,
} from "../../../features/public/demandsApi.server";
import {
  EMAIL_VERIFICATION_STORAGE_KEY,
  clearEmailVerification,
  isEmailVerified,
  readEmailVerification,
  type EmailVerification,
} from "../../../features/public/emailVerificationStorage";
import {
  clearDemandDraft,
  clearDemandPending,
  readDemandDraft,
  readDemandPending,
  saveDemandDraft,
  saveDemandPending,
  type DemandPendingPayload,
} from "../../../features/public/demandDraftStorage";
import {
  getBrazilStatesSync,
  getCitiesByUfSync,
} from "../../data/brazilLocations";
import {
  getCampusOptionsSync,
  getCoursesByCampusSync,
} from "../../data/uespiCourses";
import { getViolenceTypeOptions } from "../../data/violenceTypes";

export type DemandActionData =
  | { ok: true; id: string }
  | {
      ok?: false;
      error: string;
      fieldErrors?: FormErrors;
      verificationError?: boolean;
    };

type VerificationActionResult =
  | { ok: true; message: string; debugLink?: string }
  | { ok: false; error: string };

function mapBackendFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
): FormErrors {
  const mapped: FormErrors = {};
  const getFirst = (key: string): string | undefined => {
    const arr = fieldErrors[key];
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : undefined;
  };
  const assign = (
    from: string,
    to: keyof DemandFormData | "violenceTypes" | "lgpdConsent",
  ) => {
    const msg = getFirst(from);
    if (msg) (mapped as Record<string, string>)[to] = msg;
  };
  assign("fullName", "fullName");
  assign("email", "email");
  assign("phone", "phone");
  assign("city", "city");
  assign("institutionBond", "institutionBond");
  assign("campus", "campus");
  assign("curso", "course");
  assign("course", "course");
  assign("occurrenceLocation", "occurrenceLocation");
  assign("violenceTypes", "violenceTypes");
  assign("tipoViolencia", "violenceTypes");
  assign("description", "description");
  assign("descricao", "description");
  assign("lgpdConsent", "lgpdConsent");
  return mapped;
}

export async function action({ request }: Route.ActionArgs) {
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return data<DemandActionData>(
      {
        error:
          "Não foi possível enviar sua demanda. Tente novamente em instantes.",
      },
      { status: 400 },
    );
  }

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const courseRaw = str(raw.course ?? raw.curso).trim();
  const emailVerificationToken = str(raw.emailVerificationToken).trim();

  if (raw.lgpdConsent !== true) {
    return data<DemandActionData>(
      {
        error: "Corrija os campos destacados antes de enviar.",
        fieldErrors: {
          lgpdConsent:
            "Você precisa aceitar o termo de consentimento para continuar.",
        },
      },
      { status: 400 },
    );
  }

  const payload = {
    fullName: str(raw.fullName).trim(),
    email: str(raw.email).trim(),
    phone: str(raw.phone).replace(/\D/g, ""),
    // Decisão 3: envia só a cidade; `state` serve apenas para busca local
    city: str(raw.city).trim(),
    institutionBond: str(raw.institutionBond),
    campus: str(raw.campus),
    curso: courseRaw ? courseRaw : null,
    occurrenceLocation: str(raw.occurrenceLocation),
    violenceTypes: Array.isArray(raw.violenceTypes)
      ? (raw.violenceTypes as unknown[]).filter(
          (t): t is string => typeof t === "string",
        )
      : [],
    description: str(raw.description).trim(),
    lgpdConsent: true as const,
    ...(emailVerificationToken ? { emailVerificationToken } : {}),
  };

  // Defense in depth: never hit the backend without the e-mail proof.
  if (!emailVerificationToken) {
    return data<DemandActionData>(
      {
        error: "Confirme seu e-mail antes de enviar sua demanda.",
        verificationError: true,
      },
      { status: 400 },
    );
  }

  try {
    const created = await demandsApi.createPublicDemand(payload);
    return data<DemandActionData>(
      { ok: true, id: created.id },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof PublicDemandError) {
      const verificationMessage = err.fieldErrors.emailVerificationToken?.[0];
      if (verificationMessage) {
        return data<DemandActionData>(
          { error: verificationMessage, verificationError: true },
          { status: err.status },
        );
      }
      const fieldErrors = mapBackendFieldErrors(err.fieldErrors);
      if (Object.keys(fieldErrors).length > 0) {
        // Trava "1 processo ativo por vítima" (back 409 details.email):
        // exibe a mensagem do back como erro geral + detalhe sob o e-mail.
        const isActiveProcessBlock =
          err.status === 409 &&
          typeof fieldErrors.email === "string" &&
          fieldErrors.email.length > 0;
        return data<DemandActionData>(
          {
            error: isActiveProcessBlock
              ? err.message
              : "Corrija os campos destacados antes de enviar.",
            fieldErrors,
          },
          { status: err.status },
        );
      }
      return data<DemandActionData>(
        { error: err.message },
        { status: err.status >= 400 && err.status < 600 ? err.status : 500 },
      );
    }
    return data<DemandActionData>(
      {
        error:
          "Não foi possível enviar sua demanda. Tente novamente em instantes.",
      },
      { status: 500 },
    );
  }
}

type ViolenceType = string;

interface DemandFormData {
  fullName: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  institutionBond: string;
  campus: string;
  course: string;
  occurrenceLocation: string;
  violenceTypes: ViolenceType[];
  description: string;
  lgpdConsent: boolean;
}

type FormErrors = Partial<Record<keyof DemandFormData, string>> & {
  violenceTypes?: string;
  lgpdConsent?: string;
};

const CAMPUS_OPTIONS = getCampusOptionsSync();

const INSTITUTION_BOND_OPTIONS = [
  "Discente",
  "Docente",
  "Técnico Administrativo",
];

const VIOLENCE_TYPE_OPTIONS = getViolenceTypeOptions();

const OCCURRENCE_LOCATION_OPTIONS = [
  "Dentro do campus da UESPI",
  "Fora do campus",
];

const STEPS = [
  { id: 1, title: "Identificação", subtitle: "Dados pessoais" },
  { id: 2, title: "Vínculo", subtitle: "Institucional" },
  { id: 3, title: "Ocorrência", subtitle: "Detalhes do caso" },
];

function isTecnicoAdministrativoBond(bond: string): boolean {
  return (
    bond.trim().toLowerCase() === "técnico administrativo".toLowerCase() ||
    bond.trim().toLowerCase() === "tecnico administrativo"
  );
}

const initialFormData: DemandFormData = {
  fullName: "",
  email: "",
  phone: "",
  state: "",
  city: "",
  institutionBond: "",
  campus: "",
  course: "",
  occurrenceLocation: "",
  violenceTypes: [],
  description: "",
  lgpdConsent: false,
};

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 0) return `(${ddd})`;
  if (digits.length <= 10) {
    if (rest.length <= 4) return `(${ddd}) ${rest}`;
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function validateCurrentStep(
  step: number,
  data: DemandFormData,
  citiesForState: string[] = [],
): FormErrors {
  const errors: FormErrors = {};

  if (step === 1) {
    if (!data.fullName.trim()) {
      errors.fullName = "Informe seu nome completo.";
    } else if (data.fullName.trim().length < 3) {
      errors.fullName = "Nome deve ter pelo menos 3 caracteres.";
    }

    if (!data.email.trim()) {
      errors.email = "Informe seu e-mail.";
    } else if (!validateEmail(data.email.trim())) {
      errors.email = "E-mail inválido. Verifique o formato.";
    }

    if (!data.phone.trim()) {
      errors.phone = "Informe seu telefone para contato.";
    } else {
      const digits = data.phone.replace(/\D/g, "");
      if (digits.length < 10) {
        errors.phone = "Telefone incompleto. Confira o DDD + número.";
      } else if (/^(\d)\1+$/.test(digits)) {
        errors.phone = "Telefone inválido. Confira os dígitos.";
      } else {
        const ddd = Number(digits.slice(0, 2));
        if (ddd < 11 || ddd > 99) {
          errors.phone = "DDD inválido. Confira o código da sua região.";
        } else if (digits.length === 11 && digits[2] !== "9") {
          errors.phone = "Celular deve ter 9 após o DDD. Confira o número.";
        }
      }
    }

    if (!data.state.trim()) {
      errors.state = "Selecione o estado.";
    }

    if (!data.city.trim()) {
      errors.city = "Selecione sua cidade.";
    } else if (data.city.trim().length < 2) {
      errors.city = "Cidade inválida.";
    } else if (
      citiesForState.length > 0 &&
      !citiesForState.includes(data.city.trim())
    ) {
      errors.city = "Selecione uma cidade válida da lista.";
    }
  }

  if (step === 2) {
    if (!data.institutionBond) {
      errors.institutionBond = "Selecione seu vínculo com a instituição.";
    }
    if (!data.campus) {
      errors.campus = "Selecione o campus.";
    }
    const isTecnico = isTecnicoAdministrativoBond(data.institutionBond);
    if (isTecnico) {
      if (data.course.trim()) {
        errors.course = "Curso não se aplica para técnico administrativo.";
      }
    } else if (!data.course.trim()) {
      errors.course = "Selecione o curso.";
    } else if (data.course.trim().length < 2) {
      errors.course = "Curso inválido.";
    } else {
      const coursesForCampus = getCoursesByCampusSync(data.campus);
      if (
        coursesForCampus.length > 0 &&
        !coursesForCampus.includes(data.course.trim())
      ) {
        errors.course = "Selecione um curso válido para o campus escolhido.";
      }
    }
  }

  if (step === 3) {
    if (!data.occurrenceLocation) {
      errors.occurrenceLocation = "Selecione o local do ocorrido.";
    }

    if (data.violenceTypes.length === 0) {
      errors.violenceTypes = "Selecione pelo menos um tipo de violência.";
    }

    if (!data.description.trim()) {
      errors.description = "Descreva brevemente o ocorrido.";
    } else if (data.description.trim().length < 10) {
      errors.description =
        "Descrição muito curta. Informe mais detalhes (mín. 10 caracteres).";
    } else if (data.description.trim().length > 2000) {
      errors.description = "Descrição muito longa (máx. 2000 caracteres).";
    }

    if (!data.lgpdConsent) {
      errors.lgpdConsent =
        "Você precisa aceitar o termo de consentimento para continuar.";
    }
  }

  return errors;
}

function validateAll(
  data: DemandFormData,
  citiesForState: string[] = [],
): FormErrors {
  return {
    ...validateCurrentStep(1, data, citiesForState),
    ...validateCurrentStep(2, data, citiesForState),
    ...validateCurrentStep(3, data, citiesForState),
  };
}

export default function DemandPage() {
  const navigate = useNavigate();
  const fetcher = useFetcher<DemandActionData>();
  const verificationFetcher = useFetcher<VerificationActionResult>();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<DemandFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const isSubmitting = fetcher.state !== "idle";
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState<
    Partial<Record<keyof DemandFormData, boolean>>
  >({});
  const [verification, setVerification] = useState<EmailVerification | null>(
    null,
  );
  const [verificationNotice, setVerificationNotice] = useState<string | null>(
    null,
  );
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [resendCooldown, setResendCooldown] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [pendingPayload, setPendingPayload] =
    useState<DemandPendingPayload | null>(null);
  const lastSubmittedTokenRef = useRef<string | null>(null);
  const { toast, showToast } = useToast();

  const totalSteps = STEPS.length;
  const emailVerified = isEmailVerified(formData.email, verification);

  const states = useMemo(() => getBrazilStatesSync(), []);
  const cities = useMemo(
    () => getCitiesByUfSync(formData.state),
    [formData.state],
  );
  const courses = useMemo(
    () => getCoursesByCampusSync(formData.campus),
    [formData.campus],
  );

  useEffect(() => {
    setHasAttemptedSubmit(false);
  }, [currentStep]);

  // Restore the draft (registration fields only), the e-mail verification and
  // any pending submission when returning from the confirmation link or after
  // an accidental reload.
  useEffect(() => {
    const draft = readDemandDraft();
    if (draft) {
      setFormData((prev) => ({ ...prev, ...draft }));
    }
    setVerification(readEmailVerification());

    const pending = readDemandPending();
    if (pending) {
      setPendingPayload(pending.payload);
      setAwaitingVerification(true);
    }

    setDraftRestored(true);
  }, []);

  useEffect(() => {
    if (!draftRestored) return;
    const timeoutId = window.setTimeout(() => {
      saveDemandDraft({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        state: formData.state,
        city: formData.city,
        institutionBond: formData.institutionBond,
        campus: formData.campus,
        course: formData.course,
      });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [draftRestored, formData]);

  // The link may be opened in another tab: sync without reloading the page.
  useEffect(() => {
    function syncVerification() {
      setVerification(readEmailVerification());
    }
    function handleStorage(event: StorageEvent) {
      if (event.key === EMAIL_VERIFICATION_STORAGE_KEY) syncVerification();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") syncVerification();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", syncVerification);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", syncVerification);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (verificationFetcher.state !== "idle" || !verificationFetcher.data) {
      return;
    }
    const result = verificationFetcher.data;
    if (result.ok) {
      setVerificationError(null);
      setVerificationNotice(result.message);
      setResendCooldown(60);
    } else {
      setVerificationNotice(null);
      setVerificationError(result.error);
    }
  }, [verificationFetcher.state, verificationFetcher.data]);

  // Post-submit gate: as soon as a fresh confirmation token is available for
  // the pending e-mail, the demand is submitted automatically.
  useEffect(() => {
    if (!awaitingVerification) return;
    if (!emailVerified || !verification) return;
    if (fetcher.state !== "idle") return;
    if (lastSubmittedTokenRef.current === verification.token) return;

    lastSubmittedTokenRef.current = verification.token;
    const payload =
      pendingPayload ??
      ({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.replace(/\D/g, ""),
        city: formData.city.trim(),
        institutionBond: formData.institutionBond,
        campus: formData.campus,
        course: isTecnicoAdministrativoBond(formData.institutionBond)
          ? ""
          : formData.course.trim(),
        occurrenceLocation: formData.occurrenceLocation,
        violenceTypes: formData.violenceTypes,
        description: formData.description.trim(),
        lgpdConsent: formData.lgpdConsent,
      } satisfies DemandPendingPayload);

    // Pending payload stays until success/cancel so a rejected token can be
    // re-confirmed and the demand resubmitted automatically.
    fetcher.submit(
      { ...payload, emailVerificationToken: verification.token },
      { method: "post", action: "/demanda", encType: "application/json" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    awaitingVerification,
    emailVerified,
    verification,
    pendingPayload,
    fetcher.state,
  ]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timeoutId = window.setTimeout(
      () => setResendCooldown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [resendCooldown]);

  function markTouched(field: keyof DemandFormData) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  function shouldShowError(field: keyof DemandFormData): boolean {
    return Boolean(errors[field] && (touched[field] || hasAttemptedSubmit));
  }

  function updateField<K extends keyof DemandFormData>(
    field: K,
    value: DemandFormData[K],
  ) {
    if (field === "state") {
      const nextState = String(value).toUpperCase();
      setFormData((prev) =>
        prev.state === nextState
          ? prev
          : { ...prev, state: nextState, city: "" },
      );
      setErrors((prev) => {
        const next = { ...prev };
        delete next.state;
        delete next.city;
        return next;
      });
      return;
    }
    if (field === "institutionBond") {
      const nextBond = String(value);
      setFormData((prev) => {
        if (prev.institutionBond === nextBond) return prev;
        // Técnico administrativo não possui curso: limpa ao selecionar.
        if (isTecnicoAdministrativoBond(nextBond)) {
          return { ...prev, institutionBond: nextBond, course: "" };
        }
        return { ...prev, institutionBond: nextBond };
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.institutionBond;
        if (isTecnicoAdministrativoBond(nextBond)) delete next.course;
        return next;
      });
      return;
    }
    if (field === "campus") {
      const nextCampus = String(value);
      setFormData((prev) =>
        prev.campus === nextCampus
          ? prev
          : { ...prev, campus: nextCampus, course: "" },
      );
      setErrors((prev) => {
        const next = { ...prev };
        delete next.campus;
        delete next.course;
        return next;
      });
      return;
    }
    if (field === "email") {
      const nextEmail = String(value);
      setFormData((prev) => ({ ...prev, email: nextEmail }));
      if (verification && !isEmailVerified(nextEmail, verification)) {
        setVerification(null);
        clearEmailVerification();
        setVerificationNotice(null);
        setVerificationError(null);
      }
      // A pending submission is tied to the e-mail that was confirmed; editing
      // the e-mail invalidates it and the user starts the gate again.
      setPendingPayload(null);
      clearDemandPending();
      setAwaitingVerification(false);
      setErrors((prev) => {
        if (!prev.email) return prev;
        const next = { ...prev };
        delete next.email;
        return next;
      });
      return;
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field] || (field === "violenceTypes" && errors.violenceTypes)) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        if (field === "violenceTypes") delete next.violenceTypes;
        return next;
      });
    }
  }

  function toggleViolenceType(type: string) {
    markTouched("violenceTypes");
    setFormData((prev) => {
      const exists = prev.violenceTypes.includes(type);
      const nextTypes = exists
        ? prev.violenceTypes.filter((t) => t !== type)
        : [...prev.violenceTypes, type];
      return { ...prev, violenceTypes: nextTypes };
    });
    if (errors.violenceTypes) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.violenceTypes;
        return next;
      });
    }
  }

  function requestVerificationLink(email: string) {
    setVerificationError(null);
    setVerificationNotice(null);
    verificationFetcher.submit(
      { email },
      {
        method: "post",
        action: "/verificar-email",
        encType: "application/json",
      },
    );
  }

  function snapshotDemandPayload(): DemandPendingPayload {
    return {
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.replace(/\D/g, ""),
      city: formData.city.trim(),
      institutionBond: formData.institutionBond,
      campus: formData.campus,
      course: isTecnicoAdministrativoBond(formData.institutionBond)
        ? ""
        : formData.course.trim(),
      occurrenceLocation: formData.occurrenceLocation,
      violenceTypes: formData.violenceTypes,
      description: formData.description.trim(),
      lgpdConsent: formData.lgpdConsent,
    };
  }

  function enterVerificationGate(payload: DemandPendingPayload) {
    setPendingPayload(payload);
    saveDemandPending(payload);
    setAwaitingVerification(true);
    setVerificationError(null);
    setVerificationNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitDemand() {
    if (emailVerified && verification) {
      fetcher.submit(
        {
          ...snapshotDemandPayload(),
          emailVerificationToken: verification.token,
        },
        { method: "post", action: "/demanda", encType: "application/json" },
      );
      return;
    }

    // Post-submit gate: keep the full payload and ask for e-mail confirmation;
    // the demand is submitted automatically once the token is confirmed.
    enterVerificationGate(snapshotDemandPayload());
    requestVerificationLink(formData.email.trim());
  }

  function handleReturnToForm() {
    setAwaitingVerification(false);
    setPendingPayload(null);
    clearDemandPending();
    setVerificationNotice(null);
    setVerificationError(null);
  }

  function handleNext() {
    const stepErrors = validateCurrentStep(currentStep, formData, cities);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      showToast("Verifique os campos destacados antes de continuar.", "error");
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

  function handleEmergencyExit() {
    clearDemandDraft();
    clearDemandPending();
    clearEmailVerification();
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

  function focusStepForErrors(errs: FormErrors) {
    if (errs.fullName || errs.email || errs.phone || errs.state || errs.city) {
      setCurrentStep(1);
    } else if (errs.institutionBond || errs.campus || errs.course) {
      setCurrentStep(2);
    } else {
      setCurrentStep(3);
    }
  }

  useEffect(() => {
    const actionData = fetcher.data;
    if (fetcher.state !== "idle" || !actionData) return;
    if ("ok" in actionData && actionData.ok) {
      setIsSuccess(true);
      setVerification(null);
      setAwaitingVerification(false);
      setPendingPayload(null);
      clearDemandDraft();
      clearDemandPending();
      clearEmailVerification();
      showToast("Demanda enviada com sucesso!", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if ("error" in actionData && actionData.error) {
      if (actionData.verificationError) {
        // Token rejected (expired/used/mismatch): drop it and keep waiting for
        // a fresh confirmation — the pending payload is preserved.
        setVerification(null);
        clearEmailVerification();
        setVerificationError(actionData.error);
        setVerificationNotice(null);
        setErrors({});
        setAwaitingVerification(true);
        if (!pendingPayload) {
          const payload = snapshotDemandPayload();
          setPendingPayload(payload);
          saveDemandPending(payload);
        }
        showToast(actionData.error, "error");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // Any other error returns the user to the form with the context.
      setAwaitingVerification(false);
      setPendingPayload(null);
      clearDemandPending();
      if (
        actionData.fieldErrors &&
        Object.keys(actionData.fieldErrors).length > 0
      ) {
        setErrors(actionData.fieldErrors);
        setHasAttemptedSubmit(true);
        focusStepForErrors(actionData.fieldErrors);
        // Trava "1 processo ativo" (409 details.email): o action já traz a
        // mensagem do back como error — exibe ela no toast, não o genérico.
        showToast(
          actionData.fieldErrors.email
            ? actionData.error
            : "Corrija os campos destacados antes de enviar.",
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
    const allErrors = validateAll(formData, cities);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      focusStepForErrors(allErrors);
      showToast("Corrija os campos destacados antes de enviar.", "error");
      return;
    }

    submitDemand();
  }

  function handleStepClick(stepId: number) {
    if (stepId < currentStep) {
      setErrors({});
      setCurrentStep(stepId);
    } else if (stepId > currentStep) {
      const combinedErrors: FormErrors = {};
      for (let s = currentStep; s < stepId; s++) {
        Object.assign(combinedErrors, validateCurrentStep(s, formData, cities));
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
            Demanda registrada com sucesso
          </h1>
          <p className="text-gray-600 mb-2">
            Recebemos sua demanda e ela foi encaminhada ao{" "}
            <span className="font-medium text-gray-800">
              gestor responsável
            </span>{" "}
            para análise.
          </p>
          <p className="text-gray-600 text-sm mb-6">
            Em breve você receberá um e-mail com um link para completar seu
            cadastro e acompanhar o processo. Seus dados estão protegidos e em
            sigilo.
          </p>

          <div className="bg-[#E6F1FB] rounded-lg p-4 text-left mb-8">
            <p className="text-sm font-medium text-[#0C447C] mb-2">
              Próximos passos:
            </p>
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
              <li>Aguarde o contato do NEVIM (e-mail).</li>
              <li>Acesse o link enviado para completar seu cadastro.</li>
              <li>O gestor agendará sua primeira consulta de triagem.</li>
            </ol>
          </div>

          <div className="flex justify-center">
            <Button
              variant="primary"
              onClick={() => navigate("/")}
              className="h-11 px-8"
            >
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (awaitingVerification) {
    return (
      <div className="max-w-3xl mx-auto px-2 lg:px-0">
        <div className="bg-white rounded-xl shadow-lg p-8 lg:p-10 text-center border border-stone-200">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#E6F1FB] flex items-center justify-center mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0C447C"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </div>

          <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-3">
            Confirme seu e-mail para enviar
          </h1>
          <p className="text-gray-600 mb-2">
            Enviamos um link de confirmação para{" "}
            <span className="font-medium text-gray-800">
              {formData.email.trim() || "seu e-mail"}
            </span>
            .
          </p>
          <p className="text-gray-600 text-sm mb-6">
            Após confirmar que este e-mail é seu, sua demanda será enviada
            automaticamente ao NEVIM.
          </p>

          <div className="space-y-3 mb-6" aria-live="polite">
            {emailVerified ? (
              <p className="text-sm text-[#27500A] bg-[#EAF3DE] rounded-md p-3">
                E-mail confirmado! Enviando sua demanda…
              </p>
            ) : verificationNotice ? (
              <p
                className="text-sm text-[#0C447C] bg-[#E6F1FB] rounded-md p-3 leading-relaxed"
                role="status"
              >
                {verificationNotice} O link vale por 24 horas. Abra a mensagem e
                clique no link; se ela abrir em outra aba, o envio acontece
                automaticamente nesta tela.
              </p>
            ) : null}

            {verificationError && (
              <p
                className="text-sm text-red-700 bg-[#FCEBEB] rounded-md p-3"
                role="alert"
              >
                {verificationError}
              </p>
            )}

            {!emailVerified && !verificationNotice && !verificationError && (
              <p className="text-sm text-gray-500">
                Aguardando a confirmação do e-mail…
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => requestVerificationLink(formData.email.trim())}
              loading={verificationFetcher.state !== "idle"}
              disabled={
                verificationFetcher.state !== "idle" || resendCooldown > 0
              }
              className="h-11 px-6 whitespace-nowrap bg-white border-gray-300 text-gray-700 hover:bg-stone-50"
            >
              {resendCooldown > 0
                ? `Reenviar em ${resendCooldown}s`
                : "Reenviar link"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReturnToForm}
              className="h-11 px-6 whitespace-nowrap bg-white border-gray-300 text-gray-700 hover:bg-stone-50"
            >
              Voltar e editar
            </Button>
          </div>
        </div>

        <Toast toast={toast} />
        <LoadingOverlay open={isSubmitting} message="Enviando sua demanda..." />
        <EmergencyExitButton onExit={handleEmergencyExit} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-2 lg:px-0">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800">
          Registrar demanda espontânea
        </h1>
        <p className="text-gray-600 mt-2 text-sm lg:text-base leading-relaxed">
          Preencha os dados abaixo para solicitar atendimento no{" "}
          <span className="font-medium text-gray-800">NEVIM</span>. Seus dados
          são <span className="font-medium">confidenciais</span> e protegidos.
        </p>
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

      {/* Form Card - similar to login style but responsive */}
      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        noValidate
        className="bg-blue-200 rounded-xl p-6 lg:p-10 shadow-inner"
        aria-label="Formulário de demanda espontânea"
      >
        {/* Step 1 - Identificação */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Identificação
              </h2>
              <p className="text-sm text-gray-600">
                Informe seus dados pessoais para contato.
              </p>
            </div>

            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Nome completo <span className="text-red-600">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Ex: Maria Silva"
                value={formData.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                className={`w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all placeholder:text-gray-400 ${
                  errors.fullName
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
                }`}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={
                  errors.fullName ? "error-fullName" : undefined
                }
              />
              {errors.fullName && (
                <p id="error-fullName" className="text-red-700 text-xs mt-1.5">
                  {errors.fullName}
                </p>
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
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
                  placeholder="seuemail@gmail.com"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className={`w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all placeholder:text-gray-400 ${
                    errors.email
                      ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
                  }`}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "error-email" : undefined}
                />
                {errors.email && (
                  <p id="error-email" className="text-red-700 text-xs mt-1.5">
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Telefone <span className="text-red-600">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={15}
                  placeholder="(86) 99999-9999"
                  value={formData.phone}
                  onChange={(e) =>
                    updateField("phone", formatPhoneDisplay(e.target.value))
                  }
                  onBlur={() => markTouched("phone")}
                  className={`w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all placeholder:text-gray-400 ${
                    shouldShowError("phone")
                      ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
                  }`}
                  aria-invalid={Boolean(shouldShowError("phone"))}
                  aria-describedby={
                    shouldShowError("phone") ? "error-phone" : "hint-phone"
                  }
                />
                {shouldShowError("phone") ? (
                  <p id="error-phone" className="text-red-700 text-xs mt-1.5">
                    {errors.phone}
                  </p>
                ) : (
                  <p id="hint-phone" className="text-xs text-gray-500 mt-1.5">
                    Usado apenas para retorno do NEVIM, com sigilo.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="state"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Estado <span className="text-red-600">*</span>
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
                  className={`w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all disabled:opacity-60 ${
                    shouldShowError("state")
                      ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
                  } text-gray-700`}
                  aria-invalid={Boolean(shouldShowError("state"))}
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
                  <p id="error-state" className="text-red-700 text-xs mt-1.5">
                    {errors.state}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="city"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Cidade <span className="text-red-600">*</span>
                </label>
                <CityCombobox
                  id="city"
                  value={formData.city}
                  cities={cities}
                  disabled={!formData.state}
                  hasError={shouldShowError("city")}
                  placeholder={
                    !formData.state
                      ? "Selecione o estado primeiro"
                      : "Ex: Teresina — digite para buscar"
                  }
                  onChange={(next) => {
                    updateField("city", next);
                    markTouched("city");
                  }}
                  onBlur={() => markTouched("city")}
                />
                {shouldShowError("city") && (
                  <p id="error-city" className="text-red-700 text-xs mt-1.5">
                    {errors.city}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-[#E6F1FB] rounded-lg p-3 border border-[#E6F1FB]">
              <p className="text-xs text-[#0C447C] flex gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 flex-shrink-0 mt-[1px]"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5.5a.75.75 0 001.5 0V5zm0 9a.75.75 0 10-1.5 0 .75.75 0 001.5 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Seus dados de contato serão usados apenas para retorno do NEVIM
                sobre sua demanda, com sigilo absoluto.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 - Vínculo */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Vínculo institucional
              </h2>
              <p className="text-sm text-gray-600">
                Informe sua relação com a UESPI.
              </p>
            </div>

            <div>
              <label
                htmlFor="institutionBond"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Vínculo com a instituição{" "}
                <span className="text-red-600">*</span>
              </label>
              <select
                id="institutionBond"
                name="institutionBond"
                value={formData.institutionBond}
                onChange={(e) => updateField("institutionBond", e.target.value)}
                className={`w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all ${
                  errors.institutionBond
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
                } text-gray-700`}
                aria-invalid={Boolean(errors.institutionBond)}
                aria-describedby={
                  errors.institutionBond ? "error-bond" : undefined
                }
              >
                <option value="">Selecione</option>
                {INSTITUTION_BOND_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {errors.institutionBond && (
                <p id="error-bond" className="text-red-700 text-xs mt-1.5">
                  {errors.institutionBond}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="campus"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Campus <span className="text-red-600">*</span>
              </label>
              <select
                id="campus"
                name="campus"
                value={formData.campus}
                onChange={(e) => updateField("campus", e.target.value)}
                className={`w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all ${
                  errors.campus
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
                } text-gray-700`}
                aria-invalid={Boolean(errors.campus)}
                aria-describedby={errors.campus ? "error-campus" : undefined}
              >
                <option value="">Selecione o campus</option>
                {CAMPUS_OPTIONS.map((campus) => (
                  <option key={campus} value={campus}>
                    {campus}
                  </option>
                ))}
              </select>
              {errors.campus && (
                <p id="error-campus" className="text-red-700 text-xs mt-1.5">
                  {errors.campus}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1.5">
                Selecione o campus ao qual você está vinculada ou onde ocorreu o
                fato. Se não se aplica, escolha “Outro / Não se aplica”.
              </p>
            </div>

            <div>
              <label
                htmlFor="course"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Curso{" "}
                {isTecnicoAdministrativoBond(
                  formData.institutionBond,
                ) ? null : (
                  <span className="text-red-600">*</span>
                )}
              </label>
              <select
                id="course"
                name="course"
                value={formData.course}
                disabled={
                  !formData.campus ||
                  isTecnicoAdministrativoBond(formData.institutionBond)
                }
                onChange={(e) => updateField("course", e.target.value)}
                onBlur={() => markTouched("course")}
                className={`w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-70 ${
                  errors.course
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
                } text-gray-700`}
                aria-invalid={Boolean(errors.course)}
                aria-disabled={isTecnicoAdministrativoBond(
                  formData.institutionBond,
                )}
                aria-describedby={
                  errors.course ? "error-course" : "hint-course"
                }
              >
                <option value="">
                  {isTecnicoAdministrativoBond(formData.institutionBond)
                    ? "Não se aplica para técnico administrativo"
                    : !formData.campus
                      ? "Selecione o campus primeiro"
                      : "Selecione o curso"}
                </option>
                {courses.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
              {errors.course ? (
                <p id="error-course" className="text-red-700 text-xs mt-1.5">
                  {errors.course}
                </p>
              ) : (
                <p id="hint-course" className="text-xs text-gray-500 mt-1.5">
                  {isTecnicoAdministrativoBond(formData.institutionBond)
                    ? "Técnico administrativo não possui curso vinculado."
                    : "Apenas cursos do campus selecionado são exibidos."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3 - Ocorrência */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Sobre a ocorrência
              </h2>
              <p className="text-sm text-gray-600">
                Descreva o ocorrido. Essas informações são essenciais para
                triagem e acolhimento.
              </p>
            </div>

            <div>
              <label
                htmlFor="occurrenceLocation"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Local do ocorrido <span className="text-red-600">*</span>
              </label>
              <select
                id="occurrenceLocation"
                name="occurrenceLocation"
                value={formData.occurrenceLocation}
                onChange={(e) =>
                  updateField("occurrenceLocation", e.target.value)
                }
                onBlur={() => markTouched("occurrenceLocation")}
                className={`w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all ${
                  shouldShowError("occurrenceLocation")
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
                } text-gray-700`}
                aria-invalid={Boolean(shouldShowError("occurrenceLocation"))}
                aria-describedby={
                  shouldShowError("occurrenceLocation")
                    ? "error-occurrenceLocation"
                    : undefined
                }
              >
                <option value="">Selecione</option>
                {OCCURRENCE_LOCATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {shouldShowError("occurrenceLocation") && (
                <p
                  id="error-occurrenceLocation"
                  className="text-red-700 text-xs mt-1.5"
                >
                  {errors.occurrenceLocation}
                </p>
              )}
            </div>

            <div>
              <fieldset
                aria-describedby={
                  shouldShowError("violenceTypes")
                    ? "error-violenceTypes"
                    : undefined
                }
              >
                <legend className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de violência <span className="text-red-600">*</span>
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {VIOLENCE_TYPE_OPTIONS.map((type) => {
                    const checked = formData.violenceTypes.includes(type);
                    return (
                      <label
                        key={type}
                        className={`flex items-center gap-2.5 bg-white rounded-md px-3 py-2.5 cursor-pointer border shadow-sm transition-all select-none
                          ${checked ? "border-[#378ADD] bg-[#E6F1FB] ring-1 ring-[#378ADD]" : "border-transparent hover:border-gray-200"}
                          ${shouldShowError("violenceTypes") ? "border-red-200" : ""}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleViolenceType(type)}
                          onBlur={() => markTouched("violenceTypes")}
                          className="w-4 h-4 rounded border-gray-300 text-[#378ADD] focus:ring-[#378ADD] accent-[#378ADD]"
                        />
                        <span
                          className={`text-sm ${checked ? "text-[#0C447C] font-medium" : "text-gray-700"}`}
                        >
                          {type}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {shouldShowError("violenceTypes") && (
                  <p
                    id="error-violenceTypes"
                    className="text-red-700 text-xs mt-1.5"
                  >
                    {errors.violenceTypes}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1.5">
                  Selecione um ou mais. Detalhe na descrição o ocorrido.
                </p>
              </fieldset>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Descrição do ocorrido <span className="text-red-600">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                placeholder="Descreva com suas palavras o que aconteceu, quando e onde ocorreu, e outras informações que julgar importantes. Seja objetiva, mas inclua detalhes relevantes para acolhimento."
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                onBlur={() => markTouched("description")}
                maxLength={2000}
                className={`w-full bg-white p-3 rounded-md outline-none shadow-inner border text-sm transition-all placeholder:text-gray-400 resize-none ${
                  shouldShowError("description")
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
                }`}
                aria-invalid={Boolean(shouldShowError("description"))}
                aria-describedby={
                  shouldShowError("description")
                    ? "error-description"
                    : "hint-description"
                }
              />
              <div className="flex justify-between mt-1.5">
                <div>
                  {shouldShowError("description") ? (
                    <p id="error-description" className="text-red-700 text-xs">
                      {errors.description}
                    </p>
                  ) : (
                    <p id="hint-description" className="text-xs text-gray-500">
                      Mínimo 10 caracteres.
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs ${formData.description.length > 1900 ? "text-amber-600" : "text-gray-400"}`}
                >
                  {formData.description.length}/2000
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
              <div className="bg-[#E6F1FB] px-4 py-3 border-b border-stone-200">
                <h3 className="text-sm font-semibold text-[#0C447C]">
                  Termo de Consentimento
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Leia com atenção antes de enviar sua demanda. O aceite é
                  obrigatório.
                </p>
              </div>

              <div className="max-h-64 overflow-y-auto p-4 text-xs leading-relaxed text-gray-700 space-y-4 bg-stone-50/50">
                <section>
                  <h4 className="font-semibold text-gray-800 text-xs">
                    1. Finalidade do tratamento dos dados
                  </h4>
                  <p className="mt-1">
                    Os dados fornecidos neste formulário serão utilizados
                    exclusivamente para:
                  </p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 ml-1">
                    <li>
                      Registro, triagem e acompanhamento psicossocial do seu
                      caso;
                    </li>
                    <li>
                      Agendamento e realização de atendimentos com profissionais
                      do NEVIM;
                    </li>
                    <li>
                      Geração de estatísticas internas e anônimas para melhoria
                      dos serviços;
                    </li>
                    <li>
                      Cumprimento de obrigações legais e institucionais da
                      UESPI.
                    </li>
                  </ul>
                </section>

                <section>
                  <h4 className="font-semibold text-gray-800 text-xs">
                    2. Dados coletados
                  </h4>
                  <p className="mt-1">
                    Serão coletadas informações como nome, telefone, e-mail,
                    vínculo com a instituição, campus, tipo de violência
                    sofrida, descrição do ocorrido e demais respostas fornecidas
                    voluntariamente durante o formulário de demanda e possíveis
                    etapas posteriores (ex.: formulário FRIDA).
                  </p>
                </section>

                <section>
                  <h4 className="font-semibold text-gray-800 text-xs">
                    3. Compartilhamento
                  </h4>
                  <p className="mt-1">
                    Seus dados poderão ser acessados apenas por profissionais e
                    gestores do NEVIM diretamente envolvidos no seu atendimento,
                    respeitando o sigilo profissional e as normas da LGPD.
                    Nenhuma informação será compartilhada com terceiros sem sua
                    autorização expressa, exceto por determinação legal ou para
                    efetivação de encaminhamentos institucionais previamente
                    acordados.
                  </p>
                </section>

                <section>
                  <h4 className="font-semibold text-gray-800 text-xs">
                    4. Armazenamento e segurança
                  </h4>
                  <p className="mt-1">
                    As informações serão armazenadas em ambiente seguro, com
                    controle de acesso restrito e criptografia. O NEVIM adota
                    medidas técnicas e organizacionais para proteger seus dados
                    contra perda, roubo, uso indevido ou acesso não autorizado.
                  </p>
                </section>

                <section>
                  <h4 className="font-semibold text-gray-800 text-xs">
                    5. Seus direitos
                  </h4>
                  <p className="mt-1">Você pode, a qualquer momento:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 ml-1">
                    <li>
                      Solicitar acesso, correção ou exclusão dos seus dados
                      pessoais;
                    </li>
                    <li>
                      Revogar este consentimento, com efeitos para futuro;
                    </li>
                    <li>
                      Solicitar informações sobre o tratamento dos seus dados.
                    </li>
                  </ul>
                  <p className="mt-2">
                    Para exercer esses direitos, entre em contato com a
                    coordenação do NEVIM pelo e-mail{" "}
                    <a
                      href="mailto:nevim@uespi.br"
                      className="text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
                    >
                      nevim@uespi.br
                    </a>{" "}
                    ou pelo telefone{" "}
                    <a
                      href="tel:+558699471-9244"
                      className="text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
                    >
                      (86) 99471-9244
                    </a>
                    .
                  </p>
                </section>

                <section>
                  <h4 className="font-semibold text-gray-800 text-xs">
                    6. Botão de saída rápida
                  </h4>
                  <p className="mt-1">
                    Você tem disponível, em todas as telas da área da vítima, um
                    botão de saída rápida que redireciona para uma página neutra
                    sem salvar o progresso, garantindo sua segurança em
                    situações de risco.
                  </p>
                </section>

                <section>
                  <h4 className="font-semibold text-gray-800 text-xs">
                    7. Obrigatoriedade e recusa
                  </h4>
                  <p className="mt-1">
                    O preenchimento dos dados é voluntário, mas necessário para
                    o início do seu atendimento. Caso não concorde com este
                    termo, não será possível dar continuidade ao registro da
                    demanda.
                  </p>
                </section>
              </div>

              <label
                htmlFor="lgpdConsent"
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-t transition-colors ${shouldShowError("lgpdConsent") ? "bg-[#FCEBEB] border-red-200" : "bg-white border-stone-200 hover:bg-stone-50"}`}
              >
                <input
                  id="lgpdConsent"
                  name="lgpdConsent"
                  type="checkbox"
                  checked={formData.lgpdConsent}
                  onChange={(e) => updateField("lgpdConsent", e.target.checked)}
                  onBlur={() => markTouched("lgpdConsent")}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#378ADD] focus:ring-[#378ADD] accent-[#378ADD] flex-shrink-0"
                  aria-invalid={Boolean(shouldShowError("lgpdConsent"))}
                  aria-describedby={
                    shouldShowError("lgpdConsent")
                      ? "error-lgpdConsent"
                      : undefined
                  }
                  required
                />
                <span className="text-sm leading-snug text-gray-700">
                  Li e concordo com o Termo de Consentimento acima e autorizo o
                  tratamento dos meus dados pelo NEVIM/UESPI para as finalidades
                  descritas. <span className="text-red-600">*</span>
                </span>
              </label>
              {shouldShowError("lgpdConsent") && (
                <p
                  id="error-lgpdConsent"
                  className="px-4 pb-3 text-xs text-red-700 bg-white"
                >
                  {errors.lgpdConsent}
                </p>
              )}
            </div>
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
              {isSubmitting ? "Enviando..." : "Enviar demanda"}
            </Button>
          )}
        </div>

        <p className="text-xs text-center text-gray-500 mt-6">
          Etapa {currentStep} de {totalSteps} • Campos marcados com{" "}
          <span className="text-red-600">*</span> são obrigatórios
        </p>
        <EmergencyExitButton onExit={handleEmergencyExit} />
      </form>

      {/* Toast global - RFF12 */}
      <Toast toast={toast} />

      {/* Loading overlay - RFF11 */}
      <LoadingOverlay open={isSubmitting} message="Enviando sua demanda..." />
    </div>
  );
}
