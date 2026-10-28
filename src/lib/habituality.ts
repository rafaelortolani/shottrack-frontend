import type { CompetitionScope } from "@/lib/visitType";

/**
 * Tipos e formatação da habitualidade (FUC23 atleta / FUC24 admin), conforme o
 * contrato do backend (ADR-0023).
 */

export type ActivityType = "TREINO" | "COMPETICAO" | "QUALQUER";

export type Requirement = {
  activityType: ActivityType;
  minQuantity: number;
  onlyInClub: boolean;
  distinctEvents: boolean;
  minScope: CompetitionScope | null;
};

export type Level = { name: string; position: number; requirements: Requirement[] };

/** Regra ativa com a versão vigente, vista pelo atleta (GET /api/habituality/rules). */
export type AthleteRule = {
  id: string;
  name: string;
  legalReference: string | null;
  validFrom: string;
  windowMonths: number;
  levels: Level[];
  upcomingVersion: { validFrom: string } | null;
};

export type ProgressRequirement = {
  description: string;
  activityType: ActivityType;
  onlyInClub: boolean;
  distinctEvents: boolean;
  minScope: CompetitionScope | null;
  required: number;
  done: number;
  missing: number;
  met: boolean;
};

export type PersonalGoal = { yearlyTrainings: number; doneThisYear: number };

export type HabitualityProgress = {
  rule: { id: string; name: string; legalReference: string | null } | null;
  level: string | null;
  windowMonths: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  compliant: boolean;
  requirements: ProgressRequirement[] | null;
  upcomingChange: { validFrom: string } | null;
  levelRequired: boolean;
  ruleInactive: boolean;
  personalGoal: PersonalGoal | null;
};

/** Regra cadastrada pelo admin (GET /api/admin/habituality/rules). */
export type AdminRule = {
  id: string;
  name: string;
  legalReference: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminVersion = {
  id: string;
  ruleId: string;
  validFrom: string;
  windowMonths: number;
  current: boolean;
  editable: boolean;
  removable: boolean;
  levels: Level[];
};

export const HABITUALITY_FOOTER = "Controle pessoal. A comprovação oficial é feita pelo seu clube.";

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "TREINO", label: "Treino" },
  { value: "COMPETICAO", label: "Competição" },
  { value: "QUALQUER", label: "Qualquer atividade" },
];

const SCOPE_ADJECTIVE: Record<CompetitionScope, [string, string]> = {
  ESTADUAL: ["estadual", "estaduais"],
  NACIONAL: ["nacional", "nacionais"],
  INTERNACIONAL: ["internacional", "internacionais"],
};

/** "8 treinos", "2 competições estaduais, eventos distintos", "4 treinos em clube". */
export function summarizeRequirement(requirement: Requirement): string {
  const plural = requirement.minQuantity !== 1;
  let noun: string;

  if (requirement.activityType === "TREINO") noun = plural ? "treinos" : "treino";
  else if (requirement.activityType === "COMPETICAO") noun = plural ? "competições" : "competição";
  else noun = plural ? "atividades" : "atividade";

  if (requirement.minScope) noun += ` ${SCOPE_ADJECTIVE[requirement.minScope][plural ? 1 : 0]}`;

  let text = `${requirement.minQuantity} ${noun}`;
  if (requirement.onlyInClub) text += " em clube";
  if (requirement.distinctEvents) text += ", eventos distintos";
  return text;
}

/** "12 treinos + 2 competições estaduais, eventos distintos". */
export function summarizeLevel(level: Level): string {
  return level.requirements.length === 0 ? "Sem exigências" : level.requirements.map(summarizeRequirement).join(" + ");
}

/** Total que falta somando todas as exigências ainda não cumpridas. */
export function totalMissing(requirements: ProgressRequirement[]): number {
  return requirements.reduce((sum, r) => sum + Math.max(r.missing, 0), 0);
}

/** Selo da aba: algo exige atenção do atleta (mudança futura ou nível a reescolher). */
export function needsAttention(progress: HabitualityProgress | null): boolean {
  return Boolean(progress && (progress.upcomingChange || progress.levelRequired));
}
