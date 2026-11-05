"use client";

import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { callApi } from "@/lib/clientApi";
import {
  AI_NOT_APPLIED_NOTE,
  PLAN_NAME_MAX,
  bytesToMb,
  formatLimitValue,
  limitLabel,
  limitToInput,
  limitUnitLabel,
  parseLimitInput,
  planErrorMessage,
  type Plan,
  type PlanLimit,
} from "@/lib/plans";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../habitualidade/_components/ui";

type Confirm = "active" | "default" | "limits" | null;

const countFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Faixa permitida; o espaço é sempre em MB (a unidade em que o administrador digita). */
function rangeText(limit: PlanLimit) {
  if (limit.unit === "BYTES") return `${countFormat.format(bytesToMb(limit.min))} a ${countFormat.format(bytesToMb(limit.max))} MB`;
  return `${formatLimitValue(limit.unit, limit.min)} a ${formatLimitValue(limit.unit, limit.max)}`;
}

/** Cartão de um plano (FUC27): nome, situação, padrão e a tabela editável de limites. */
export function PlanCard({ plan, onChanged }: { plan: Plan; onChanged: (message?: string) => void }) {
  const uid = useId();
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(plan.limits.map((l) => [l.key, limitToInput(l.unit, l.value)]))
  );
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(plan.name);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = plan.limits.filter((l) => l.enforced);

  // Cada linha: texto digitado, valor convertido (bytes para espaço), erro de validação local e se mudou
  const rows = plan.limits.map((limit) => {
    const text = drafts[limit.key] ?? "";
    const initial = limitToInput(limit.unit, limit.value);
    const parsed = parseLimitInput(limit.unit, text);
    const invalid = limit.enforced && (parsed === null || parsed < limit.min || parsed > limit.max);
    return { limit, text, parsed, invalid, changed: limit.enforced && text !== initial };
  });
  const changedRows = rows.filter((r) => r.changed);
  const hasInvalid = changedRows.some((r) => r.invalid);

  async function patch(path: string, body: unknown, fallback: string, success: string) {
    setBusy(true);
    setError(null);
    const result = await callApi(`/api/admin/plans/${plan.code}${path}`, { method: "PATCH", body, fallback });
    setBusy(false);
    setConfirm(null);
    if (!result.ok) {
      setError(planErrorMessage(result.code, result.message, result.status));
      return false;
    }
    onChanged(success);
    return true;
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const name = nameDraft.trim();
    if (name === plan.name) {
      setRenaming(false);
      return;
    }
    if (await patch("", { name }, "Não foi possível renomear o plano", `Plano renomeado para ${name}.`)) setRenaming(false);
  }

  async function saveLimits() {
    const limits = Object.fromEntries(changedRows.map((r) => [r.limit.key, r.parsed]));
    await patch("/limits", { limits }, "Não foi possível salvar os limites", `Limites do plano ${plan.name} salvos.`);
  }

  const deactivateBlocked = plan.default && plan.active;
  const explainId = `${uid}-explain`;

  return (
    <li className={`rounded-md bg-surface p-4 space-y-4 ${plan.active ? "" : "opacity-70"}`} data-plan={plan.code}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form onSubmit={saveName} className="flex flex-wrap items-end gap-2" aria-label={`Renomear ${plan.name}`}>
              <div className="flex-1 min-w-40">
                <label htmlFor={`${uid}-name`} className="sr-only">
                  Nome do plano
                </label>
                <input
                  id={`${uid}-name`}
                  value={nameDraft}
                  maxLength={PLAN_NAME_MAX}
                  autoFocus
                  onChange={(e) => setNameDraft(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <button type="submit" disabled={busy} className={`min-h-11 ${PRIMARY_BUTTON_CLASS}`}>
                Salvar nome
              </button>
              <button
                type="button"
                className={`min-h-11 ${SECONDARY_BUTTON_CLASS}`}
                onClick={() => {
                  setRenaming(false);
                  setNameDraft(plan.name);
                }}
              >
                Cancelar
              </button>
            </form>
          ) : (
            <h2 className="font-display text-base font-semibold break-words">{plan.name}</h2>
          )}
          <p className="text-sm text-foreground-muted">
            <span className="font-mono">{plan.code}</span> · {plan.athleteCount}{" "}
            {plan.athleteCount === 1 ? "atleta" : "atletas"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.default && <span className="text-xs rounded-full px-2 py-0.5 bg-accent-sage/15 text-accent-sage-soft">Padrão</span>}
          {!plan.active && <span className="text-xs rounded-full px-2 py-0.5 bg-surface-raised text-foreground-muted">Inativo</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!renaming && (
          <button type="button" className={`min-h-11 ${SECONDARY_BUTTON_CLASS}`} onClick={() => setRenaming(true)}>
            Renomear
          </button>
        )}
        <button
          type="button"
          disabled={deactivateBlocked}
          aria-describedby={deactivateBlocked ? explainId : undefined}
          className={`min-h-11 ${SECONDARY_BUTTON_CLASS}`}
          onClick={() => setConfirm("active")}
        >
          {plan.active ? "Desativar" : "Ativar"}
        </button>
        {plan.active && !plan.default && (
          <button type="button" className={`min-h-11 ${SECONDARY_BUTTON_CLASS}`} onClick={() => setConfirm("default")}>
            Definir como padrão
          </button>
        )}
      </div>
      {deactivateBlocked && (
        <p id={explainId} className="text-sm text-foreground-muted">
          Defina outro plano como padrão antes de desativar este.
        </p>
      )}

      <div>
        <h3 className="text-xs uppercase tracking-wide text-foreground-muted mb-2">Limites</h3>
        <ul className="divide-y divide-border">
          {rows.map(({ limit, text, invalid, changed }) => {
            const inputId = `${uid}-${limit.key}`;
            const hintId = `${inputId}-hint`;
            const errorId = `${inputId}-error`;
            const showError = invalid && changed;
            const atDefault = limit.enforced && text === limitToInput(limit.unit, limit.defaultValue);
            return (
              <li key={limit.key} className="py-3 flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto] sm:items-start sm:gap-x-4">
                <div>
                  <label htmlFor={inputId} className="font-medium">
                    {limitLabel(limit.key)}
                  </label>
                  <p id={hintId} className="text-xs text-foreground-muted">
                    {limit.enforced
                      ? `Faixa: ${rangeText(limit)} · ${limit.customized ? "personalizado" : "padrão"}`
                      : AI_NOT_APPLIED_NOTE}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id={inputId}
                    value={limit.enforced ? text : "—"}
                    disabled={!limit.enforced}
                    inputMode={limit.unit === "BYTES" ? "decimal" : "numeric"}
                    autoComplete="off"
                    aria-describedby={showError ? `${hintId} ${errorId}` : hintId}
                    aria-invalid={showError}
                    onChange={(e) => setDrafts((d) => ({ ...d, [limit.key]: e.target.value }))}
                    className={`${INPUT_CLASS} w-28`}
                  />
                  <span className="text-sm text-foreground-muted min-w-12">{limitUnitLabel(limit.unit)}</span>
                  {limit.enforced && (
                    <button
                      type="button"
                      disabled={atDefault}
                      aria-label={`Restaurar padrão: ${limitLabel(limit.key)}`}
                      className={`min-h-11 ${SECONDARY_BUTTON_CLASS}`}
                      onClick={() =>
                        setDrafts((d) => ({ ...d, [limit.key]: limitToInput(limit.unit, limit.defaultValue) }))
                      }
                    >
                      Restaurar padrão
                    </button>
                  )}
                </div>
                {showError && (
                  <p id={errorId} className="text-sm text-accent-target sm:col-span-2" role="alert">
                    Informe um valor de {rangeText(limit)}
                    {limit.unit === "BYTES" ? " (no máximo 1 casa decimal)" : ""}.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <p className="text-sm text-accent-target" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || editable.length === 0 || changedRows.length === 0 || hasInvalid}
          className={`min-h-11 ${PRIMARY_BUTTON_CLASS}`}
          onClick={() => setConfirm("limits")}
        >
          Salvar alterações
        </button>
        {changedRows.length > 0 && (
          <button
            type="button"
            className={`min-h-11 ${SECONDARY_BUTTON_CLASS}`}
            onClick={() => setDrafts(Object.fromEntries(plan.limits.map((l) => [l.key, limitToInput(l.unit, l.value)])))}
          >
            Descartar
          </button>
        )}
      </div>

      {confirm === "active" && (
        <ConfirmDialog
          id={`${uid}-active`}
          title={plan.active ? `Desativar o plano ${plan.name}?` : `Ativar o plano ${plan.name}?`}
          busy={busy}
          busyLabel="Salvando..."
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            patch(
              "",
              { active: !plan.active },
              "Não foi possível alterar o plano",
              plan.active ? `Plano ${plan.name} desativado.` : `Plano ${plan.name} ativado.`
            )
          }
        >
          {plan.active ? (
            <>
              <p>
                {plan.athleteCount} {plan.athleteCount === 1 ? "atleta tem" : "atletas têm"} este plano.
              </p>
              <p>
                Quem já tem este plano mantém o plano e os limites; ele só deixa de poder ser atribuído a outros atletas.
              </p>
            </>
          ) : (
            <p>O plano volta a poder ser atribuído a atletas.</p>
          )}
        </ConfirmDialog>
      )}

      {confirm === "default" && (
        <ConfirmDialog
          id={`${uid}-default`}
          title={`Definir ${plan.name} como padrão?`}
          busy={busy}
          busyLabel="Salvando..."
          onCancel={() => setConfirm(null)}
          onConfirm={() => patch("", { default: true }, "Não foi possível definir o padrão", `${plan.name} agora é o plano padrão.`)}
        >
          <p>Novos cadastros passarão a receber este plano.</p>
        </ConfirmDialog>
      )}

      {confirm === "limits" && (
        <ConfirmDialog
          id={`${uid}-limits`}
          title="Salvar alterações nos limites?"
          busy={busy}
          busyLabel="Salvando..."
          onCancel={() => setConfirm(null)}
          onConfirm={saveLimits}
        >
          <ul className="text-foreground">
            {changedRows.map(({ limit, text }) => (
              <li key={limit.key}>
                {limitLabel(limit.key)}: {formatLimitValue(limit.unit, limit.value)} →{" "}
                {formatLimitValue(limit.unit, parseLimitInput(limit.unit, text) ?? limit.value)}
              </li>
            ))}
          </ul>
          <p>Reduzir um limite não apaga fotos já enviadas; só impede novos envios.</p>
        </ConfirmDialog>
      )}
    </li>
  );
}
