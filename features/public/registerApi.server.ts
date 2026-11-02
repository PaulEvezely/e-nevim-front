import { getApiBaseUrl } from "../../libs/api.server";

export type InviteSolicitante = {
  nome: string | null;
  email: string | null;
  vinculo: string | null;
  campus: string | null;
  cidade: string | null;
  curso: string | null;
};

export type InviteValidation = {
  valid: true;
  demandaId: string;
  solicitante: InviteSolicitante;
  expiraEm: string;
};

export type CompleteRegistrationPayload = {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  vinculo: string;
  campus: string;
  curso: string | null;
  cpf: string;
  matricula: string | null;
  dataNascimento: string;
  estadoCivil: string;
  sexo: string;
  genero: string;
  etnia: string;
  escolaridade: string;
  cotista: boolean;
  endereco: string | null;
  cidade: string | null;
  cep: string | null;
};

export type CompleteRegistrationSuccess = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  demandaId: string;
  /** Processo ABERTO criado automaticamente junto com o cadastro. */
  processoId: string;
};

export type BackendFieldErrors = Record<string, string[]>;

export class RegisterInviteError extends Error {
  status: number;
  fieldErrors: BackendFieldErrors;
  formErrors: string[];

  constructor(
    message: string,
    opts: { status: number; fieldErrors?: BackendFieldErrors; formErrors?: string[] },
  ) {
    super(message);
    this.name = "RegisterInviteError";
    this.status = opts.status;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.formErrors = opts.formErrors ?? [];
  }
}

function getBaseUrl(): string {
  try {
    return getApiBaseUrl();
  } catch {
    throw new RegisterInviteError("Serviço de cadastro indisponível.", {
      status: 503,
    });
  }
}

type ErrorBody = {
  error?: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: BackendFieldErrors;
  };
} | null;

async function readErrorBody(res: Response): Promise<ErrorBody> {
  return (await res.json().catch(() => null)) as ErrorBody;
}

// Mensagens conhecidas do backend que não vêm como fieldErrors do Zod.
// Mapeia para o campo correspondente para destacar no formulário.
function mapKnownErrorToField(errorMessage: string | undefined): {
  field: string;
  message: string;
} | null {
  if (!errorMessage) return null;
  const normalized = errorMessage.trim().toLowerCase();
  if (normalized.includes("não corresponde ao convite")) {
    return {
      field: "email",
      message: "Este e-mail não corresponde ao do convite recebido.",
    };
  }
  if (normalized.includes("email") && normalized.includes("cadastrado")) {
    return { field: "email", message: "Este e-mail já possui cadastro." };
  }
  if (normalized.includes("cpf") && normalized.includes("cadastrado")) {
    return { field: "cpf", message: "Este CPF já possui cadastro." };
  }
  return null;
}

export const registerApi = {
  async validateInvite(token: string): Promise<InviteValidation> {
    let res: Response;
    try {
      res = await fetch(
        `${getBaseUrl()}/auth/invite/${encodeURIComponent(token)}/validate`,
      );
    } catch {
      throw new RegisterInviteError(
        "Não foi possível validar seu convite. Tente novamente em instantes.",
        { status: 503 },
      );
    }

    if (res.ok) {
      return (await res.json()) as InviteValidation;
    }

    const body = await readErrorBody(res);
    const message =
      body?.error ??
      (res.status === 404
        ? "Convite não encontrado"
        : res.status === 410
          ? "Convite expirado ou já utilizado"
          : "Não foi possível validar seu convite. Tente novamente em instantes.");
    throw new RegisterInviteError(message, {
      status: res.status,
      formErrors: body?.details?.formErrors ?? [],
    });
  },

  async completeRegistration(
    token: string,
    payload: CompleteRegistrationPayload,
  ): Promise<CompleteRegistrationSuccess> {
    let res: Response;
    try {
      res = await fetch(
        `${getBaseUrl()}/auth/register/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
    } catch {
      throw new RegisterInviteError(
        "Não foi possível concluir seu cadastro. Tente novamente em instantes.",
        { status: 503 },
      );
    }

    if (res.ok) {
      return (await res.json()) as CompleteRegistrationSuccess;
    }

    const body = await readErrorBody(res);
    const fieldErrors: BackendFieldErrors =
      body?.details?.fieldErrors ?? {};

    // Erros de regra de negócio (409/400 com mensagem) viram erro de campo.
    if (Object.keys(fieldErrors).length === 0) {
      const mapped = mapKnownErrorToField(body?.error);
      if (mapped) {
        fieldErrors[mapped.field] = [mapped.message];
      }
    }

    const fallbackMessage =
      res.status === 404
        ? "Convite não encontrado. Verifique o link recebido."
        : res.status === 410
          ? "Este convite expirou ou já foi utilizado."
          : "Não foi possível concluir seu cadastro. Tente novamente em instantes.";

    throw new RegisterInviteError(body?.error ?? fallbackMessage, {
      status: res.status,
      fieldErrors,
      formErrors: body?.details?.formErrors ?? [],
    });
  },
};
