import type { Route } from "./+types/frida";
import { FridaPage } from "../../../features/professional/frida/components/FridaPage";
import {
  handleFridaAction,
  loadFridaPage,
} from "../../../features/professional/frida/fridaPage.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  return loadFridaPage(request, params.consultaId ?? "", "manager");
}

export async function action({ request, params }: Route.ActionArgs) {
  return handleFridaAction(request, params.consultaId ?? "", "manager");
}

export default function ManagerFrida({ loaderData }: Route.ComponentProps) {
  return (
    <FridaPage
      data={loaderData}
      backHref="/manager/consultas"
      backLabel="Voltar às consultas"
    />
  );
}
