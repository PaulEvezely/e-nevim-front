import { getApiBaseUrl } from "../../libs/api.server";

export type PublicDemandPayload = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  institutionBond: string;
  campus: string;
  curso: string | null;
  occurrenceLocation: string;
  violenceTypes: string[];
  description: string;
  lgpdConsent: true;
  emailVerificationToken?: string;
};

export type PublicDemandSuccess = {
  id: string;
  tipoViolencia: string;
  descricao: string;
  status: string;
  criadoEm: string;
};

export type BackendFieldErrors = Record<string, string[]>;

export class PublicDemandError extends Error {
  status: number;
  fieldErrors: BackendFieldErrors;
  formErrors: string[];

  constructor(
    message: string,
    opts: { status: number; fieldErrors?: BackendFieldErrors; formErrors?: string[] },
  ) {
    super(message);
    this.name = "PublicDemandError";
    this.status = opts.status;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.formErrors = opts.formErrors ?? [];
  }
}

function getBaseUrl(): string {
  try {
    return getApiBaseUrl();
  } catch {
    throw new PublicDemandError("Serviço de demandas indisponível.", {
      status: 503,
    });
  }
}

export const demandsApi = {
  async createPublicDemand(
    payload: PublicDemandPayload,
  ): Promise<PublicDemandSuccess> {
    let res: Response;
    try {
      res = await fetch(`${getBaseUrl()}/demands/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new PublicDemandError(
        "Não foi possível enviar sua demanda. Tente novamente em instantes.",
        { status: 503 },
      );
    }

    if (res.ok) {
      return (await res.json()) as PublicDemandSuccess;
    }

    const body = await res.json().catch(() => null);
    const details = body?.details as
      | {
          formErrors?: string[];
          fieldErrors?: BackendFieldErrors;
          vinculo?: unknown;
          emailVerificationToken?: unknown;
          email?: unknown;
        }
      | undefined;

    // Caso especial: vínculo inválido vem como { details: { vinculo } }, sem fieldErrors
    const fieldErrors: BackendFieldErrors = { ...(details?.fieldErrors ?? {}) };
    if (Object.keys(fieldErrors).length === 0 && details?.vinculo) {
      fieldErrors.institutionBond = [
        "Vínculo inválido. Selecione uma opção válida.",
      ];
    }

    // Rejected e-mail proof also arrives outside `fieldErrors`. Replace the
    // backend's technical wording with user-facing guidance.
    if (
      Object.keys(fieldErrors).length === 0 &&
      typeof details?.emailVerificationToken === "string"
    ) {
      fieldErrors.emailVerificationToken = [
        "Confirme seu e-mail antes de enviar sua demanda. Solicite um novo link de confirmação.",
      ];
    }

    // Trava "1 processo ativo por vítima" (back c159f10): 409 com
    // details.email (array) fora de fieldErrors. Preserva o texto do back
    // para exibir sob o campo de e-mail.
    if (Object.keys(fieldErrors).length === 0 && details?.email !== undefined) {
      const rawEmail = details.email;
      const messages = Array.isArray(rawEmail)
        ? rawEmail.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
        : typeof rawEmail === "string" && rawEmail.trim().length > 0
          ? [rawEmail]
          : [];
      if (messages.length > 0) {
        fieldErrors.email = messages;
      }
    }

    const serverMessage =
      typeof (body as { error?: unknown } | null)?.error === "string" &&
      ((body as { error: string }).error.trim().length > 0)
        ? (body as { error: string }).error.trim()
        : null;
    const isActiveProcessBlock =
      res.status === 409 && (fieldErrors.email?.length ?? 0) > 0;

    throw new PublicDemandError(
      isActiveProcessBlock && serverMessage
        ? serverMessage
        : "Não foi possível enviar sua demanda. Tente novamente em instantes.",
      {
        status: res.status,
        fieldErrors,
        formErrors: details?.formErrors ?? [],
      },
    );
  },
};
