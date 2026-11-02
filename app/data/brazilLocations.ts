import brasilData from "./brasil.json";

export interface BrazilState {
  uf: string;
  name: string;
}

interface BrasilJsonEntry {
  nome: string;
  municipios: string[];
}

const brasilEntries = brasilData as Record<string, BrasilJsonEntry>;

const sortedStates: BrazilState[] = Object.entries(brasilEntries)
  .map(([uf, entry]) => ({ uf, name: entry.nome }))
  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

const citiesByUf = new Map<string, string[]>();

for (const [uf, entry] of Object.entries(brasilEntries)) {
  const normalizedUf = uf.trim().toUpperCase();
  const sortedCities = [...entry.municipios].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  citiesByUf.set(normalizedUf, sortedCities);
}

export function getBrazilStatesSync(): BrazilState[] {
  return sortedStates;
}

export function getCitiesByUfSync(uf: string): string[] {
  const normalizedUf = uf.trim().toUpperCase();
  if (!normalizedUf) return [];
  return citiesByUf.get(normalizedUf) ?? [];
}
