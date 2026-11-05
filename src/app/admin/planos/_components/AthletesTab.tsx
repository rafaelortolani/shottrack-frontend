"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { callApi } from "@/lib/clientApi";
import { formatUsage, planErrorMessage, usageOverLimit, type AdminUser, type Plan } from "@/lib/plans";
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from "../../habitualidade/_components/ui";

const MIN_SEARCH = 3;

/** Aba "Atletas" (UC65): busca por e-mail e troca de plano. Sem listar todos os atletas. */
export function AthletesTab({ plans, onChanged }: { plans: Plan[]; onChanged: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUser[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim();
    setResults(null);
    if (term.length < MIN_SEARCH) {
      setSearchError(`Digite ao menos ${MIN_SEARCH} caracteres do e-mail.`);
      return;
    }
    setSearchError(null);
    setSearching(true);
    const result = await callApi<AdminUser[]>(`/api/admin/users?email=${encodeURIComponent(term)}`, {
      fallback: "Não foi possível buscar o atleta",
    });
    setSearching(false);
    if (!result.ok) {
      setSearchError(planErrorMessage(result.code, result.message, result.status));
      return;
    }
    setResults(result.data);
  }

  function replace(user: AdminUser) {
    setResults((current) => current?.map((u) => (u.id === user.id ? user : u)) ?? null);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} noValidate role="search" aria-label="Buscar atleta" className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-48">
          <label htmlFor="athlete-search" className={LABEL_CLASS}>
            E-mail do atleta
          </label>
          <input
            id="athlete-search"
            type="search"
            value={query}
            maxLength={254}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Parte do e-mail"
            className={INPUT_CLASS}
          />
        </div>
        <button type="submit" disabled={searching} className={`min-h-11 ${PRIMARY_BUTTON_CLASS}`}>
          {searching ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {searchError && (
        <p className="text-sm text-accent-target" role="alert">
          {searchError}
        </p>
      )}

      {results !== null && results.length === 0 && (
        <p className="text-foreground-muted" role="status">
          Atleta não encontrado.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="space-y-3" aria-label="Resultado da busca">
          {results.map((user) => (
            <AthleteRow key={user.id} user={user} plans={plans} onAssigned={replace} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AthleteRow({
  user,
  plans,
  onAssigned,
  onChanged,
}: {
  user: AdminUser;
  plans: Plan[];
  onAssigned: (user: AdminUser) => void;
  onChanged: (message: string) => void;
}) {
  const activePlans = plans.filter((p) => p.active);
  const current = plans.find((p) => p.code === user.planCode);
  const [target, setTarget] = useState(activePlans.some((p) => p.code === user.planCode) ? user.planCode : "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectId = `plan-${user.id}`;
  const targetPlan = plans.find((p) => p.code === target);
  const over = usageOverLimit(user, current);

  async function assign() {
    setBusy(true);
    setError(null);
    const result = await callApi<AdminUser>(`/api/admin/users/${user.id}/plan`, {
      method: "PUT",
      body: { planCode: target },
      fallback: "Não foi possível alterar o plano",
    });
    setBusy(false);
    setConfirming(false);
    if (!result.ok) {
      setError(planErrorMessage(result.code, result.message, result.status));
      return;
    }
    onAssigned(result.data);
    onChanged(`Plano de ${user.name} alterado para ${result.data.planName}.`);
  }

  return (
    <li className="rounded-md bg-surface p-4 space-y-3">
      <div className="min-w-0">
        <p className="font-medium break-words">{user.name}</p>
        <p className="text-sm text-foreground-muted break-all">{user.email}</p>
        <p className="text-sm mt-1">
          Plano atual: <span className="font-medium">{user.planName}</span>
          {current && !current.active && (
            <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-surface-raised text-foreground-muted">Inativo</span>
          )}
        </p>
        <p className="text-sm mt-1" data-testid="athlete-usage">
          Uso: <span className="font-medium">{formatUsage(user.photoCount, user.storageBytes)}</span>
        </p>
        {over.length > 0 && (
          <p className="text-sm text-accent-brass-soft mt-1" data-testid="athlete-over-limit">
            Acima do limite do plano: {over.join(" e ")}. As fotos já enviadas não são apagadas; só novos envios ficam bloqueados.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-40">
          <label htmlFor={selectId} className={LABEL_CLASS}>
            Novo plano
          </label>
          <select id={selectId} value={target} onChange={(e) => setTarget(e.target.value)} className={INPUT_CLASS}>
            {target === "" && (
              <option value="" disabled>
                Selecione
              </option>
            )}
            {activePlans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy || target === "" || target === user.planCode}
          onClick={() => setConfirming(true)}
          className={`min-h-11 ${PRIMARY_BUTTON_CLASS}`}
          aria-label={`Alterar plano de ${user.name}`}
        >
          Alterar plano
        </button>
      </div>

      {error && (
        <p className="text-sm text-accent-target" role="alert">
          {error}
        </p>
      )}

      {confirming && (
        <ConfirmDialog
          id={`assign-${user.id}`}
          title="Alterar o plano do atleta?"
          busy={busy}
          busyLabel="Salvando..."
          onCancel={() => setConfirming(false)}
          onConfirm={assign}
        >
          <p>
            {user.name} passará de {user.planName} para {targetPlan?.name ?? target}. Os novos limites valem a partir de agora;
            fotos já enviadas não são apagadas.
          </p>
        </ConfirmDialog>
      )}
    </li>
  );
}
