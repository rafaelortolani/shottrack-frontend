import { useEffect, useRef, useState } from "react";

const DELETED_ITEMS = [
  "Seu perfil e suas credenciais de acesso",
  "Armas, munições e acessórios do acervo",
  "Locais de treino, visitas, treinos, séries e resultados",
  "Modalidades praticadas e todo o histórico do dashboard",
];

/**
 * Confirmação reforçada da exclusão de conta (FUC21): lista o que será
 * apagado e exige a senha atual. Erro (senha errada, 429) aparece dentro do
 * diálogo, sem fechá-lo.
 */
export function DeleteAccountDialog({
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
        aria-labelledby="delete-account-title"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-md bg-surface p-5"
      >
        <h2 id="delete-account-title" className="font-display text-base font-semibold mb-2">
          Excluir minha conta
        </h2>
        <p className="text-sm text-foreground-muted mb-2">
          Isso é definitivo e não pode ser desfeito. Será apagado:
        </p>
        <ul className="list-disc pl-5 text-sm text-foreground-muted space-y-0.5 mb-4">
          {DELETED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <label htmlFor="delete-account-password" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
          Senha atual
        </label>
        <input
          id="delete-account-password"
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md bg-background border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-brass/50 focus:border-accent-brass transition-colors"
        />

        {error && (
          <p className="text-sm text-accent-brass-soft mt-2" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={busy || password === ""}
            className="rounded-md bg-accent-brass hover:bg-accent-brass/85 disabled:opacity-60 text-foreground text-sm font-medium py-2 px-4 transition-colors"
          >
            {busy ? "Excluindo..." : "Excluir definitivamente"}
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
