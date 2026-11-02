import {
  createEmptyStructuredAssessment,
  type FridaAnswers,
  type FridaDraft,
  type FridaSubanswers,
  type StructuredAssessment,
} from "./fridaTypes";

const SESSION_PREFIX = "nevim:frida:draft:";
const SAVED_PREFIX = "nevim:frida:saved:";
const SAVED_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Chave de ofuscação do rascunho salvo. Não é segredo criptográfico:
 * serve apenas para evitar leitura trivial do `localStorage` em dispositivos
 * compartilhados. O rascunho expira em 24h.
 */
const OBFUSCATION_KEY = "nevim-frida-draft-v1";

type SavedEnvelope = {
  expiresAt: number;
  data: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function xorBytes(bytes: Uint8Array, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  const output = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    output[index] = bytes[index] ^ keyBytes[index % keyBytes.length];
  }
  return output;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function obfuscate(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return bytesToBase64(xorBytes(bytes, OBFUSCATION_KEY));
}

export function deobfuscate(value: string): string {
  const bytes = xorBytes(base64ToBytes(value), OBFUSCATION_KEY);
  return new TextDecoder().decode(bytes);
}

function parseDraft(value: unknown, consultaId: string): FridaDraft | null {
  if (!isRecord(value)) return null;
  if (value.consultaId !== consultaId) return null;

  const answers = isRecord(value.answers)
    ? (value.answers as FridaAnswers)
    : {};
  const subanswers = isRecord(value.subanswers)
    ? (value.subanswers as FridaSubanswers)
    : {};
  const assessment = isRecord(value.assessment)
    ? ({ ...createEmptyStructuredAssessment(), ...value.assessment } as StructuredAssessment)
    : createEmptyStructuredAssessment();

  return {
    consultaId,
    answers,
    subanswers,
    assessment,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date().toISOString(),
  };
}

function withTimestamp(draft: FridaDraft): FridaDraft {
  return { ...draft, updatedAt: new Date().toISOString() };
}

export function readSessionDraft(consultaId: string): FridaDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_PREFIX + consultaId);
    if (!raw) return null;
    return parseDraft(JSON.parse(raw), consultaId);
  } catch {
    return null;
  }
}

export function saveSessionDraft(draft: FridaDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SESSION_PREFIX + draft.consultaId,
      JSON.stringify(withTimestamp(draft)),
    );
  } catch {
    // Cota cheia ou modo restrito: rascunho automático é best-effort.
  }
}

export function clearSessionDraft(consultaId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_PREFIX + consultaId);
  } catch {
    // Ignora indisponibilidade do storage.
  }
}

export function saveSavedDraft(draft: FridaDraft): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: SavedEnvelope = {
      expiresAt: Date.now() + SAVED_TTL_MS,
      data: obfuscate(JSON.stringify(withTimestamp(draft))),
    };
    window.localStorage.setItem(
      SAVED_PREFIX + draft.consultaId,
      JSON.stringify(envelope),
    );
  } catch {
    // Ignora indisponibilidade do storage.
  }
}

export function getSavedDraftExpiresAt(consultaId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVED_PREFIX + consultaId);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Partial<SavedEnvelope>;
    if (
      typeof envelope.expiresAt !== "number" ||
      typeof envelope.data !== "string"
    ) {
      clearSavedDraft(consultaId);
      return null;
    }
    if (envelope.expiresAt <= Date.now()) {
      clearSavedDraft(consultaId);
      return null;
    }
    return envelope.expiresAt;
  } catch {
    clearSavedDraft(consultaId);
    return null;
  }
}

export function hasSavedDraft(consultaId: string): boolean {
  return getSavedDraftExpiresAt(consultaId) !== null;
}

export function readSavedDraft(consultaId: string): FridaDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVED_PREFIX + consultaId);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Partial<SavedEnvelope>;
    if (
      typeof envelope.expiresAt !== "number" ||
      typeof envelope.data !== "string"
    ) {
      clearSavedDraft(consultaId);
      return null;
    }
    if (envelope.expiresAt <= Date.now()) {
      clearSavedDraft(consultaId);
      return null;
    }
    return parseDraft(JSON.parse(deobfuscate(envelope.data)), consultaId);
  } catch {
    clearSavedDraft(consultaId);
    return null;
  }
}

export function clearSavedDraft(consultaId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SAVED_PREFIX + consultaId);
  } catch {
    // Ignora indisponibilidade do storage.
  }
}
