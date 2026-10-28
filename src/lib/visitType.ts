export type VisitType = "TREINO" | "COMPETICAO";
export type CompetitionScope = "ESTADUAL" | "NACIONAL" | "INTERNACIONAL";

export const VISIT_TYPES: { value: VisitType; label: string }[] = [
  { value: "TREINO", label: "Treino" },
  { value: "COMPETICAO", label: "Competição" },
];

export const COMPETITION_SCOPES: { value: CompetitionScope; label: string }[] = [
  { value: "ESTADUAL", label: "Estadual" },
  { value: "NACIONAL", label: "Nacional" },
  { value: "INTERNACIONAL", label: "Internacional" },
];

/** "Treino", "Competição" ou "Competição · Estadual" — visitas antigas sem tipo contam como treino. */
export function visitTypeLabel(visitType?: VisitType | null, scope?: CompetitionScope | null): string {
  if (visitType !== "COMPETICAO") return "Treino";
  const scopeLabel = COMPETITION_SCOPES.find((s) => s.value === scope)?.label;
  return scopeLabel ? `Competição · ${scopeLabel}` : "Competição";
}
