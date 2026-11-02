/** Tipos e constantes do encaminhamento para órgão externo (uso livre). */

export type ExternalReferralDestino =
  | "DEFENSORIA"
  | "REDE_SAUDE"
  | "DELEGACIA"
  | "OUTRO";

export const EXTERNAL_REFERRAL_DESTINOS: readonly ExternalReferralDestino[] = [
  "DEFENSORIA",
  "REDE_SAUDE",
  "DELEGACIA",
  "OUTRO",
];

export const EXTERNAL_REFERRAL_LABELS: Record<
  ExternalReferralDestino,
  string
> = {
  DEFENSORIA: "Defensoria",
  REDE_SAUDE: "Rede de Saúde",
  DELEGACIA: "Delegacia",
  OUTRO: "Outro órgão",
};

export const EXTERNAL_REFERRAL_DETALHES_MIN = 10;
export const EXTERNAL_REFERRAL_DETALHES_MAX = 2000;

export function isExternalReferralDestino(
  value: string,
): value is ExternalReferralDestino {
  return (EXTERNAL_REFERRAL_DESTINOS as readonly string[]).includes(value);
}

export type ExternalReferralFormErrors = Partial<
  Record<"destino" | "detalhes", string>
>;

/** Validação espelho do back (`encaminharProcessoSchema`, só destino externo). */
export function validateExternalReferralForm(input: {
  destino: string;
  detalhes: string;
}): ExternalReferralFormErrors {
  const errors: ExternalReferralFormErrors = {};
  if (!isExternalReferralDestino(input.destino)) {
    errors.destino = "Selecione o órgão de destino.";
  }
  const trimmed = input.detalhes.trim();
  if (trimmed.length < EXTERNAL_REFERRAL_DETALHES_MIN) {
    errors.detalhes = `Descreva o encaminhamento (mínimo ${EXTERNAL_REFERRAL_DETALHES_MIN} caracteres).`;
  } else if (input.detalhes.length > EXTERNAL_REFERRAL_DETALHES_MAX) {
    errors.detalhes = `Detalhes devem ter no máximo ${EXTERNAL_REFERRAL_DETALHES_MAX} caracteres.`;
  }
  return errors;
}
