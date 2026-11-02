export const DEMAND_DRAFT_STORAGE_KEY = "nevim:demand-draft";

export type DemandDraft = {
  fullName: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  institutionBond: string;
  campus: string;
  course: string;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function readDemandDraft(): Partial<DemandDraft> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(DEMAND_DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;

    return {
      fullName: readString(parsed.fullName),
      email: readString(parsed.email),
      phone: readString(parsed.phone),
      state: readString(parsed.state),
      city: readString(parsed.city),
      institutionBond: readString(parsed.institutionBond),
      campus: readString(parsed.campus),
      course: readString(parsed.course),
    };
  } catch {
    return null;
  }
}

export function saveDemandDraft(draft: DemandDraft): void {
  if (typeof window === "undefined") return;

  const hasContent = Object.values(draft).some((value) => value.trim() !== "");
  try {
    if (!hasContent) {
      window.sessionStorage.removeItem(DEMAND_DRAFT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(
      DEMAND_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
  } catch {
    // sessionStorage unavailable: the form keeps working without a draft.
  }
}

export function clearDemandDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DEMAND_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore sessionStorage unavailability.
  }
}

const DEMAND_PENDING_STORAGE_KEY = "nevim:demand-pending";

const MAX_PENDING_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Full demand payload kept between the "Send demand" click and the e-mail
 * confirmation, so the submission resumes automatically after the user
 * confirms the link (e.g. same-tab round trip to /verificar-email).
 */
export type DemandPendingPayload = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  institutionBond: string;
  campus: string;
  course: string;
  occurrenceLocation: string;
  violenceTypes: string[];
  description: string;
  lgpdConsent: boolean;
};

export type PendingDemand = {
  payload: DemandPendingPayload;
  savedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readDemandPending(): PendingDemand | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(DEMAND_PENDING_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const payload = parsed.payload;
    if (
      !isRecord(payload) ||
      typeof parsed.savedAt !== "number" ||
      !Array.isArray(payload.violenceTypes)
    ) {
      window.sessionStorage.removeItem(DEMAND_PENDING_STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.savedAt > MAX_PENDING_AGE_MS) {
      window.sessionStorage.removeItem(DEMAND_PENDING_STORAGE_KEY);
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      payload: {
        fullName: readString(payload.fullName),
        email: readString(payload.email),
        phone: readString(payload.phone),
        city: readString(payload.city),
        institutionBond: readString(payload.institutionBond),
        campus: readString(payload.campus),
        course: readString(payload.course),
        occurrenceLocation: readString(payload.occurrenceLocation),
        violenceTypes: payload.violenceTypes.filter(
          (item): item is string => typeof item === "string",
        ),
        description: readString(payload.description),
        lgpdConsent: payload.lgpdConsent === true,
      },
    };
  } catch {
    return null;
  }
}

export function saveDemandPending(payload: DemandPendingPayload): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      DEMAND_PENDING_STORAGE_KEY,
      JSON.stringify({ payload, savedAt: Date.now() }),
    );
  } catch {
    // sessionStorage unavailable: the user can still confirm and send manually.
  }
}

export function clearDemandPending(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DEMAND_PENDING_STORAGE_KEY);
  } catch {
    // Ignore sessionStorage unavailability.
  }
}
