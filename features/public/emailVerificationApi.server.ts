import { getApiBaseUrl } from "../../libs/api.server";

export type EmailVerificationErrorKind =
  | "invalid"
  | "expired"
  | "used"
  | "rate_limited"
  | "unavailable";

export class EmailVerificationError extends Error {
  status: number;
  kind: EmailVerificationErrorKind;

  constructor(
    message: string,
    opts: { status: number; kind: EmailVerificationErrorKind },
  ) {
    super(message);
    this.name = "EmailVerificationError";
    this.status = opts.status;
    this.kind = opts.kind;
  }
}

export type EmailVerificationRequestResult = {
  message: string;
  /** Only present when the backend runs outside production (`_debugLink`). */
  debugLink?: string;
};

export type EmailVerificationConfirmation = {
  email: string;
};

type RequestErrorBody = {
  error?: string;
  mensagem?: string;
  details?: { formErrors?: string[] };
} | null;

type ConfirmErrorBody = {
  error?: string;
} | null;

function getBaseUrl(): string {
  try {
    return getApiBaseUrl();
  } catch {
    throw new EmailVerificationError(
      "Serviço de e-mail indisponível. Tente novamente em instantes.",
      { status: 503, kind: "unavailable" },
    );
  }
}

function unavailable(): EmailVerificationError {
  return new EmailVerificationError(
    "Não foi possível concluir agora. Tente novamente em instantes.",
    { status: 503, kind: "unavailable" },
  );
}

export const emailVerificationApi = {
  async request(email: string): Promise<EmailVerificationRequestResult> {
    let res: Response;
    try {
      res = await fetch(`${getBaseUrl()}/auth/email/verify/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      throw unavailable();
    }

    const body = (await res.json().catch(() => null)) as RequestErrorBody;

    if (res.ok) {
      const debugLinkRaw = (body as unknown as Record<string, unknown> | null)
        ?._debugLink;
      const debugLink =
        typeof debugLinkRaw === "string" && debugLinkRaw.length > 0
          ? debugLinkRaw
          : undefined;

      return {
        message:
          body?.mensagem ??
          "Se o e-mail for válido, enviamos um link de confirmação.",
        ...(debugLink ? { debugLink } : {}),
      };
    }

    if (res.status === 429) {
      throw new EmailVerificationError(
        "Muitas solicitações de e-mail. Aguarde alguns minutos e tente novamente.",
        { status: 429, kind: "rate_limited" },
      );
    }

    if (res.status === 400) {
      throw new EmailVerificationError(
        "Informe um e-mail válido para receber o link de confirmação.",
        { status: 400, kind: "invalid" },
      );
    }

    throw new EmailVerificationError(
      body?.error ??
        "Não foi possível enviar o link agora. Tente novamente em instantes.",
      { status: res.status, kind: "unavailable" },
    );
  },

  async confirm(token: string): Promise<EmailVerificationConfirmation> {
    let res: Response;
    try {
      res = await fetch(
        `${getBaseUrl()}/auth/email/verify/confirm?token=${encodeURIComponent(token)}`,
      );
    } catch {
      throw unavailable();
    }

    const body = (await res.json().catch(() => null)) as ConfirmErrorBody;

    if (res.ok) {
      const payload = body as { email?: unknown } | null;
      if (typeof payload?.email !== "string" || payload.email.length === 0) {
        throw unavailable();
      }
      return { email: payload.email };
    }

    if (res.status === 404) {
      throw new EmailVerificationError(
        "Link inválido. Confira se o endereço foi copiado por completo.",
        { status: 404, kind: "invalid" },
      );
    }

    if (res.status === 410) {
      const used = /utilizad/i.test(body?.error ?? "");
      throw new EmailVerificationError(
        used
          ? "Este link não está mais ativo (pode ter sido substituído por um mais recente). Volte ao formulário e solicite um novo link."
          : "Este link expirou. Volte ao formulário e solicite um novo.",
        { status: 410, kind: used ? "used" : "expired" },
      );
    }

    if (res.status === 429) {
      throw new EmailVerificationError(
        "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        { status: 429, kind: "rate_limited" },
      );
    }

    throw new EmailVerificationError(
      body?.error ??
        "Não foi possível confirmar seu e-mail agora. Tente novamente em instantes.",
      { status: res.status, kind: "unavailable" },
    );
  },
};
