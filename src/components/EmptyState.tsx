import type { TablerIcon } from "@tabler/icons-react";

/**
 * Estado vazio com chamada pra ação em destaque — pra quando a próxima
 * ação não é óbvia (ex: visita sem treino, treino sem série). Depois do
 * primeiro item, a tela volta a usar um link discreto no lugar disso.
 */
export function EmptyState({
  icon: IconComponent,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: TablerIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div role="group" aria-label={title} className="rounded-md border border-dashed border-border p-5 flex flex-col items-center text-center">
      <span className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-brass/15 text-accent-brass-soft mb-3">
        <IconComponent size={20} stroke={1.75} />
      </span>
      <p className="font-display font-semibold text-foreground mb-1">{title}</p>
      <p className="text-sm text-foreground-muted mb-4 max-w-xs">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="rounded-md bg-accent-target hover:bg-accent-target-hover text-foreground text-sm font-medium py-2 px-4 transition-colors"
      >
        {actionLabel}
      </button>
    </div>
  );
}
