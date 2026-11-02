export const EMAIL_VERIFICATION_STORAGE_KEY = "nevim:email-verification";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type EmailVerification = {
  email: string;
  token: string;
  confirmedAt: number;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function readEmailVerification(): EmailVerification | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(EMAIL_VERIFICATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<EmailVerification>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.token !== "string" ||
      typeof parsed.confirmedAt !== "number"
    ) {
      window.localStorage.removeItem(EMAIL_VERIFICATION_STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.confirmedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(EMAIL_VERIFICATION_STORAGE_KEY);
      return null;
    }

    return {
      email: parsed.email,
      token: parsed.token,
      confirmedAt: parsed.confirmedAt,
    };
  } catch {
    return null;
  }
}

export function saveEmailVerification(params: {
  email: string;
  token: string;
}): void {
  if (typeof window === "undefined") return;

  const record: EmailVerification = {
    email: params.email.trim(),
    token: params.token,
    confirmedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(
      EMAIL_VERIFICATION_STORAGE_KEY,
      JSON.stringify(record),
    );
  } catch {
    // localStorage unavailable (private mode/quota): proceed without persisting.
  }
}

export function clearEmailVerification(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(EMAIL_VERIFICATION_STORAGE_KEY);
  } catch {
    // Ignore localStorage unavailability.
  }
}

export function isEmailVerified(
  email: string,
  verification: EmailVerification | null,
): boolean {
  if (!verification) return false;
  return normalizeEmail(verification.email) === normalizeEmail(email);
}
