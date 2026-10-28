import { resultTypeUnit } from "@/lib/resultTypeFormat";

/**
 * Tipos, formatação e estado-na-URL do dashboard em abas (FUC15 v6 / FUC16).
 */

// ---- contratos do backend (UC42 v7 / UC46) ----

/** Melhor valor de um tipo de resultado: recorde, destaque de modalidade ou de treino. */
export type Highlight = { resultTypeName: string; value: number };

/** Valor do período atual e do anterior (mesmo nº de dias do mês anterior). */
export type Indicator = { value: number; previous: number };

export type ActiveVisit = {
  visitId: string;
  trainingLocationName: string | null;
  startedAt: string;
  activeTrainingModalityNames: string[];
};

export type RecentTraining = {
  trainingId: string;
  visitId: string | null; // completado pelo BFF a partir de /api/visits
  startedAt: string;
  trainingLocationName: string | null;
  modalityName: string | null;
  highlight?: Highlight;
};

export type Dashboard = {
  mainAction: { type: "CONTINUE_VISIT" | "START_VISIT"; activeVisit: ActiveVisit | null };
  trainingsThisMonth: Indicator;
  shotsThisMonth: Indicator;
  modalitiesPracticed: Indicator;
  recentTrainings: RecentTraining[];
  records: Highlight[];
  suggestedEvolution: { modalityId: string; resultTypeId: string } | null;
};

export type ModalitySummary = {
  modalityId: string;
  modalityName: string;
  trainingCount: number;
  best: Highlight | null;
};

/** Modalidade praticada com os tipos de resultado NUMÉRICOS configurados (os únicos com evolução). */
export type Option = { id: string; name: string };
export type ModalityOption = Option & { resultTypes: Option[] };

export type EvolutionPoint = { date: string; value: number };

// ---- abas: pra incluir uma nova (ex.: Habitualidade), acrescente aqui e no mapa do DashboardShell ----

export const DASHBOARD_TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "evolucao", label: "Evolução" },
  { id: "recordes", label: "Recordes" },
  { id: "modalidades", label: "Modalidades" },
  { id: "habitualidade", label: "Habitualidade" },
] as const;

export type DashboardTabId = (typeof DASHBOARD_TABS)[number]["id"];

export type Period = "7d" | "30d" | "3m" | "1a";
export type Mode = "MEDIA" | "MELHOR";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "3m", label: "3 meses" },
  { value: "1a", label: "1 ano" },
];

export const MODES: { value: Mode; label: string; param: string }[] = [
  { value: "MEDIA", label: "Média", param: "media" },
  { value: "MELHOR", label: "Melhor", param: "melhor" },
];

// ---- estado na URL (?aba=&modalidade=&tipo=&mod=&periodo=&modo=&comparar=) ----

export type DashboardParams = {
  aba: DashboardTabId;
  /** Filtro global de modalidade ("" = todas). */
  modalidade: string;
  /** Evolução: tipo de resultado e, com o filtro em "Todas", a modalidade escolhida na própria aba. */
  tipo: string;
  mod: string;
  periodo: Period;
  modo: Mode;
  comparar: boolean;
};

export const DEFAULT_PERIOD: Period = "30d";
export const DEFAULT_MODE: Mode = "MEDIA";

type SearchParamsLike = { get(name: string): string | null; toString(): string };

export function parseParams(searchParams: SearchParamsLike): DashboardParams {
  const aba = searchParams.get("aba");
  const periodo = searchParams.get("periodo");
  const modo = searchParams.get("modo");

  return {
    aba: DASHBOARD_TABS.find((tab) => tab.id === aba)?.id ?? "resumo",
    modalidade: searchParams.get("modalidade") ?? "",
    tipo: searchParams.get("tipo") ?? "",
    mod: searchParams.get("mod") ?? "",
    periodo: PERIODS.find((p) => p.value === periodo)?.value ?? DEFAULT_PERIOD,
    modo: MODES.find((m) => m.param === modo)?.value ?? DEFAULT_MODE,
    comparar: searchParams.get("comparar") === "1",
  };
}

/**
 * Monta o href do dashboard a partir da URL atual aplicando `overrides`
 * (`null` remove o parâmetro). Trocar de aba preserva o resto — modalidade e a
 * seleção da Evolução —; a aba padrão (Resumo) não aparece na URL.
 */
export function dashboardHref(current: SearchParamsLike, overrides: Record<string, string | null>): string {
  const query = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") query.delete(key);
    else query.set(key, value);
  }
  if (query.get("aba") === "resumo") query.delete("aba");
  const text = query.toString();
  return text ? `/dashboard?${text}` : "/dashboard";
}

// ---- formatação ----

export function formatNumber(value: number): string {
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function formatValue(value: number, resultTypeName: string): string {
  const unit = resultTypeUnit(resultTypeName);
  return `${formatNumber(value)}${unit ? ` ${unit.suffix}` : ""}`;
}

export function formatHighlight(highlight: Highlight): string {
  return `${highlight.resultTypeName}: ${formatValue(highlight.value, highlight.resultTypeName)}`;
}

/**
 * Delta de um indicador contra o período anterior. Nunca vermelho: melhora
 * em verde, o resto neutro. Sem anterior (previous = 0) não há comparação → "—".
 */
export function formatDelta(indicator: Indicator): { text: string; label: string; tone: "positive" | "neutral" } {
  const { value, previous } = indicator;

  if (previous === 0) {
    return { text: "—", label: "Sem dados do mês anterior para comparar", tone: "neutral" };
  }

  const diff = value - previous;
  if (diff > 0) {
    return { text: `▲ ${formatNumber(diff)} vs mês anterior`, label: `${formatNumber(diff)} a mais que no mês anterior`, tone: "positive" };
  }
  if (diff < 0) {
    return { text: `▼ ${formatNumber(-diff)} vs mês anterior`, label: `${formatNumber(-diff)} a menos que no mês anterior`, tone: "neutral" };
  }
  return { text: "= igual ao mês anterior", label: "Igual ao mês anterior", tone: "neutral" };
}

// ---- período da evolução ----

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/**
 * Janela do período, igual à do backend (UC46): "7d" com hoje = dia 10
 * cobre os dias 4 a 10, sempre em UTC (dia do treino no backend é UTC).
 */
export function periodWindow(period: Period): { startDate: string; endDate: string } {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end);
  if (period === "7d") start.setUTCDate(start.getUTCDate() - 7);
  if (period === "30d") start.setUTCDate(start.getUTCDate() - 30);
  if (period === "3m") start.setUTCMonth(start.getUTCMonth() - 3);
  if (period === "1a") start.setUTCFullYear(start.getUTCFullYear() - 1);
  start.setUTCDate(start.getUTCDate() + 1);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

/** Nº de dias da janela — o período anterior tem a mesma duração (UC46) e termina um dia antes dela. */
export function windowLengthDays(window: { startDate: string; endDate: string }): number {
  return dayNumber(window.endDate) - dayNumber(window.startDate) + 1;
}

export function shiftDate(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);
}

/** Tipo inicial da evolução: o primeiro que já tem recorde (tem dado); senão, o primeiro. */
export function defaultResultTypeId(modality: ModalityOption, recordTypeNames: string[]): string {
  return (modality.resultTypes.find((t) => recordTypeNames.includes(t.name)) ?? modality.resultTypes[0]).id;
}

/** A modalidade mais treinada entre as candidatas (empate: a primeira). */
export function mostTrained(candidates: ModalityOption[], summaries: ModalitySummary[]): ModalityOption {
  const count = (modality: ModalityOption) => summaries.find((s) => s.modalityId === modality.id)?.trainingCount ?? 0;
  return candidates.reduce((best, modality) => (count(modality) > count(best) ? modality : best));
}

/**
 * Resultado do UC46: lista direta, ou `{ points, previousPoints }` com
 * `comparePrevious=true`.
 */
export function parseEvolutionResponse(data: unknown): { points: EvolutionPoint[]; previousPoints: EvolutionPoint[] } {
  const toPoints = (list: { date: string; value: number | string }[]) =>
    list.map((p) => ({ date: p.date, value: Number(p.value) }));

  if (Array.isArray(data)) return { points: toPoints(data), previousPoints: [] };
  const comparison = data as { points: never[]; previousPoints: never[] };
  return { points: toPoints(comparison.points ?? []), previousPoints: toPoints(comparison.previousPoints ?? []) };
}

/** O que cada aba recebe do shell: dados já carregados, filtro e como mexer na URL. */
export type TabContext = {
  dashboard: Dashboard;
  modalities: ModalitySummary[];
  /** Modalidades praticadas com tipos numéricos (as que têm evolução). */
  options: ModalityOption[];
  /** Filtro global de modalidade já validado ("" = todas). */
  filterId: string;
  params: DashboardParams;
  hrefFor: (overrides: Record<string, string | null>) => string;
  setParams: (overrides: Record<string, string | null>) => void;
};
