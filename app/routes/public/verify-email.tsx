import { useEffect, useState } from "react";
import { data, useNavigate } from "react-router";
import type { Route } from "./+types/verify-email";
import { Button } from "../../../shared/components/Button";
import { EmergencyExitButton } from "../../../shared/components/EmergencyExitButton";
import {
  emailVerificationApi,
  EmailVerificationError,
  type EmailVerificationErrorKind,
} from "../../../features/public/emailVerificationApi.server";
import { saveEmailVerification } from "../../../features/public/emailVerificationStorage";
import { readDemandPending } from "../../../features/public/demandDraftStorage";

export type VerifyEmailLoaderData =
  | { status: "verified"; email: string; token: string }
  | { status: "error"; kind: EmailVerificationErrorKind; message: string };

export type VerifyEmailActionData =
  | { ok: true; message: string; debugLink?: string }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function loader({ request }: Route.LoaderArgs) {
  const token =
    new URL(request.url).searchParams.get("token")?.trim() ?? "";

  if (token.length < 10) {
    return {
      status: "error",
      kind: "invalid",
      message:
        "Este link está incompleto ou é inválido. Volte ao formulário e solicite um novo link de confirmação.",
    } satisfies VerifyEmailLoaderData;
  }

  try {
    const confirmation = await emailVerificationApi.confirm(token);
    return {
      status: "verified",
      email: confirmation.email,
      token,
    } satisfies VerifyEmailLoaderData;
  } catch (err) {
    if (err instanceof EmailVerificationError) {
      return {
        status: "error",
        kind: err.kind,
        message: err.message,
      } satisfies VerifyEmailLoaderData;
    }
    return {
      status: "error",
      kind: "unavailable",
      message:
        "Não foi possível confirmar seu e-mail agora. Tente novamente em instantes.",
    } satisfies VerifyEmailLoaderData;
  }
}

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
    return data<VerifyEmailActionData>(
      { ok: false, error: "Informe um e-mail válido para receber o link." },
      { status: 400 },
    );
  }

  try {
    const result = await emailVerificationApi.request(email);
    return data<VerifyEmailActionData>({
      ok: true,
      message: result.message,
      ...(result.debugLink ? { debugLink: result.debugLink } : {}),
    });
  } catch (err) {
    if (err instanceof EmailVerificationError) {
      return data<VerifyEmailActionData>(
        { ok: false, error: err.message },
        { status: err.status >= 400 && err.status < 600 ? err.status : 503 },
      );
    }
    return data<VerifyEmailActionData>(
      {
        ok: false,
        error:
          "Não foi possível enviar o link agora. Tente novamente em instantes.",
      },
      { status: 503 },
    );
  }
}

const ERROR_TITLES: Record<EmailVerificationErrorKind, string> = {
  invalid: "Link inválido",
  expired: "Link expirado",
  used: "Link já utilizado",
  rate_limited: "Muitas solicitações",
  unavailable: "Não foi possível confirmar agora",
};

export default function VerifyEmailPage({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [canCloseTab, setCanCloseTab] = useState(false);
  const [hasPendingDemand, setHasPendingDemand] = useState(false);

  const verifiedEmail =
    loaderData.status === "verified" ? loaderData.email : null;
  const verifiedToken =
    loaderData.status === "verified" ? loaderData.token : null;

  useEffect(() => {
    if (!verifiedEmail || !verifiedToken) return;
    saveEmailVerification({ email: verifiedEmail, token: verifiedToken });

    // There is a demand waiting for this confirmation: return to the form so
    // it is submitted automatically with the verified token.
    const pending = readDemandPending();
    if (pending) {
      setHasPendingDemand(true);
      const timeoutId = window.setTimeout(() => navigate("/demanda"), 1500);
      return () => window.clearTimeout(timeoutId);
    }
  }, [verifiedEmail, verifiedToken, navigate]);

  useEffect(() => {
    setCanCloseTab(
      typeof window !== "undefined" && Boolean(window.opener),
    );
  }, []);

  const isVerified = loaderData.status === "verified";

  return (
    <div className="max-w-3xl mx-auto px-2 lg:px-0">
      <div className="bg-white rounded-xl shadow-lg p-8 lg:p-12 text-center border border-stone-200">
        <div
          className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
            isVerified ? "bg-[#EAF3DE]" : "bg-[#FCEBEB]"
          }`}
        >
          {isVerified ? (
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

        {loaderData.status === "verified" ? (
          <>
            <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-3">
              E-mail confirmado
            </h1>
            <p className="text-gray-600 mb-2">
              O endereço{" "}
              <span className="font-medium text-gray-800">
                {loaderData.email}
              </span>{" "}
              foi confirmado com sucesso.
            </p>
            <p className="text-gray-600 text-sm mb-8">
              {hasPendingDemand
                ? "Retornando ao formulário para enviar sua demanda automaticamente…"
                : "Volte ao formulário para enviar sua demanda. Se você abriu este link em outra aba, basta retornar a ela — o formulário já estará liberado."}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => navigate("/demanda")}
                className="h-11 px-8"
              >
                {hasPendingDemand
                  ? "Enviar demanda agora"
                  : "Voltar para a demanda"}
              </Button>
              {canCloseTab && (
                <Button
                  variant="outline"
                  onClick={() => window.close()}
                  className="h-11 px-6 bg-white border-gray-300 text-gray-700 hover:bg-stone-50"
                >
                  Fechar esta aba
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-3">
              {ERROR_TITLES[loaderData.kind]}
            </h1>
            <p className="text-gray-600 text-sm mb-8 max-w-xl mx-auto">
              {loaderData.message}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => navigate("/demanda")}
                className="h-11 px-8"
              >
                Pedir novo link
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="h-11 px-6 bg-white border-gray-300 text-gray-700 hover:bg-stone-50"
              >
                Voltar ao início
              </Button>
            </div>
          </>
        )}
      </div>

      <EmergencyExitButton />
    </div>
  );
}
