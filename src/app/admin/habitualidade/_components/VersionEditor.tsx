"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/clientApi";
import { formatLocalDate } from "@/lib/datetime";
import {
  ACTIVITY_TYPES,
  summarizeLevel,
  type ActivityType,
  type AdminVersion,
  type Level,
} from "@/lib/habituality";
import { COMPETITION_SCOPES, type CompetitionScope } from "@/lib/visitType";
import {
  DANGER_BUTTON_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "./ui";

type RequirementDraft = {
  activityType: ActivityType;
  minQuantity: string;
  onlyInClub: boolean;
  distinctEvents: boolean;
  minScope: "" | CompetitionScope;
};
type LevelDraft = { name: string; requirements: RequirementDraft[] };

const EMPTY_REQUIREMENT: RequirementDraft = {
  activityType: "TREINO",
  minQuantity: "",
  onlyInClub: false,
  distinctEvents: false,
  minScope: "",
};

function toDrafts(levels: Level[]): LevelDraft[] {
  return [...levels]
    .sort((a, b) => a.position - b.position)
    .map((level) => ({
      name: level.name,
      requirements: level.requirements.map((r) => ({
        activityType: r.activityType,
        minQuantity: String(r.minQuantity),
        onlyInClub: r.onlyInClub,
        distinctEvents: r.distinctEvents,
        minScope: r.minScope ?? "",
      })),
    }));
}

/** Rascunho → corpo do backend; `null` com a mensagem quando algo obrigatório está faltando. */
function buildBody(validFrom: string, windowMonths: string, levels: LevelDraft[]): { error: string } | { body: unknown } {
  if (validFrom === "") return { error: "Informe a data de vigência" };
  const months = Number(windowMonths);
  if (!Number.isInteger(months) || months < 1) return { error: "A janela deve ser de pelo menos 1 mês" };
  if (levels.length === 0) return { error: "Inclua pelo menos um nível" };

  for (const [levelIndex, level] of levels.entries()) {
    if (level.name.trim() === "") return { error: `Dê um nome ao nível ${levelIndex + 1}` };
    if (level.requirements.length === 0) return { error: `O nível “${level.name.trim()}” precisa de pelo menos uma exigência` };
    for (const requirement of level.requirements) {
      const quantity = Number(requirement.minQuantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return { error: `Informe uma quantidade mínima (1 ou mais) em todas as exigências do nível “${level.name.trim()}”` };
      }
    }
  }

  return {
    body: {
      validFrom,
      windowMonths: months,
      levels: levels.map((level, index) => ({
        name: level.name.trim(),
        position: index + 1,
        requirements: level.requirements.map((r) => ({
          activityType: r.activityType,
          minQuantity: Number(r.minQuantity),
          onlyInClub: r.onlyInClub,
          distinctEvents: r.distinctEvents,
          minScope: r.activityType === "TREINO" || r.minScope === "" ? null : r.minScope,
        })),
      })),
    },
  };
}

function draftSummary(level: LevelDraft): string {
  return summarizeLevel({
    name: level.name,
    position: 0,
    requirements: level.requirements.map((r) => ({
      activityType: r.activityType,
      minQuantity: Number(r.minQuantity) || 0,
      onlyInClub: r.onlyInClub,
      distinctEvents: r.distinctEvents,
      minScope: r.activityType === "TREINO" || r.minScope === "" ? null : r.minScope,
    })),
  });
}

/**
 * Editor de versão (FUC24): vigência, janela, níveis e exigências, com o resumo
 * legível por nível. `readOnly` mostra só o resumo (versão vigente/passada).
 */
export function VersionEditor({
  ruleId,
  version,
  readOnly = false,
}: {
  ruleId: string;
  version: AdminVersion | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [validFrom, setValidFrom] = useState(version?.validFrom ?? "");
  const [windowMonths, setWindowMonths] = useState(version ? String(version.windowMonths) : "12");
  const [levels, setLevels] = useState<LevelDraft[]>(version ? toDrafts(version.levels) : []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const backHref = `/admin/habitualidade/${ruleId}`;

  function updateLevel(index: number, change: Partial<LevelDraft>) {
    setLevels((current) => current.map((l, i) => (i === index ? { ...l, ...change } : l)));
  }
  function updateRequirement(levelIndex: number, requirementIndex: number, change: Partial<RequirementDraft>) {
    setLevels((current) =>
      current.map((l, i) =>
        i === levelIndex
          ? { ...l, requirements: l.requirements.map((r, j) => (j === requirementIndex ? { ...r, ...change } : r)) }
          : l
      )
    );
  }
  function moveLevel(index: number, direction: -1 | 1) {
    setLevels((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const built = buildBody(validFrom, windowMonths, levels);
    if ("error" in built) {
      setError(built.error);
      return;
    }
    setError(null);
    setSaving(true);
    const result = await callApi(
      version ? `/api/admin/habituality/versions/${version.id}` : `/api/admin/habituality/rules/${ruleId}/versions`,
      {
        method: version ? "PUT" : "POST",
        body: built.body,
        fallback: "Não foi possível salvar a versão",
      }
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(backHref);
  }

  async function remove() {
    if (!version) return;
    setSaving(true);
    setError(null);
    const result = await callApi(`/api/admin/habituality/versions/${version.id}`, {
      method: "DELETE",
      fallback: "Não foi possível remover a versão",
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      setConfirmingDelete(false);
      return;
    }
    router.push(backHref);
  }

  if (readOnly && version) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground-muted">
          {version.current ? "Versão vigente" : "Versão passada"}: somente leitura. Para mudar a regra, crie uma versão
          futura.
        </p>
        <p>
          Desde {formatLocalDate(version.validFrom)} · janela de {version.windowMonths}{" "}
          {version.windowMonths === 1 ? "mês" : "meses"}
        </p>
        <ul className="space-y-2">
          {[...version.levels]
            .sort((a, b) => a.position - b.position)
            .map((level) => (
              <li key={level.name} className="rounded-md bg-surface p-3">
                <p className="font-medium">{level.name}</p>
                <p className="text-sm text-foreground-muted">{summarizeLevel(level)}</p>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  return (
    <form onSubmit={save} noValidate aria-label="Editor de versão" className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="valid-from" className={LABEL_CLASS}>
            Vigente a partir de
          </label>
          <input
            id="valid-from"
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="window-months" className={LABEL_CLASS}>
            Janela (meses)
          </label>
          <input
            id="window-months"
            type="number"
            inputMode="numeric"
            min={1}
            value={windowMonths}
            onChange={(e) => setWindowMonths(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="space-y-3">
        {levels.map((level, levelIndex) => {
          const n = levelIndex + 1;
          return (
            <fieldset key={levelIndex} className="rounded-md bg-surface p-3 space-y-3 min-w-0">
              <legend className="px-1 text-xs uppercase tracking-wide text-foreground-muted">Nível {n}</legend>

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-40">
                  <label htmlFor={`level-name-${n}`} className={LABEL_CLASS}>
                    Nome do nível {n}
                  </label>
                  <input
                    id={`level-name-${n}`}
                    value={level.name}
                    onChange={(e) => updateLevel(levelIndex, { name: e.target.value })}
                    placeholder="Ex: Iniciante"
                    className={INPUT_CLASS}
                  />
                </div>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  aria-label={`Subir nível ${n}`}
                  disabled={levelIndex === 0}
                  onClick={() => moveLevel(levelIndex, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  aria-label={`Descer nível ${n}`}
                  disabled={levelIndex === levels.length - 1}
                  onClick={() => moveLevel(levelIndex, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={DANGER_BUTTON_CLASS}
                  aria-label={`Remover nível ${n}`}
                  onClick={() => setLevels((current) => current.filter((_, i) => i !== levelIndex))}
                >
                  Remover
                </button>
              </div>

              {level.requirements.map((requirement, requirementIndex) => {
                const r = requirementIndex + 1;
                const suffix = `da exigência ${r} do nível ${n}`;
                return (
                  <div key={requirementIndex} className="rounded-md border border-border p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`req-type-${n}-${r}`} className={LABEL_CLASS}>
                          Tipo {suffix}
                        </label>
                        <select
                          id={`req-type-${n}-${r}`}
                          value={requirement.activityType}
                          onChange={(e) =>
                            updateRequirement(levelIndex, requirementIndex, {
                              activityType: e.target.value as ActivityType,
                              ...(e.target.value === "TREINO" ? { minScope: "" } : {}),
                            })
                          }
                          className={INPUT_CLASS}
                        >
                          {ACTIVITY_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`req-qty-${n}-${r}`} className={LABEL_CLASS}>
                          Quantidade mínima {suffix}
                        </label>
                        <input
                          id={`req-qty-${n}-${r}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={requirement.minQuantity}
                          onChange={(e) => updateRequirement(levelIndex, requirementIndex, { minQuantity: e.target.value })}
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    {requirement.activityType !== "TREINO" && (
                      <div>
                        <label htmlFor={`req-scope-${n}-${r}`} className={LABEL_CLASS}>
                          Âmbito mínimo {suffix}
                        </label>
                        <select
                          id={`req-scope-${n}-${r}`}
                          value={requirement.minScope}
                          onChange={(e) =>
                            updateRequirement(levelIndex, requirementIndex, { minScope: e.target.value as "" | CompetitionScope })
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="">Qualquer</option>
                          {COMPETITION_SCOPES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-4">
                      <label className="flex items-center gap-2 min-h-11 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requirement.onlyInClub}
                          onChange={(e) => updateRequirement(levelIndex, requirementIndex, { onlyInClub: e.target.checked })}
                          className="h-4 w-4 accent-accent-target"
                        />
                        Só em clube {suffix}
                      </label>
                      <label className="flex items-center gap-2 min-h-11 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requirement.distinctEvents}
                          onChange={(e) => updateRequirement(levelIndex, requirementIndex, { distinctEvents: e.target.checked })}
                          className="h-4 w-4 accent-accent-target"
                        />
                        Eventos distintos {suffix}
                      </label>
                    </div>

                    <button
                      type="button"
                      className={DANGER_BUTTON_CLASS}
                      aria-label={`Remover exigência ${r} do nível ${n}`}
                      onClick={() =>
                        updateLevel(levelIndex, { requirements: level.requirements.filter((_, j) => j !== requirementIndex) })
                      }
                    >
                      Remover exigência
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                aria-label={`Adicionar exigência ao nível ${n}`}
                onClick={() => updateLevel(levelIndex, { requirements: [...level.requirements, { ...EMPTY_REQUIREMENT }] })}
              >
                + Exigência
              </button>

              <p className="text-sm text-foreground-muted" aria-label={`Resumo do nível ${n}`}>
                Resumo: {level.requirements.length > 0 ? draftSummary(level) : "sem exigências"}
              </p>
            </fieldset>
          );
        })}

        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => setLevels((current) => [...current, { name: "", requirements: [{ ...EMPTY_REQUIREMENT }] }])}
        >
          + Nível
        </button>
      </div>

      {error && (
        <p className="text-sm text-accent-target" role="alert">
          {error}
        </p>
      )}

      {confirmingDelete ? (
        <div role="alertdialog" aria-label="Confirmar exclusão" className="rounded-md bg-surface p-3 space-y-2">
          <p className="text-sm">Excluir esta versão futura? Isso não pode ser desfeito.</p>
          <div className="flex gap-2">
            <button type="button" disabled={saving} className={DANGER_BUTTON_CLASS} onClick={remove}>
              Confirmar exclusão
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={saving} className={PRIMARY_BUTTON_CLASS}>
            {saving ? "Salvando..." : version ? "Salvar versão" : "Criar versão"}
          </button>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => router.push(backHref)}>
            Cancelar
          </button>
          {version && (
            <button type="button" className={DANGER_BUTTON_CLASS} onClick={() => setConfirmingDelete(true)}>
              Excluir versão
            </button>
          )}
        </div>
      )}
    </form>
  );
}
