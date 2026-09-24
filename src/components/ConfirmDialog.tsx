/**
 * Modal de confirmação simples — clicar fora ou em "Cancelar" fecha sem
 * fazer nada; só "Confirmar" dispara a ação.
 */
export function ConfirmDialog({
  id,
  title,
  children,
  busy,
  busyLabel,
  onConfirm,
  onCancel,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  busy: boolean;
  busyLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = `${id}-title`;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/80 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-md bg-surface p-5"
      >
        <h2 id={titleId} className="font-display text-base font-semibold mb-2">
          {title}
        </h2>
        <p className="text-foreground-muted mb-4">{children}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-background text-sm font-medium py-2 px-4 transition-colors"
          >
            {busy ? busyLabel : "Confirmar"}
          </button>
          <button type="button" onClick={onCancel} className="text-sm text-foreground-muted hover:text-foreground transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
