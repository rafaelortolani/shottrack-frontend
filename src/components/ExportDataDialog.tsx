import { useEffect, useRef, useState } from "react";

/**
 * Pede a senha atual antes de baixar a exportação dos dados (FUC21): a cópia leva tudo o que o
 * app guarda do atleta, então quem só tem a sessão aberta não baixa. Mesmo padrão do
 * DeleteAccountDialog: erro (senha errada, 429) aparece dentro do diálogo, sem fechá-lo.
 */
export function ExportDataDialog({
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  error: string | null;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password && !busy) onConfirm(password);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/80 p-4" onClick={busy ? undefined : onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-data-title"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-md bg-surface p-5"
      >
        <h2 id="export-data-title" className="font-display text-base font-semibold mb-2">
          Baixar meus dados
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          O arquivo leva tudo o que guardamos sobre você. Confirme sua senha atual para baixar.
        </p>

        <label htmlFor="export-data-password" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
          Senha atual
        </label>
        <input
          id="export-data-password"
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md bg-background border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
        />

        {error && (
          <p className="text-sm text-accent-target mt-2" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={busy || password === ""}
            className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-background text-sm font-medium py-2 px-4 transition-colors"
          >
            {busy ? "Preparando..." : "Baixar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-sm text-foreground-muted hover:text-foreground disabled:opacity-60 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
