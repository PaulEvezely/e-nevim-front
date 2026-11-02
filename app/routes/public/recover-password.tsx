import { useEffect, useState } from "react";
import { Link, data, useFetcher, useNavigate } from "react-router";
import type { Route } from "./+types/recover-password";
import { Button } from "../../../shared/components/Button";
import { EmergencyExitButton } from "../../../shared/components/EmergencyExitButton";
import {
  PasswordResetError,
  passwordRecoveryApi,
} from "../../../features/public/passwordRecoveryApi.server";

export type RecoverPasswordActionData =
  | { ok: true; message: string }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 60;

export async function action({ request }: Route.ActionArgs) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }

  const emailValue = (raw as { email?: unknown } | null)?.email;
  const email = typeof emailValue === "string" ? emailValue.trim() : "";

  if (!email || !EMAIL_PATTERN.test(email)) {
    return data<RecoverPasswordActionData>(
      { ok: false, error: "Informe um e-mail válido para receber o link." },
      { status: 400 },
    );
  }

  try {
    const result = await passwordRecoveryApi.request(email);
    return data<RecoverPasswordActionData>({
      ok: true,
      message: result.message,
    });
  } catch (err) {
    if (err instanceof PasswordResetError) {
      return data<RecoverPasswordActionData>(
        { ok: false, error: err.message },
        { status: err.status >= 400 && err.status < 600 ? err.status : 503 },
      );
    }
    return data<RecoverPasswordActionData>(
      {
        ok: false,
        error:
          "Não foi possível enviar o link agora. Tente novamente em instantes.",
      },
      { status: 503 },
    );
  }
}

export default function RecoverPasswordPage() {
  const navigate = useNavigate();
  const fetcher = useFetcher<RecoverPasswordActionData>();
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const isSubmitting = fetcher.state !== "idle";
  const isSent = fetcher.data?.ok === true;
  const serverError =
    fetcher.data && fetcher.data.ok === false ? fetcher.data.error : null;
  const errorMessage = clientError ?? serverError;

  useEffect(() => {
    if (fetcher.state !== "idle" || fetcher.data?.ok !== true) return;
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timeoutId = window.setTimeout(
      () => setCooldown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [cooldown]);

  function submitEmail(value: string) {
    const normalized = value.trim();
    if (!EMAIL_PATTERN.test(normalized)) {
      setClientError("Informe um e-mail válido para receber o link.");
      return;
    }
    setClientError(null);
    setSubmittedEmail(normalized);
    fetcher.submit(
      { email: normalized },
      { method: "post", action: "/recuperar-senha", encType: "application/json" },
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-2 lg:px-0">
      <div className="bg-white rounded-xl shadow-lg p-8 lg:p-12 text-center border border-stone-200">
        <div
          className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
            isSent ? "bg-[#EAF3DE]" : "bg-[#E6F1FB]"
          }`}
        >
          {isSent ? (
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
          ) : (
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
          )}
        </div>

        {isSent ? (
          <>
            <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-3">
              Link enviado
            </h1>
            <p className="text-gray-600 mb-2">
              Se o e-mail{" "}
              <span className="font-medium text-gray-800">{submittedEmail}</span>{" "}
              estiver cadastrado, enviamos um link para redefinir sua senha.
            </p>
            <p className="text-gray-600 text-sm mb-8 max-w-xl mx-auto">
              O link vale por 1 hora e só pode ser usado uma vez. Verifique
              também a caixa de spam e a pasta de lixo eletrônico.
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => submitEmail(submittedEmail)}
                loading={isSubmitting}
                disabled={isSubmitting || cooldown > 0}
                className="h-11 px-6 whitespace-nowrap bg-white border-gray-300 text-gray-700 hover:bg-stone-50"
              >
                {cooldown > 0
                  ? `Reenviar em ${cooldown}s`
                  : "Reenviar link"}
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate("/login")}
                className="h-11 px-8 whitespace-nowrap"
              >
                Voltar ao login
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-3">
              Recuperar senha
            </h1>
            <p className="text-gray-600 text-sm mb-8 max-w-xl mx-auto">
              Informe o e-mail cadastrado e enviaremos um link para você criar
              uma nova senha.
            </p>

            <form
              className="max-w-md mx-auto text-left flex flex-col gap-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                submitEmail(email);
              }}
            >
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (clientError) setClientError(null);
                  }}
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? "error-email" : undefined}
                  className={`w-full bg-white p-2.5 rounded-md outline-none shadow-inner border text-sm transition-all placeholder:text-gray-400 ${
                    errorMessage
                      ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      : "border-gray-300 focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
                  }`}
                />
              </div>

              {errorMessage && (
                <div
                  id="error-email"
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

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                className="h-11 px-8 self-center whitespace-nowrap"
              >
                Enviar link
              </Button>
            </form>

            <p className="mt-6 text-sm text-gray-600">
              Lembrou a senha?{" "}
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
