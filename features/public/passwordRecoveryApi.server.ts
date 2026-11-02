import { getApiBaseUrl } from "../../libs/api.server";

export type PasswordResetRequestResult = {
  message: string;
};

export type PasswordResetErrorKind =
  | "validation"
  | "invalid"
  | "expired"
  | "used"
  | "rate_limited"
  | "unavailable";

export type PasswordResetFieldErrors = {
  token?: string;
  newPassword?: string;
  confirmNewPassword?: string;
};

export type PasswordResetSubmission = {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
};

type RequestErrorBody = {
  error?: string;
  mensagem?: string;
} | null;

type ResetErrorBody = {
  error?: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: Partial<Record<"token" | "novaSenha" | "confirmarNovaSenha", string[]>>;
  };
} | null;

export class PasswordResetError extends Error {
  status: number;
  kind: PasswordResetErrorKind;
  fieldErrors: PasswordResetFieldErrors;

  constructor(
    message: string,
    opts: {
      status: number;
      kind: PasswordResetErrorKind;
      fieldErrors?: PasswordResetFieldErrors;
    },
  ) {
    super(message);
    this.name = "PasswordResetError";
    this.status = opts.status;
    this.kind = opts.kind;
    this.fieldErrors = opts.fieldErrors ?? {};
  }
}

function getBaseUrl(): string {
  try {
    return getApiBaseUrl();
  } catch {
    throw new PasswordResetError(
      "Serviço temporariamente indisponível. Tente novamente em instantes.",
      { status: 503, kind: "unavailable" },
    );
  }
}

function unavailable(): PasswordResetError {
  return new PasswordResetError(
    "Não foi possível concluir agora. Tente novamente em instantes.",
    { status: 503, kind: "unavailable" },
  );
}

export const passwordRecoveryApi = {
  async request(email: string): Promise<PasswordResetRequestResult> {
    let res: Response;
    try {
      res = await fetch(`${getBaseUrl()}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      throw unavailable();
    }

    const body = (await res.json().catch(() => null)) as RequestErrorBody;

    if (res.ok) {
      return {
        message:
          body?.mensagem ??
          "Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha.",
      };
    }

    if (res.status === 400) {
      throw new PasswordResetError(
        "Informe um e-mail válido para receber o link de recuperação.",
        { status: 400, kind: "validation" },
      );
    }

    if (res.status === 429) {
      throw new PasswordResetError(
        "Muitas solicitações. Aguarde alguns minutos e tente novamente.",
        { status: 429, kind: "rate_limited" },
      );
    }

    throw new PasswordResetError(
      body?.error ??
        "Não foi possível enviar o link agora. Tente novamente em instantes.",
      { status: res.status, kind: "unavailable" },
    );
  },

  async reset(submission: PasswordResetSubmission): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${getBaseUrl()}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: submission.token,
          novaSenha: submission.newPassword,
          confirmarNovaSenha: submission.confirmNewPassword,
        }),
      });
    } catch {
      throw unavailable();
    }

    const body = (await res.json().catch(() => null)) as ResetErrorBody;

    if (res.ok) return;

    if (res.status === 400) {
      const fieldErrors: PasswordResetFieldErrors = {
        ...(body?.details?.fieldErrors?.token?.[0]
          ? { token: body.details.fieldErrors.token[0] }
          : {}),
        ...(body?.details?.fieldErrors?.novaSenha?.[0]
          ? { newPassword: body.details.fieldErrors.novaSenha[0] }
          : {}),
        ...(body?.details?.fieldErrors?.confirmarNovaSenha?.[0]
          ? {
              confirmNewPassword:
                body.details.fieldErrors.confirmarNovaSenha[0],
            }
          : {}),
      };

      throw new PasswordResetError(
        body?.details?.formErrors?.[0] ??
          "Confira os dados informados e tente novamente.",
        { status: 400, kind: "validation", fieldErrors },
      );
    }

    if (res.status === 404) {
      throw new PasswordResetError(
        "Link inválido. Solicite um novo link de recuperação.",
        { status: 404, kind: "invalid" },
      );
    }

    if (res.status === 410) {
      const used = /utilizad/i.test(body?.error ?? "");
      throw new PasswordResetError(
        used
          ? "Este link já foi utilizado. Solicite um novo link de recuperação."
          : "Este link expirou. Solicite um novo link de recuperação.",
        { status: 410, kind: used ? "used" : "expired" },
      );
    }

    if (res.status === 429) {
      throw new PasswordResetError(
        "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        { status: 429, kind: "rate_limited" },
      );
    }

    throw new PasswordResetError(
      body?.error ??
        "Não foi possível redefinir a senha agora. Tente novamente em instantes.",
      { status: res.status, kind: "unavailable" },
    );
  },
};
