/**
 * O catálogo de tipos de resultado não tem uma coluna de formato (ADR-0013
 * do backend) — a interpretação do valor (numérico, sim/não, texto livre)
 * é derivada do nome do tipo, fixo porque o catálogo é fechado e pequeno.
 * Mesma regra usada na validação do backend (SeriesResultService).
 */
export type ResultTypeKind = "boolean" | "text" | "number";

export function resultTypeKind(name: string): ResultTypeKind {
  if (name === "Exercício concluído") return "boolean";
  if (name === "Anotação livre") return "text";
  return "number";
}

/**
 * Unidade de medida por tipo de resultado — só pros tipos numéricos cuja
 * unidade não é óbvia sem ela (Tempo, Agrupamento). Os demais tipos
 * numéricos (Pontuação, Acertos, Erros, Penalidades, Fator de
 * desempenho) variam de escala por modalidade/competição, então uma
 * unidade fixa aqui seria arriscar informação errada — melhor sem.
 */
const RESULT_TYPE_UNITS: Record<string, { label: string; suffix: string }> = {
  "Tempo": { label: "segundos", suffix: "s" },
  "Agrupamento": { label: "cm", suffix: "cm" },
};

export function resultTypeUnit(name: string): { label: string; suffix: string } | null {
  return RESULT_TYPE_UNITS[name] ?? null;
}
