import { Link, useRevalidator } from "react-router";
import { useMemo, useState } from "react";
import type { Route } from "./+types/pacientes";
import { requireUser } from "../../../features/auth/require-user.server";
import { managerApi } from "../../../features/manager/managerApi.server";
import { appointmentApi } from "../../../features/manager/appointmentApi.server";
import {
  parsePatientFilters,
  parsePatientPage,
  PATIENTS_PER_PAGE,
  type ManagerPatientItem,
  type PatientFacets,
  type PatientFilters as PatientFilterValues,
  type PatientTriageCounts,
} from "../../../features/manager/patientUtils";
import { PatientFilters } from "../../../features/manager/components/PatientFilters";
import { PatientTable } from "../../../features/manager/components/PatientTable";
import { Pagination } from "../../../shared/components/Pagination";
import { SkeletonCard } from "../../../shared/components/LoadingOverlay";
import { AppointmentForm } from "../../../features/manager/components/AppointmentForm";
import { type AppointmentProcessOption } from "../../../features/manager/appointmentUtils";
import { useToast } from "../../../shared/hooks/useToast";

type PatientsLoaderData = {
  patients: ManagerPatientItem[];
  page: number;
  totalPages: number;
  total: number;
  counts: PatientTriageCounts;
  facets: PatientFacets;
  filters: PatientFilterValues;
  triageProcessOptions: AppointmentProcessOption[];
  emTriagemProcessOptions: AppointmentProcessOption[];
  processOptions: AppointmentProcessOption[];
  professionals: { id: string; nome: string; perfil: string; registro?: string | null }[];
  gestor: { id: string; nome: string };
  calendarAppointments: { profissionalId: string; dataHora: string; dataHoraFim?: string | null; status: string; processoId?: string; tipoProfissional?: string; vitimaNome?: string | null; vitimaCampus?: string | null }[];
  loadError: string | null;
};

const EMPTY_COUNTS: PatientTriageCounts = {
  ALL: 0,
  SEM_TRIAGEM: 0,
  EM_TRIAGEM: 0,
  ENCAMINHADO: 0,
  ENCERRADO: 0,
};

const EMPTY_FACETS: PatientFacets = {
  campuses: [],
  courses: [],
  bonds: [],
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["manager"]);
  const user = await requireUser(request, ["manager"]);
  const url = new URL(request.url);
  const filters = parsePatientFilters(url.searchParams);
  const requestedPage = parsePatientPage(url.searchParams);
  try {
    const [
      result,
      triageProcessOptions,
      emTriagemProcessOptions,
      processOptions,
      professionals,
      gestor,
      calendarAppointments,
    ] = await Promise.all([
      managerApi.listPatients(
        request,
        filters,
        requestedPage,
        PATIENTS_PER_PAGE,
      ),
      appointmentApi.listTriageProcessOptions(request).catch(() => []),
      appointmentApi.listEmTriagemProcessOptions(request).catch(() => []),
      appointmentApi.listProcessOptions(request).catch(() => []),
      appointmentApi.listProfessionals(request).catch(() => []),
      appointmentApi.getGestor(request, user.id).catch(() => ({
        id: user.id,
        nome: user.name || "Gestor",
      })),
      appointmentApi.listAppointments(request).catch(() => []),
    ]);
    return {
      patients: result.pacientes,
      page: result.page,
      totalPages: result.totalPages,
      total: result.total,
      counts: result.counts,
      facets: result.facets,
      filters,
      triageProcessOptions,
      emTriagemProcessOptions,
      processOptions,
      professionals,
      gestor,
      calendarAppointments,
      loadError: null,
    } satisfies PatientsLoaderData;
  } catch {
    return {
      patients: [],
      page: 1,
      totalPages: 1,
      total: 0,
      counts: EMPTY_COUNTS,
      facets: EMPTY_FACETS,
      filters,
      triageProcessOptions: [],
      emTriagemProcessOptions: [],
      processOptions: [],
      professionals: [],
      gestor: { id: "", nome: "Gestor" },
      calendarAppointments: [],
      loadError:
        "Não foi possível carregar os pacientes. Tente novamente em instantes.",
    } satisfies PatientsLoaderData;
  }
}

export default function ManagerPatients({ loaderData }: Route.ComponentProps) {
  const {
    patients,
    page,
    totalPages,
    total,
    counts,
    facets,
    filters,
    triageProcessOptions,
    emTriagemProcessOptions,
    processOptions,
    professionals,
    gestor,
    calendarAppointments,
    loadError,
  } = loaderData;
  const revalidator = useRevalidator();
  const { toast, showToast } = useToast();
  const reloading = revalidator.state !== "idle";

  const [agendarTriagemId, setAgendarTriagemId] = useState<string | null>(null);
  const [agendarConsultaId, setAgendarConsultaId] = useState<string | null>(null);

  // Pré-preenchimento: converte o paciente da linha em AppointmentProcessOption para label imediato
  const agendarTriagemOption = useMemo<AppointmentProcessOption | null>(() => {
    if (!agendarTriagemId) return null;
    const hitStatic = triageProcessOptions.find((o) => o.processoId === agendarTriagemId);
    if (hitStatic) return hitStatic;
    const patient = patients.find((p) => p.processo?.id === agendarTriagemId);
    if (!patient?.processo) return null;
    return {
      processoId: patient.processo.id,
      status: patient.processo.status,
      direcionadoPara: patient.processo.direcionadoPara,
      classificacaoRisco: patient.processo.classificacaoRisco,
      abertoEm: patient.processo.abertoEm,
      vitimaNome: patient.nome,
      vitimaCampus: patient.campus,
      totalConsultas: patient.totalConsultas,
    };
  }, [agendarTriagemId, triageProcessOptions, patients]);

  const agendarConsultaOption = useMemo<AppointmentProcessOption | null>(() => {
    if (!agendarConsultaId) return null;
    const allStatic = [...processOptions, ...emTriagemProcessOptions, ...triageProcessOptions];
    const hitStatic = allStatic.find((o) => o.processoId === agendarConsultaId);
    if (hitStatic) return hitStatic;
    const patient = patients.find((p) => p.processo?.id === agendarConsultaId);
    if (!patient?.processo) return null;
    return {
      processoId: patient.processo.id,
      status: patient.processo.status,
      direcionadoPara: patient.processo.direcionadoPara,
      classificacaoRisco: patient.processo.classificacaoRisco,
      abertoEm: patient.processo.abertoEm,
      vitimaNome: patient.nome,
      vitimaCampus: patient.campus,
      totalConsultas: patient.totalConsultas,
    };
  }, [agendarConsultaId, processOptions, emTriagemProcessOptions, triageProcessOptions, patients]);

  function handleAgendarTriagem(processoId: string) {
    setAgendarTriagemId(processoId);
  }

  function handleAgendarConsulta(processoId: string) {
    setAgendarConsultaId(processoId);
  }

  function handleAgendarClose() {
    setAgendarTriagemId(null);
    setAgendarConsultaId(null);
  }

  function handleAgendarSuccess() {
    showToast("Consulta agendada com sucesso.", "success");
    revalidator.revalidate();
    handleAgendarClose();
  }

  return (
    <>
      <section className="mx-auto max-w-6xl" aria-label="Pacientes cadastrados">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">Pacientes</h1>
          <p className="mt-1 text-sm text-gray-600">
            Lista única de vítimas cadastradas. Use Agendar triagem para ABERTO
            e Marcar consulta para EM_TRIAGEM/ENCAMINHADO, seguindo o fluxo{" "}
            <Link
              to="/manager"
              className="font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
            >
              Painel
            </Link>{" "}
            →{" "}
            <Link
              to="/manager/consultas"
              className="font-semibold text-[#378ADD] underline underline-offset-2 hover:text-[#0C447C]"
            >
              Consultas
            </Link>
            .
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {total === 0
              ? "Nenhum paciente encontrado."
              : `${total} ${total === 1 ? "paciente" : "pacientes"} encontrado${total === 1 ? "" : "s"}.`}
          </p>
        </div>
      </div>

      {filters.triage === "SEM_TRIAGEM" ? (
        <div className="mt-4 rounded-xl border border-[#378ADD]/30 bg-[#E6F1FB] px-4 py-3 text-sm text-[#0C447C]">
          <p className="text-sm">
            <span className="font-semibold">Filtro Sem triagem:</span> inclui
            vítimas sem processo criado e processos ABERTO aguardando triagem.
            A{" "}
            <Link
              to="/manager"
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              fila de triagem do Painel
            </Link>{" "}
            mostra só os processos ABERTO. Use{" "}
            <span className="font-semibold">Agendar triagem</span> na coluna
            Ações para seguir o mesmo fluxo do Painel.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => revalidator.revalidate()}
            disabled={reloading}
            className="text-xs font-semibold underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
          >
            {reloading ? "Carregando…" : "Tentar novamente"}
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        <PatientFilters filters={filters} counts={counts} facets={facets} />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">
            Pacientes cadastrados
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Ordenados por cadastro mais recente. ID exibe processo (quando há)
            e vítima; Ações segue o fluxo Painel → Consultas.
            {totalPages > 1 ? ` Página ${page} de ${totalPages}.` : ""}
          </p>
        </div>
        {reloading && patients.length === 0 ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2" aria-hidden="true">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : (
          <>
            <PatientTable
              patients={patients}
              onAgendarTriagem={handleAgendarTriagem}
              onAgendarConsulta={handleAgendarConsulta}
            />
            <Pagination page={page} totalPages={totalPages} />
          </>
        )}
</div>
     </section>

      <AppointmentForm
        open={!!agendarTriagemId}
        processOptions={[]}
        triageProcessOptions={[...triageProcessOptions, ...emTriagemProcessOptions]}
        professionals={professionals}
        calendarAppointments={calendarAppointments.map((a) => ({
          profissionalId: a.profissionalId,
          dataHora: a.dataHora,
          dataHoraFim: a.dataHoraFim ?? null,
          status: a.status,
          processoId: a.processoId,
          tipoProfissional: a.tipoProfissional,
          vitimaNome: a.vitimaNome ?? null,
          vitimaCampus: a.vitimaCampus ?? null,
        }))}
        gestor={gestor}
        initialProcessoId={agendarTriagemId ?? undefined}
        initialProcessOption={agendarTriagemOption}
        initialTipo="TRIAGEM"
        lockTipo="TRIAGEM"
        title="Nova triagem"
        onClose={handleAgendarClose}
        showToast={showToast}
      />
 <AppointmentForm
        open={!!agendarConsultaId}
        processOptions={[...processOptions, ...emTriagemProcessOptions]}
        triageProcessOptions={triageProcessOptions}
        professionals={professionals}
        calendarAppointments={calendarAppointments.map((a) => ({
          profissionalId: a.profissionalId,
          dataHora: a.dataHora,
          dataHoraFim: a.dataHoraFim ?? null,
          status: a.status,
          processoId: a.processoId,
          tipoProfissional: a.tipoProfissional,
          vitimaNome: a.vitimaNome ?? null,
          vitimaCampus: a.vitimaCampus ?? null,
        }))}
        gestor={gestor}
        initialProcessoId={agendarConsultaId ?? undefined}
        initialProcessOption={agendarConsultaOption}
        initialTipo={undefined}
        lockTipo={undefined}
        title="Nova consulta"
        onClose={handleAgendarClose}
        showToast={showToast}
      />
    </>
  );
}
