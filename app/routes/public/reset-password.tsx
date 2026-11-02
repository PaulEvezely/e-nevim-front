import { useState } from "react";
import { Link, data, useFetcher, useNavigate } from "react-router";
import type { Route } from "./+types/reset-password";
import { Button } from "../../../shared/components/Button";
import { EmergencyExitButton } from "../../../shared/components/EmergencyExitButton";
import {
  PasswordResetError,
  passwordRecoveryApi,
  type PasswordResetErrorKind,
  type PasswordResetFieldErrors,
} from "../../../features/public/passwordRecoveryApi.server";

export type ResetPasswordLoaderData = {
  token: string;
  tokenPresent: boolean;
};

export type ResetPasswordActionData =
  | { ok: true }
  | {
      ok: false;
      error: string;
      kind: PasswordResetErrorKind;
      fieldErrors?: PasswordResetFieldErrors;
    };

const MIN_PASSWORD_LENGTH = 8;

export async function loader({ request }: Route.LoaderArgs) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  return {
    token,
    tokenPresent: token.length >= 10,
  } satisfies ResetPasswordLoaderData;
}

export async function action({ request }: Route.ActionArgs) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }

  const payload = (raw ?? {}) as Record<string, unknown>;
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const newPassword =
    typeof payload.newPassword === "string" ? payload.newPassword : "";
  const confirmNewPassword =
    typeof payload.confirmNewPassword === "string"
      ? payload.confirmNewPassword
      : "";

  if (token.length < 10) {
    return data<ResetPasswordActionData>(
      {
        ok: false,
        error: "Link inválido. Solicite um novo link de recuperação.",
        kind: "invalid",
      },
      { status: 400 },
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return data<ResetPasswordActionData>(
      {
        ok: false,
        error: `A nova senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        kind: "validation",
        fieldErrors: { newPassword: "Informe ao menos 8 caracteres." },
      },
      { status: 400 },
    );
  }

  if (newPassword !== confirmNewPassword) {
    return data<ResetPasswordActionData>(
      {
        ok: false,
        error: "As senhas não conferem.",
        kind: "validation",
        fieldErrors: { confirmNewPassword: "As senhas não conferem." },
      },
      { status: 400 },
    );
  }

  try {
    await passwordRecoveryApi.reset({
      token,
      newPassword,
      confirmNewPassword,
    });
    return data<ResetPasswordActionData>({ ok: true });
  } catch (err) {
    if (err instanceof PasswordResetError) {
      return data<ResetPasswordActionData>(
        {
          ok: false,
          error: err.message,
          kind: err.kind,
          fieldErrors: err.fieldErrors,
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 503 },
      );
    }
    return data<ResetPasswordActionData>(
      {
        ok: false,
        error:
          "Não foi possível redefinir a senha agora. Tente novamente em instantes.",
        kind: "unavailable",
      },
      { status: 503 },
    );
  }
}

const LINK_ERROR_KINDS: PasswordResetErrorKind[] = [
  "invalid",
  "expired",
  "used",
];

const inputClass = (hasError: boolean) =>
  `w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all placeholder:text-gray-400 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
      : "border-gray-300 focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
  }`;

export default function ResetPasswordPage({
  loaderData,
}: Route.ComponentProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher<ResetPasswordActionData>();
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const isSubmitting = fetcher.state !== "idle";
  const isSuccess = fetcher.data?.ok === true;
  const serverData = fetcher.data && fetcher.data.ok === false ? fetcher.data : null;
  const errorMessage = clientError ?? serverData?.error ?? null;
  const fieldErrors = serverData?.fieldErrors ?? {};
  const isLinkProblem = Boolean(
    serverData && LINK_ERROR_KINDS.includes(serverData.kind),
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loaderData.tokenPresent) {
      setClientError("Link inválido. Solicite um novo link de recuperação.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setClientError(
        `A nova senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setClientError("As senhas não conferem.");
      return;
    }
    setClientError(null);
    fetcher.submit(
      {
        token: loaderData.token,
        newPassword,
        confirmNewPassword,
      },
      {
        method: "post",
        action: "/redefinir-senha",
        encType: "application/json",
      },
    );
  }

  const showForm = loaderData.tokenPresent && !isSuccess;

  return (
    <div className="max-w-3xl mx-auto px-2 lg:px-0">
      <div className="bg-white rounded-xl shadow-lg p-8 lg:p-12 text-center border border-stone-200">
        <div
          className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
            isSuccess
              ? "bg-[#EAF3DE]"
              : showForm
                ? "bg-[#E6F1FB]"
                : "bg-[#FCEBEB]"
          }`}
        >
          {isSuccess ? (
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
          ) : showForm ? (
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
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#791F1F"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8"
              aria-hidden="true"
            >
              <path d="M12 8v5" />
              <path d="M12 16.5v.5" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          )}
        </div>

        {isSuccess ? (
          <>
            <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-3">
              Senha redefinida
            </h1>
            <p className="text-gray-600 mb-8 max-w-xl mx-auto">
              Sua senha foi atualizada com sucesso. As sessões abertas
              anteriormente foram encerradas por segurança.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate("/login")}
              className="h-11 px-8 whitespace-nowrap"
            >
              Ir para o login
            </Button>
          </>
        ) : !loaderData.tokenPresent ? (
          <>
            <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-3">
              Link inválido ou incompleto
            </h1>
            <p className="text-gray-600 text-sm mb-8 max-w-xl mx-auto">
              Confira se o endereço foi copiado por completo ou solicite um novo
              link de recuperação.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => navigate("/recuperar-senha")}
                className="h-11 px-8 whitespace-nowrap"
              >
                Solicitar novo link
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/login")}
                className="h-11 px-6 whitespace-nowrap bg-white border-gray-300 text-gray-700 hover:bg-stone-50"
              >
                Voltar ao login
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-3">
              Definir nova senha
            </h1>
            <p className="text-gray-600 text-sm mb-8 max-w-xl mx-auto">
              Escolha uma nova senha com pelo menos {MIN_PASSWORD_LENGTH}{" "}
              caracteres.
            </p>

            <form
              className="max-w-md mx-auto text-left flex flex-col gap-4"
              noValidate
              onSubmit={handleSubmit}
            >
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Nova senha
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    if (clientError) setClientError(null);
                  }}
                  aria-invalid={Boolean(fieldErrors.newPassword || errorMessage)}
                  aria-describedby={
                    fieldErrors.newPassword ? "error-new-password" : undefined
                  }
                  className={inputClass(Boolean(fieldErrors.newPassword))}
                />
                {fieldErrors.newPassword && (
                  <p
                    id="error-new-password"
                    role="alert"
                    className="mt-1.5 text-xs text-red-700"
                  >
                    {fieldErrors.newPassword}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmNewPassword"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Confirmar nova senha
                </label>
                <input
                  id="confirmNewPassword"
                  name="confirmNewPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(event) => {
                    setConfirmNewPassword(event.target.value);
                    if (clientError) setClientError(null);
                  }}
                  aria-invalid={Boolean(
                    fieldErrors.confirmNewPassword || errorMessage,
                  )}
                  aria-describedby={
                    fieldErrors.confirmNewPassword
                      ? "error-confirm-password"
                      : undefined
                  }
                  className={inputClass(
                    Boolean(fieldErrors.confirmNewPassword),
                  )}
                />
                {fieldErrors.confirmNewPassword && (
                  <p
                    id="error-confirm-password"
                    role="alert"
                    className="mt-1.5 text-xs text-red-700"
                  >
                    {fieldErrors.confirmNewPassword}
                  </p>
                )}
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2 bg-[#FCEBEB] border border-red-200 text-[#791F1F] text-sm px-3 py-2.5 rounded-lg leading-snug"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {isLinkProblem ? (
                <Button
                  variant="primary"
                  onClick={() => navigate("/recuperar-senha")}
                  className="h-11 px-8 self-center whitespace-nowrap"
                >
                  Solicitar novo link
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  className="h-11 px-8 self-center whitespace-nowrap"
                >
                  Redefinir senha
                </Button>
              )}
            </form>

            <p className="mt-6 text-sm text-gray-600">
              <Link to="/login" className="text-[#0C447C] underline">
                Voltar ao login
              </Link>
            </p>
          </>
        )}
      </div>

      <EmergencyExitButton />
    </div>
  );
}
