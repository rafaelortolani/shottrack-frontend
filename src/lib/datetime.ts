export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Data sem hora vinda do backend ("2026-09-28", LocalDate) — formata pelo
 * próprio texto, sem passar por Date, que leria como meia-noite UTC e
 * mostraria o dia anterior no fuso do Brasil.
 */
export function formatLocalDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
