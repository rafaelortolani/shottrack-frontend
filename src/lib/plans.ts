/** Planos e limites (FUC27 admin, FUC28 atleta): tipos do BFF, conversões e textos. */

export type PlanLimit = {
  key: string;
  value: number;
  unit: "COUNT" | "BYTES" | "PER_HOUR" | "PER_MONTH" | string;
  min: number;
  max: number;
  defaultValue: number;
  enforced: boolean;
  customized: boolean;
};

export type Plan = {
  code: string;
  name: string;
  active: boolean;
  default: boolean;
  athleteCount: number;
  limits: PlanLimit[];
};

export type MyPlan = {
  plan: { code: string; name: string };
  limits: { photosPerSeries: number; photosPerAthlete: number; storageBytesPerAthlete: number; uploadsPerHour: number };
  usage: { photos: number; storageBytes: number };
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  planCode: string;
  planName: string;
  photoCount: number;
  storageBytes: number;
};

export type PlanAuditEntry = {
  at: string;
  action: "LIMIT_CHANGED" | "PLAN_ASSIGNED" | "PLAN_CREATED" | "PLAN_UPDATED";
  actor: { name: string | null; email: string | null; deleted: boolean } | null;
  targetType: string;
  targetPlanCode: string | null;
  targetUser: { name: string | null; email: string | null; deleted: boolean } | null;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
};

export const MB = 1024 * 1024;
export const PLAN_CODE_FORMAT = /^[A-Z][A-Z0-9_]{1,29}$/;
export const PLAN_NAME_MIN = 2;
export const PLAN_NAME_MAX = 60;

export const LIMIT_LABELS: Record<string, string> = {
  PHOTOS_PER_SERIES: "Fotos por série",
  PHOTOS_PER_ATHLETE: "Fotos por atleta",
  STORAGE_BYTES_PER_ATHLETE: "Espaço total por atleta",
  UPLOADS_PER_HOUR: "Envios de foto por hora",
  AI_ANALYSES_PER_MONTH: "Análises de IA por mês",
};

export const AI_NOT_APPLIED_NOTE = "Ainda não aplicado (etapa de análise de alvos)";

export function limitLabel(key: string): string {
  return LIMIT_LABELS[key] ?? key;
}

/** Unidade mostrada ao administrador (o espaço é editado em MB, mesmo vindo em bytes). */
export function limitUnitLabel(unit: string): string {
  switch (unit) {
    case "BYTES":
      return "MB";
    case "PER_HOUR":
      return "por hora";
    case "PER_MONTH":
      return "por mês";
    default:
      return "";
  }
}

// ---- conversão MB <-> bytes (espaço) ----

/** Bytes -> MB com 1 casa decimal (512 MB = 536.870.912 bytes; 1 MB = 1024 × 1024 bytes). */
export function bytesToMb(bytes: number): number {
  return Math.round((bytes / MB) * 10) / 10;
}

/** MB -> bytes inteiros. Arredonda para a 1ª casa decimal de MB antes de converter. */
export function mbToBytes(mb: number): number {
  return Math.round(Math.round(mb * 10) / 10 * MB);
}

/** Texto digitado ("512", "0,5", "1.5") -> MB; `null` se não for número ≥ 0 com no máximo 1 casa decimal. */
export function parseMb(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d)?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Valor do campo de um limite (texto) -> valor do backend (bytes para espaço). `null` = inválido. */
export function parseLimitInput(unit: string, text: string): number | null {
  if (unit === "BYTES") {
    const mb = parseMb(text);
    return mb === null ? null : mbToBytes(mb);
  }
  return /^\d{1,9}$/.test(text.trim()) ? Number(text.trim()) : null;
}

/** Valor do backend -> texto do campo. */
export function limitToInput(unit: string, value: number): string {
  return unit === "BYTES" ? String(bytesToMb(value)).replace(".", ",") : String(value);
}

// ---- formatação ----

const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "38 MB", "0,5 MB", "2 GB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * MB) return `${numberFormat.format(Math.round((bytes / (1024 * MB)) * 10) / 10)} GB`;
  return `${numberFormat.format(bytesToMb(bytes))} MB`;
}

export function formatLimitValue(unit: string, value: number): string {
  return unit === "BYTES" ? formatBytes(value) : new Intl.NumberFormat("pt-BR").format(value);
}

// ---- barra de uso (FUC28) ----

export type UsageLevel = "ok" | "warning" | "limit";

export const USAGE_WARNING_PERCENT = 80;

/** Percentual de uso para a barra, de 0 a 100. Limite 0 com uso > 0 conta como cheio. */
export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, Math.floor((used / limit) * 100)));
}

/** ok < 80% · warning de 80% a 99% · limit a partir de 100%. */
export function usageLevel(used: number, limit: number): UsageLevel {
  if (used >= limit) return "limit"; // limite 0 = nenhum envio permitido: já está no limite
  return (used / limit) * 100 >= USAGE_WARNING_PERCENT ? "warning" : "ok";
}

// ---- mensagens de erro (pt-BR) ----

export const PLAN_ERROR_MESSAGES: Record<string, string> = {
  PLAN_LIMIT_OUT_OF_RANGE: "Valor fora da faixa permitida para este limite.",
  PLAN_LIMIT_INVALID_KEY: "Limite desconhecido ou ainda não aplicado.",
  PLAN_NOT_FOUND: "Plano não encontrado. Atualize a página.",
  PLAN_NOT_ACTIVE: "Este plano está inativo e não pode ser atribuído.",
  PLAN_CODE_INVALID: "Código inválido. Use letras maiúsculas, números e _, começando por letra (2 a 30 caracteres).",
  PLAN_CODE_ALREADY_EXISTS: "Já existe um plano com este código.",
  PLAN_NAME_INVALID: `O nome deve ter de ${PLAN_NAME_MIN} a ${PLAN_NAME_MAX} caracteres.`,
  PLAN_NAME_ALREADY_EXISTS: "Já existe um plano com este nome.",
  PLAN_COUNT_LIMIT_REACHED: "Número máximo de planos atingido.",
  PLAN_DEFAULT_CANNOT_BE_DEACTIVATED: "Defina outro plano como padrão antes de desativar este.",
  PLAN_DEFAULT_REQUIRED: "O plano padrão precisa estar ativo.",
  USER_NOT_FOUND: "Atleta não encontrado.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
};

export function planErrorMessage(code: string | null, fallback: string, status = 0): string {
  if (code && PLAN_ERROR_MESSAGES[code]) return PLAN_ERROR_MESSAGES[code];
  if (status === 403) return PLAN_ERROR_MESSAGES.FORBIDDEN;
  return fallback;
}

/** Texto do histórico para um valor de limite (bytes viram MB). */
export function formatAuditValue(field: string | null, value: string | null): string {
  if (value === null || value === "") return "—";
  if (field === "STORAGE_BYTES_PER_ATHLETE" && /^\d+$/.test(value)) return formatBytes(Number(value));
  if (field === "active") return value === "true" ? "ativo" : value === "false" ? "inativo" : value;
  if (value === "true") return "sim";
  if (value === "false") return "não";
  return value;
}

// ---- uso do atleta na busca do admin (FUC27) ----

/** "0 fotos · 0 MB", "1 foto · 0,5 MB", "12 fotos · 38 MB". */
export function formatUsage(photoCount: number, storageBytes: number): string {
  return `${photoCount} ${photoCount === 1 ? "foto" : "fotos"} · ${formatBytes(storageBytes)}`;
}

/**
 * O que passa do limite do plano do atleta (fotos por atleta e espaço). Vazio = dentro do limite ou sem comparativo
 * (plano fora da lista): nesse caso a tela mostra só o uso. Passar do limite é possível: reduzir um limite nunca apaga fotos.
 */
export function usageOverLimit(usage: { photoCount: number; storageBytes: number }, plan: Plan | undefined): string[] {
  if (!plan) return [];
  const value = (key: string) => plan.limits.find((l) => l.key === key)?.value;
  const photos = value("PHOTOS_PER_ATHLETE");
  const storage = value("STORAGE_BYTES_PER_ATHLETE");
  const over: string[] = [];
  if (photos !== undefined && usage.photoCount > photos) over.push(`fotos (limite ${new Intl.NumberFormat("pt-BR").format(photos)})`);
  if (storage !== undefined && usage.storageBytes > storage) over.push(`espaço (limite ${formatBytes(storage)})`);
  return over;
}
