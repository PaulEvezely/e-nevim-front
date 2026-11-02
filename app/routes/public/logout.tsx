import { redirect } from "react-router";
import { destroySession, getSession } from "../../../features/auth/cookie.server";
import type { Route } from "./+types/logout";

async function clearAndRedirect(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  throw redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  await clearAndRedirect(request);
}

export async function action({ request }: Route.ActionArgs) {
  await clearAndRedirect(request);
}

export default function LogoutPage() {
  return (
    <main className="max-w-md mx-auto p-6 text-center">
      <h1 className="text-lg font-semibold text-gray-800">Saindo...</h1>
      <p className="mt-2 text-sm text-gray-600">
        Sua sessão está sendo encerrada com segurança.
      </p>
    </main>
  );
}
