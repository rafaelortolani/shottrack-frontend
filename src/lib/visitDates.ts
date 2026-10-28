/**
 * Datas de visita (FUC25). O backend recebe ISO-8601 com fuso (`startedAt`/
 * `endedAt`); o `<input type="datetime-local">` trabalha em hora local, sem
 * fuso. Convertemos nas duas pontas: `toDateTimeLocal` para preencher o campo e
 * `fromDateTimeLocal` (instante em UTC, "Z") para enviar.
 */
export const MAX_VISIT_AGE_MONTHS = 12;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-10-28T14:30" na hora local, o formato do `datetime-local`. */
export function toDateTimeLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor do campo (hora local) → ISO-8601 em UTC para o backend. */
export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
}

/** Limite inferior aceito para o início: 12 meses antes de `now`. */
export function oldestVisitStart(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - MAX_VISIT_AGE_MONTHS);
  return d;
}

/**
 * Valida um valor de `datetime-local`. `checkAge` aplica o limite de 12 meses
 * (só o início tem; o fim só não pode ser futuro). O backend revalida tudo.
 */
export function validateVisitDate(value: string, label: string, options: { checkAge: boolean; now?: Date }): string | null {
  const now = options.now ?? new Date();
  if (value === "") return `Informe ${label}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `Informe ${label} válido`;
  if (date.getTime() > now.getTime()) return "A data não pode ser no futuro";
  if (options.checkAge && date.getTime() < oldestVisitStart(now).getTime()) {
    return `A data não pode ser anterior a ${MAX_VISIT_AGE_MONTHS} meses atrás`;
  }
  return null;
}
