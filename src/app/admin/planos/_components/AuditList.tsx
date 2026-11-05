import { formatAuditValue, limitLabel, type PlanAuditEntry } from "@/lib/plans";

const FIELD_LABELS: Record<string, string> = { name: "nome", active: "situação", default: "plano padrão" };

function who(user: PlanAuditEntry["actor"]): string {
  if (!user || user.deleted) return "conta excluída";
  return user.name ? `${user.name} (${user.email})` : (user.email ?? "conta excluída");
}

function describe(entry: PlanAuditEntry): string {
  const { action, field, oldValue, newValue, targetPlanCode } = entry;
  switch (action) {
    case "LIMIT_CHANGED":
      return `Plano ${targetPlanCode}: ${limitLabel(field ?? "")}: ${formatAuditValue(field, oldValue)} → ${formatAuditValue(field, newValue)}`;
    case "PLAN_ASSIGNED":
      return `Plano de ${who(entry.targetUser)}: ${oldValue ?? "—"} → ${newValue ?? "—"}`;
    case "PLAN_CREATED":
      return `Plano ${targetPlanCode} criado (${newValue})`;
    case "PLAN_UPDATED":
      return `Plano ${targetPlanCode}: ${FIELD_LABELS[field ?? ""] ?? field}: ${formatAuditValue(field, oldValue)} → ${formatAuditValue(field, newValue)}`;
    default:
      return action;
  }
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Histórico das últimas alterações (UC67). */
export function AuditList({ entries, error }: { entries: PlanAuditEntry[] | null; error: string | null }) {
  return (
    <section aria-labelledby="audit-title" className="mt-8">
      <h2 id="audit-title" className="font-display text-base font-semibold mb-2">
        Histórico
      </h2>
      {error ? (
        <p className="text-sm text-accent-target" role="alert">
          {error}
        </p>
      ) : entries === null ? (
        <p className="text-foreground-muted">Carregando histórico...</p>
      ) : entries.length === 0 ? (
        <p className="text-foreground-muted">Nenhuma alteração registrada.</p>
      ) : (
        <ol className="divide-y divide-border rounded-md bg-surface">
          {entries.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="p-3 text-sm">
              <p>{describe(entry)}</p>
              <p className="text-xs text-foreground-muted">
                {dateFormat.format(new Date(entry.at))} · {who(entry.actor)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
