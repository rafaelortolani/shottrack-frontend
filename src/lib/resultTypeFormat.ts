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
