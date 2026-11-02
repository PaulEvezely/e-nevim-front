// Single source of truth for violence type options.
// Used by the public demand form and by the manager demands filters
// so both sides always stay in sync (backend stores them joined
// with ", " in `tipoViolencia`).

export const VIOLENCE_TYPE_OPTIONS: string[] = [
  "Violência psicológica",
  "Violência patrimonial",
  "Violência sexual",
  "Violência física",
  "Violência moral",
  "Violência vicária",
  "Assédio sexual",
  "Assédio moral",
  "Stalking/Perseguição",
];

export function getViolenceTypeOptions(): string[] {
  return [...VIOLENCE_TYPE_OPTIONS];
}
