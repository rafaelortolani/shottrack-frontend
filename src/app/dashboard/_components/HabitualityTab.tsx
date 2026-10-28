"use client";

import { useEffect, useState } from "react";
import { callApi } from "@/lib/clientApi";
import { formatLocalDate } from "@/lib/datetime";
import {
  HABITUALITY_FOOTER,
  summarizeLevel,
  totalMissing,
  type AthleteRule,
  type HabitualityProgress,
  type PersonalGoal,
} from "@/lib/habituality";
import { FIELD_LABEL_CLASS, PRIMARY_LINK_CLASS, SELECT_CLASS, SectionHeader } from "./shared";

const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-border px-4 py-2 text-sm text-foreground-muted hover:text-foreground hover:border-accent-target transition-colors disabled:opacity-60";
const PRIMARY_BUTTON_CLASS = `${PRIMARY_LINK_CLASS} disabled:opacity-60`;
const INPUT_CLASS =
  "rounded-md bg-background border border-border px-3 py-2 text-sm pointer-coarse:text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

/**
 * Aba Habitualidade (FUC23): acompanhamento de uma regra e nível, progresso por
 * exigência e meta pessoal. Não usa o filtro global de modalidade.
 */
export function HabitualityTab({ progress, reload }: { progress: HabitualityProgress; reload: () => Promise<void> }) {
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function stopTracking() {
    setBusy(true);
    setError(null);
    const result = await callApi("/api/habituality/tracking", {
      method: "DELETE",
      fallback: "Não foi possível remover o acompanhamento",
    });
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    await reload();
    setBusy(false);
  }

  const tracking = progress.rule !== null;
  const showChooser = choosing;

  return (
    <div className="space-y-6">
      {progress.upcomingChange && (
        <div
          role="status"
          className="rounded-md bg-accent-brass/15 border-l-2 border-accent-brass px-4 py-3 text-sm"
        >
          A regra muda em {formatLocalDate(progress.upcomingChange.validFrom)}.
        </div>
      )}

      <section aria-labelledby="habituality-heading">
        <SectionHeader id="habituality-heading" title="Habitualidade" />

        {showChooser ? (
          <Chooser
            progress={progress}
            onDone={async () => {
              setChoosing(false);
              await reload();
            }}
            onCancel={() => setChoosing(false)}
          />
        ) : !tracking ? (
          <NotTracking onChoose={() => setChoosing(true)} />
        ) : progress.ruleInactive ? (
          <Notice
            title={`A regra “${progress.rule!.name}” foi desativada.`}
            text="Escolha outra regra para voltar a acompanhar seu progresso."
          >
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setChoosing(true)}>
              Escolher outra regra
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={stopTracking}>
              Parar de acompanhar
            </button>
          </Notice>
        ) : progress.levelRequired ? (
          <Notice
            title={`O nível “${progress.level ?? ""}” não existe mais na versão vigente de “${progress.rule!.name}”.`}
            text="Escolha um nível da versão atual para continuar acompanhando."
          >
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setChoosing(true)}>
              Escolher nível
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={stopTracking}>
              Parar de acompanhar
            </button>
          </Notice>
        ) : (
          <Tracking
            progress={progress}
            busy={busy}
            onChange={() => setChoosing(true)}
            onStop={stopTracking}
          />
        )}

        {error && (
          <p className="text-sm text-accent-target mt-2" role="alert">
            {error}
          </p>
        )}
      </section>

      <PersonalGoalBlock goal={progress.personalGoal} reload={reload} />

      <p className="text-xs text-foreground-muted">{HABITUALITY_FOOTER}</p>
    </div>
  );
}

function NotTracking({ onChoose }: { onChoose: () => void }) {
  return (
    <div className="rounded-md bg-surface p-4 space-y-3">
      <p className="text-sm text-foreground-muted">
        Acompanhe quanto falta para cumprir a exigência de habitualidade da norma e do nível que você escolher.
        As visitas encerradas entram na contagem.
      </p>
      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onChoose}>
        Escolher regra e nível
      </button>
    </div>
  );
}

function Notice({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div role="alert" className="rounded-md bg-surface p-4 border-l-2 border-accent-brass space-y-3">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-foreground-muted">{text}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Tracking({
  progress,
  busy,
  onChange,
  onStop,
}: {
  progress: HabitualityProgress;
  busy: boolean;
  onChange: () => void;
  onStop: () => void;
}) {
  const rule = progress.rule!;
  const requirements = progress.requirements ?? [];
  const missing = totalMissing(requirements);

  return (
    <div className="rounded-md bg-surface p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold">{rule.name}</p>
          {rule.legalReference && <p className="text-sm text-foreground-muted">{rule.legalReference}</p>}
          <p className="text-sm mt-1">
            Nível: <span className="font-medium">{progress.level}</span>
          </p>
          {progress.periodStart && (
            <p className="text-sm text-foreground-muted">
              Janela de {formatLocalDate(progress.periodStart)} a hoje
            </p>
          )}
        </div>
        <span
          className={`text-sm font-medium rounded-full px-3 py-1 ${
            progress.compliant ? "bg-positive/15 text-positive" : "bg-accent-brass/15 text-accent-brass-soft"
          }`}
        >
          {progress.compliant ? "Cumprido" : `Faltam ${missing}`}
        </span>
      </div>

      <ul className="space-y-3">
        {requirements.map((requirement, index) => {
          const percent = requirement.required > 0 ? Math.min(100, (requirement.done / requirement.required) * 100) : 100;
          return (
            <li key={index}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>{requirement.description}</span>
                <span className="font-display text-foreground-muted whitespace-nowrap">
                  {requirement.done} de {requirement.required}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={requirement.description}
                aria-valuemin={0}
                aria-valuemax={requirement.required}
                aria-valuenow={Math.min(requirement.done, requirement.required)}
                className="h-2 rounded-full bg-background overflow-hidden mt-1"
              >
                <div
                  className={`h-full rounded-full ${requirement.met ? "bg-positive" : "bg-accent-target"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onChange}>
          Trocar regra ou nível
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={onStop}>
          Parar de acompanhar
        </button>
      </div>
    </div>
  );
}

/** Seletor de regra (ativas) e nível, com as exigências do nível à vista. */
function Chooser({
  progress,
  onDone,
  onCancel,
}: {
  progress: HabitualityProgress;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [rules, setRules] = useState<AthleteRule[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ruleId, setRuleId] = useState(progress.rule?.id ?? "");
  const [levelName, setLevelName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    callApi<AthleteRule[]>("/api/habituality/rules", { fallback: "Não foi possível carregar as regras" }).then(
      (result) => {
        if (cancelled) return;
        if (result.ok) setRules(result.data);
        else setLoadError(result.message);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const rule = rules?.find((r) => r.id === ruleId) ?? null;
  const level = rule?.levels.find((l) => l.name === levelName) ?? null;

  async function confirm() {
    if (!rule || !level) return;
    setSaving(true);
    setError(null);
    const result = await callApi("/api/habituality/tracking", {
      method: "PUT",
      body: { ruleId: rule.id, levelName: level.name },
      fallback: "Não foi possível salvar o acompanhamento",
    });
    if (!result.ok) {
      setError(result.message);
      setSaving(false);
      return;
    }
    await onDone();
  }

  return (
    <form
      aria-label="Escolher regra e nível"
      onSubmit={(e) => {
        e.preventDefault();
        confirm();
      }}
      className="rounded-md bg-surface p-4 space-y-3"
    >
      {loadError ? (
        <p className="text-sm text-accent-target" role="alert">
          {loadError}
        </p>
      ) : rules === null ? (
        <p className="text-sm text-foreground-muted">Carregando regras...</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-foreground-muted">Nenhuma regra de habitualidade disponível no momento.</p>
      ) : (
        <>
          <div>
            <label htmlFor="habituality-rule" className={FIELD_LABEL_CLASS}>
              Regra
            </label>
            <select
              id="habituality-rule"
              value={ruleId}
              onChange={(e) => {
                setRuleId(e.target.value);
                setLevelName("");
              }}
              className={`${SELECT_CLASS} w-full`}
            >
              <option value="" disabled>
                Selecione
              </option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {rule?.legalReference && <p className="text-xs text-foreground-muted mt-1">{rule.legalReference}</p>}
          </div>

          {rule && (
            <div>
              <label htmlFor="habituality-level" className={FIELD_LABEL_CLASS}>
                Nível
              </label>
              <select
                id="habituality-level"
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                className={`${SELECT_CLASS} w-full`}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {rule.levels.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
              {level && (
                <p className="text-sm text-foreground-muted mt-1">
                  Exigências: {summarizeLevel(level)} nos últimos {rule.windowMonths}{" "}
                  {rule.windowMonths === 1 ? "mês" : "meses"}.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {error && (
        <p className="text-sm text-accent-target" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!level || saving} className={PRIMARY_BUTTON_CLASS}>
          {saving ? "Salvando..." : "Confirmar"}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Meta pessoal de treinos no ano (UC58): barra feitos/meta e edição inline. */
function PersonalGoalBlock({ goal, reload }: { goal: PersonalGoal | null; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setValue(goal ? String(goal.yearlyTrainings) : "");
    setError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const yearlyTrainings = Number(value);
    if (!Number.isInteger(yearlyTrainings) || yearlyTrainings < 1) {
      setError("Informe um número inteiro maior que zero");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await callApi("/api/habituality/personal-goal", {
      method: "PUT",
      body: { yearlyTrainings },
      fallback: "Não foi possível salvar a meta",
    });
    if (!result.ok) {
      setError(result.message);
      setSaving(false);
      return;
    }
    await reload();
    setSaving(false);
    setEditing(false);
  }

  async function remove() {
    setSaving(true);
    setError(null);
    const result = await callApi("/api/habituality/personal-goal", {
      method: "DELETE",
      fallback: "Não foi possível remover a meta",
    });
    if (!result.ok) {
      setError(result.message);
      setSaving(false);
      return;
    }
    await reload();
    setSaving(false);
  }

  const percent = goal && goal.yearlyTrainings > 0 ? Math.min(100, (goal.doneThisYear / goal.yearlyTrainings) * 100) : 0;

  return (
    <section aria-labelledby="personal-goal-heading">
      <SectionHeader id="personal-goal-heading" title="Minha meta de treinos no ano" />

      <div className="rounded-md bg-surface p-4 space-y-3">
        {editing ? (
          <form onSubmit={save} noValidate className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="personal-goal" className={FIELD_LABEL_CLASS}>
                Treinos no ano
              </label>
              <input
                id="personal-goal"
                type="number"
                inputMode="numeric"
                min={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={`${INPUT_CLASS} w-32`}
              />
            </div>
            <button type="submit" disabled={saving} className={PRIMARY_BUTTON_CLASS}>
              {saving ? "Salvando..." : "Salvar meta"}
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </form>
        ) : goal ? (
          <>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>Treinos neste ano</span>
              <span className="font-display text-foreground-muted whitespace-nowrap">
                {goal.doneThisYear} de {goal.yearlyTrainings}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Meta de treinos no ano"
              aria-valuemin={0}
              aria-valuemax={goal.yearlyTrainings}
              aria-valuenow={Math.min(goal.doneThisYear, goal.yearlyTrainings)}
              className="h-2 rounded-full bg-background overflow-hidden"
            >
              <div className="h-full rounded-full bg-accent-target" style={{ width: `${percent}%` }} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={startEditing}>
                Editar meta
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={saving} onClick={remove}>
                Remover meta
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground-muted">
              Defina quantos treinos quer fazer no ano. Esta meta é só sua e não depende da regra escolhida.
            </p>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={startEditing}>
              Definir meta
            </button>
          </>
        )}

        {error && (
          <p className="text-sm text-accent-target" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
