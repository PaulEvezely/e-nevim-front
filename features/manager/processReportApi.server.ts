import { apiFetchJson } from "../auth/apiFetch.server";
import { ApiError } from "../../libs/api.server";
import type {
  PatientProfessionalArea,
  PatientRiskLevel,
} from "./patientUtils";
import type { ExternalReferralDestino } from "./externalReferral";

export {
  EXTERNAL_REFERRAL_DESTINOS,
  EXTERNAL_REFERRAL_LABELS,
} from "./externalReferral";

const DEFAULT_REPORT_ERROR =
  "Não foi possível carregar o processo. Tente novamente em instantes.";

const DEFAULT_FORWARD_ERROR =
  "Não foi possível registrar o encaminhamento. Tente novamente em instantes.";

const DEFAULT_CLOSE_ERROR =
  "Não foi possível encerrar o processo. Tente novamente em instantes.";

/** Processo resumido vindo de `GET /processes/:id/report`. */
export type ReportProcesso = {
  id: string;
  status: string;
  direcionadoPara: PatientProfessionalArea | null;
  prioridadeTriagem: string | null;
  classificacaoRisco: PatientRiskLevel | null;
  observacaoTriagem: string | null;
  triadoEm: string | null;
  abertoEm: string;
  encerradoEm: string | null;
};

export type ReportVitima = {
  nome: string;
  campus: string | null;
  curso: string | null;
  vinculo: string | null;
};

export type ReportDemanda = {
  /** Presente quando o back expõe (GET /processes/:id/report). Ausente até o back atualizar. */
  id?: string;
  tipoViolencia: string | null;
  descricao: string | null;
};

export type ReportConsulta = {
  id: string;
  tipoProfissional: string;
  profissionalId: string;
  dataHora: string;
  status: string;
  modalidade: string | null;
  linkMeet: string | null;
};

export type ReportFrida = {
  consultaId: string;
  nivelRisco: PatientRiskLevel;
  criadoEm: string;
};

export type ReportEncaminhamento = {
  id: string;
  destino: string;
  detalhes: string | null;
  criadoEm: string;
};

export type ReportHistoricoItem = {
  titulo: string;
  data: string;
  profissional: string;
  linkMeet: string | null;
  modalidade: string | null;
};

export type ProcessReport = {
  processo: ReportProcesso;
  vitima: ReportVitima;
  demanda: ReportDemanda;
  consultas: ReportConsulta[];
  frida: ReportFrida[];
  encaminhamentos: ReportEncaminhamento[];
  historicoAtividades: ReportHistoricoItem[];
};

export async function getProcessReport(
  request: Request,
  id: string,
): Promise<ProcessReport> {
  return apiFetchJson<ProcessReport>(
    request,
    `/processes/${encodeURIComponent(id)}/report`,
    undefined,
    DEFAULT_REPORT_ERROR,
  );
}

export type CreateExternalReferralInput = {
  destinoExterno: ExternalReferralDestino;
  detalhesExterno?: string | null;
};

export type ExternalReferralResult = {
  ok: true;
  processoId: string;
};

function mapBackendField(message: string): "destino" | "detalhes" | null {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("destino") ||
    normalized.includes("órgão") ||
    normalized.includes("orgao")
  ) {
    return "destino";
  }
  if (
    normalized.includes("detalhe") ||
    normalized.includes("caracter")
  ) {
    return "detalhes";
  }
  return null;
}

/**
 * Encaminha o processo para um órgão externo
 * (`EM_TRIAGEM -> ENCAMINHADO`; re-encaminhamento permitido em `ENCAMINHADO`).
 */
export async function encaminharParaOrgaoExterno(
  request: Request,
  processoId: string,
  input: CreateExternalReferralInput,
): Promise<ExternalReferralResult> {
  try {
    await apiFetchJson<unknown>(
      request,
      `/processes/${encodeURIComponent(processoId)}/encaminhar`,
      {
        method: "PATCH",
        body: JSON.stringify({
          destinoExterno: input.destinoExterno,
          ...(input.detalhesExterno?.trim()
            ? { detalhesExterno: input.detalhesExterno.trim() }
            : {}),
        }),
      },
      DEFAULT_FORWARD_ERROR,
    );
    return { ok: true, processoId };
  } catch (error) {
    if (error instanceof ApiError) {
      const field = mapBackendField(error.message);
      if (field) {
        throw new ApiError(error.message, {
          status: error.status,
          fieldErrors: { [field]: [error.message] },
        });
      }
    }
    throw error;
  }
}

export type CloseProcessResult = {
  id: string;
  status: string;
  encerradoEm?: string | null;
  consultasCanceladas?: number;
  consultaIds?: string[];
};

/**
 * Encerra o processo (`qualquer status não-terminal -> ENCERRADO`).
 * Irreversível: o back não oferece reabertura.
 */
export async function encerrarProcesso(
  request: Request,
  processoId: string,
): Promise<CloseProcessResult> {
  return apiFetchJson<CloseProcessResult>(
    request,
    `/processes/${encodeURIComponent(processoId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "ENCERRADO" }),
    },
    DEFAULT_CLOSE_ERROR,
  );
}
