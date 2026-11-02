import { useState } from "react";
import { Form, redirect, useNavigation, data } from "react-router";
import {
  getSession,
  commitSession,
} from "../../../features/auth/cookie.server";
import { authApi } from "../../../features/auth/authApi.server";
import { mapPerfilParaUser } from "../../../features/auth/mapPerfil";
import { getOptionalUser } from "../../../features/auth/require-user.server";
import { getHomeRoute } from "../../../features/auth/roleHome";
import type { Route } from "./+types/login";
import { Button } from "../../../shared/components/Button";
import EmergencyExitButton from "../../../shared/components/EmergencyExitButton";

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getOptionalUser(request);
  if (user) {
    throw redirect(getHomeRoute(user.role));
  }

  // Token inválido/expirado/corrompido ainda no cookie -> limpar para evitar loop 302
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  if (token) {
    session.unset("token");
    return data(null, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const session = await getSession(request.headers.get("Cookie"));

  const email = String(formData.get("email") ?? "");
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { error: "Preencha e-mail e senha." };
  }

  if (!isValidEmailFormat(email)) {
    return {
      error: "Formato de e-mail inválido. Use algo como nome@exemplo.com",
    };
  }

  try {
    const success = await authApi.login(email, senha);

    session.set("token", success.token);

    const profileValue =
      success.usuario.profile ?? success.usuario.perfil ?? "";
    const user = mapPerfilParaUser({
      sub: success.usuario.id,
      email: success.usuario.email,
      profile: profileValue,
      perfil: profileValue,
    });

    throw redirect(getHomeRoute(user.role), {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } catch (err) {
    if (err instanceof Response) throw err;

    return { error: "E-mail ou senha inválidos." };
  }
}

// ---------- componente: a tela em si ----------
export default function LoginPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [emailValue, setEmailValue] = useState("");
  const [clientEmailFormatError, setClientEmailFormatError] = useState<
    string | null
  >(null);
  const serverError = (actionData as { error?: string })?.error ?? null;
  const isEmailFormatServerError = Boolean(
    serverError?.includes("Formato de e-mail"),
  );
  const emailErrorMessage =
    clientEmailFormatError ?? (isEmailFormatServerError ? serverError : null);
  const showGlobalError = Boolean(serverError && !isEmailFormatServerError);

  return (
    <div className="login-card bg-blue-200 p-6 w-80 mx-auto mt-11 rounded-xl lg:w-120 lg:h-150 lg:mt-15 lg:p-20">
      <h1 className="text-xl text-center font-semibold text-gray-800 mb-7 lg:mb-15 lg:text-2xl">
        Acessar Conta
      </h1>

      <Form
        method="post"
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(e) => {
          const form = e.currentTarget;
          const emailInput = form.elements.namedItem(
            "email",
          ) as HTMLInputElement | null;
          const email = emailInput?.value ?? emailValue;
          if (email.trim() && !isValidEmailFormat(email)) {
            e.preventDefault();
            setClientEmailFormatError(
              "Formato de e-mail inválido. Use algo como nome@exemplo.com",
            );
          }
        }}
      >
        <label htmlFor="email" className="text-gray-600">
          E-mail/Usuário
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="seuemail@gmail.com"
          required
          value={emailValue}
          onChange={(e) => {
            setEmailValue(e.target.value);
            if (clientEmailFormatError) setClientEmailFormatError(null);
          }}
          onBlur={() => {
            if (emailValue.trim() && !isValidEmailFormat(emailValue)) {
              setClientEmailFormatError(
                "Formato de e-mail inválido. Verifique o e-mail digitado.",
              );
            }
          }}
          aria-invalid={Boolean(emailErrorMessage)}
          aria-describedby={
            emailErrorMessage ? "error-email-format" : undefined
          }
          className={`bg-white p-1.5 rounded-md outline-none shadow-inner border text-sm transition-all placeholder:text-gray-400 ${
            emailErrorMessage
              ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
              : "border-transparent focus:border-[#378ADD] focus:ring-2 focus:ring-[#E6F1FB]"
          }`}
        />
        {emailErrorMessage && (
          <div
            id="error-email-format"
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 bg-[#FCEBEB] border border-red-200 text-[#791F1F] text-sm px-3 py-2.5 rounded-lg leading-snug -mt-3"
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
            <span>{emailErrorMessage}</span>
          </div>
        )}
        <label htmlFor="senha" className="text-gray-600">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          className="bg-white p-1.5 rounded-md outline-none"
          required
        />
        {showGlobalError && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2.5 bg-[#FCEBEB] border border-red-200 text-[#791F1F] text-sm px-3.5 py-3 rounded-lg leading-snug"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 flex-shrink-0 mt-[1px]"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            <span>{serverError}</span>
          </div>
        )}
        <Button
          variant="primary"
          className="self-center h-10 w-65 lg:w-80"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Button>
      </Form>

      <EmergencyExitButton />

      <div className="mt-4 flex flex-col gap-2 text-sm text-center">
        <a href="/recuperar-senha" className="text-blue-800 underline">
          Esqueci minha senha
        </a>
        <a href="/demanda" className="text-blue-800 underline">
          Não tem conta? Registrar demanda
        </a>
      </div>
    </div>
  );
}
