"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronDown, IconListNumbers } from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { resultTypeKind, resultTypeUnit } from "@/lib/resultTypeFormat";

type Catalog = { id: string; name: string };
type Weapon = { id: string; nickname: string | null; type: Catalog; brand: Catalog; model: Catalog; caliber: Catalog };
type Ammunition = { id: string; nickname: string | null; manufacturer: Catalog | null; caliber: Catalog | null };
type ResultType = { id: string; name: string };
type SeriesResult = { resultTypeId: string; resultTypeName: string; value: string | null; notApplicable: boolean };
type Series = {
  id: string;
  trainingId: string;
  weaponId: string | null;
  ammunitionId: string | null;
  distanceMeters: number | null;
  target: string | null;
  shotCount: number | null;
  notes: string | null;
  createdAt: string;
  results: SeriesResult[];
};

type ResultFormValue = { value: string; notApplicable: boolean };
type SeriesFormValues = {
  weaponId: string;
  ammunitionId: string;
  distanceMeters: string;
  target: string;
  shotCount: string;
  notes: string;
  results: Record<string, ResultFormValue>;
};

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

function weaponLabel(weapon: Weapon): string {
  return weapon.nickname || `${weapon.brand.name} ${weapon.model.name}`;
}

function ammoLabel(ammo: Ammunition): string {
  return ammo.nickname || ammo.manufacturer?.name || "Munição";
}

function formatSeriesSummary(series: Series, weaponsById: Map<string, Weapon>): string {
  const parts: string[] = [];
  const filled = series.results.filter((r) => !r.notApplicable && r.value !== null && r.value !== "");

  parts.push(
    filled.length > 0
      ? filled
          .map((r) => `${r.resultTypeName}: ${r.value}${resultTypeUnit(r.resultTypeName)?.suffix ?? ""}`)
          .join(", ")
      : "Sem dados ainda"
  );

  if (series.weaponId) {
    const weapon = weaponsById.get(series.weaponId);
    if (weapon) parts.push(weaponLabel(weapon));
  }

  return parts.join(" · ");
}

function upsertById<T extends { id: string }>(list: T[], updated: T): T[] {
  return list.some((item) => item.id === updated.id)
    ? list.map((item) => (item.id === updated.id ? updated : item))
    : [...list, updated];
}

function upsertResult(list: SeriesResult[], updated: SeriesResult): SeriesResult[] {
  return list.some((r) => r.resultTypeId === updated.resultTypeId)
    ? list.map((r) => (r.resultTypeId === updated.resultTypeId ? updated : r))
    : [...list, updated];
}

/**
 * PATCH /api/series/{id} trata campo ausente/null como "não alterar"
 * (UpdateSeriesRequest do backend) — por isso o diff só inclui campos com
 * um valor novo de verdade, nunca um jeito de "limpar" um campo já
 * preenchido.
 */
function buildSeriesDiff(original: Series, values: SeriesFormValues): Record<string, unknown> {
  const diff: Record<string, unknown> = {};

  const weaponId = values.weaponId || null;
  if (weaponId !== null && weaponId !== original.weaponId) diff.weaponId = weaponId;

  const ammunitionId = values.ammunitionId || null;
  if (ammunitionId !== null && ammunitionId !== original.ammunitionId) diff.ammunitionId = ammunitionId;

  const distanceMeters = values.distanceMeters === "" ? null : Number(values.distanceMeters);
  if (distanceMeters !== null && distanceMeters !== original.distanceMeters) diff.distanceMeters = distanceMeters;

  const target = values.target || null;
  if (target !== null && target !== original.target) diff.target = target;

  const shotCount = values.shotCount === "" ? null : Number(values.shotCount);
  if (shotCount !== null && shotCount !== original.shotCount) diff.shotCount = shotCount;

  const notes = values.notes || null;
  if (notes !== null && notes !== original.notes) diff.notes = notes;

  return diff;
}

function buildRegisterPayload(values: SeriesFormValues) {
  return {
    weaponId: values.weaponId || null,
    ammunitionId: values.ammunitionId || null,
    distanceMeters: values.distanceMeters === "" ? null : Number(values.distanceMeters),
    target: values.target || null,
    shotCount: values.shotCount === "" ? null : Number(values.shotCount),
    notes: values.notes || null,
  };
}

export function SeriesAccordion({
  trainingId,
  trainingOpen,
  modalityId,
}: {
  trainingId: string;
  trainingOpen: boolean;
  modalityId: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [resultTypes, setResultTypes] = useState<ResultType[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [ammunitions, setAmmunitions] = useState<Ammunition[]>([]);

  const [formMode, setFormMode] = useState<"closed" | "new" | string>("closed");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const weaponsById = new Map(weapons.map((w) => [w.id, w]));

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);

    if (!next || loaded) return;

    setLoading(true);

    const [seriesRes, resultTypesRes, weaponsRes, ammunitionsRes] = await Promise.all([
      fetch(`/api/trainings/${trainingId}/series`),
      fetch(`/api/practiced-modalities/${modalityId}/result-types`),
      fetch("/api/weapons"),
      fetch("/api/ammunitions"),
    ]);

    if ([seriesRes, resultTypesRes, weaponsRes, ammunitionsRes].some((r) => r.status === 401)) {
      router.push("/login");
      return;
    }

    if (!seriesRes.ok || !resultTypesRes.ok || !weaponsRes.ok || !ammunitionsRes.ok) {
      setListError("Não foi possível carregar as séries");
      setLoading(false);
      return;
    }

    const { data: seriesData } = await seriesRes.json();
    const { data: resultTypesData } = await resultTypesRes.json();
    const { data: weaponsData } = await weaponsRes.json();
    const { data: ammunitionsData } = await ammunitionsRes.json();

    setSeries(
      [...seriesData].sort((a: Series, b: Series) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    );
    setResultTypes(resultTypesData);
    setWeapons(weaponsData);
    setAmmunitions(ammunitionsData);
    setLoading(false);
    setLoaded(true);
  }

  async function handleSaveSeries(values: SeriesFormValues, editingSeries: Series | null) {
    setSaveError(null);
    setSaving(true);

    let seriesData: Series;

    if (editingSeries) {
      const diff = buildSeriesDiff(editingSeries, values);

      if (Object.keys(diff).length > 0) {
        const response = await fetch(`/api/series/${editingSeries.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(diff),
        });

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (!response.ok) {
          const { error } = await response.json();
          setSaveError(error?.message ?? "Não foi possível salvar as alterações");
          setSaving(false);
          return;
        }

        seriesData = (await response.json()).data;
      } else {
        seriesData = editingSeries;
      }
    } else {
      const response = await fetch(`/api/trainings/${trainingId}/series`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRegisterPayload(values)),
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        const { error } = await response.json();
        setSaveError(error?.message ?? "Não foi possível registrar a série");
        setSaving(false);
        return;
      }

      seriesData = (await response.json()).data;
    }

    let finalResults = seriesData.results;

    for (const resultType of resultTypes) {
      const original = editingSeries?.results.find((r) => r.resultTypeId === resultType.id);
      const current = values.results[resultType.id] ?? { value: "", notApplicable: false };

      const originalNotApplicable = original?.notApplicable ?? false;
      const originalValue = original && !original.notApplicable ? original.value ?? "" : "";
      const unchanged = current.notApplicable === originalNotApplicable && current.value === originalValue;

      if (unchanged) continue;

      if (current.notApplicable) {
        const response = await fetch(`/api/series/${seriesData.id}/results`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultTypeId: resultType.id, notApplicable: true }),
        });

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (!response.ok) {
          const { error } = await response.json();
          setSaveError(error?.message ?? `Não foi possível salvar "${resultType.name}"`);
          setSaving(false);
          setSeries((prev) => upsertById(prev, { ...seriesData, results: finalResults }));
          return;
        }

        const { data } = await response.json();
        finalResults = upsertResult(finalResults, data);
      } else if (current.value !== "") {
        const response = await fetch(`/api/series/${seriesData.id}/results`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultTypeId: resultType.id, value: current.value }),
        });

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (!response.ok) {
          const { error } = await response.json();
          setSaveError(error?.message ?? `Não foi possível salvar "${resultType.name}"`);
          setSaving(false);
          setSeries((prev) => upsertById(prev, { ...seriesData, results: finalResults }));
          return;
        }

        const { data } = await response.json();
        finalResults = upsertResult(finalResults, data);
      } else if (original) {
        const response = await fetch(`/api/series/${seriesData.id}/results/${resultType.id}`, { method: "DELETE" });

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (!response.ok) {
          const { error } = await response.json();
          setSaveError(error?.message ?? `Não foi possível remover "${resultType.name}"`);
          setSaving(false);
          setSeries((prev) => upsertById(prev, { ...seriesData, results: finalResults }));
          return;
        }

        finalResults = finalResults.filter((r) => r.resultTypeId !== resultType.id);
      }
    }

    setSeries((prev) => upsertById(prev, { ...seriesData, results: finalResults }));
    setSaving(false);
    setFormMode("closed");
  }

  async function handleDeleteSeries(seriesId: string) {
    setSaveError(null);
    setDeletingId(seriesId);

    const response = await fetch(`/api/series/${seriesId}`, { method: "DELETE" });

    setDeletingId(null);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setConfirmingDeleteId(null);
      setSaveError(error?.message ?? "Não foi possível excluir a série");
      return;
    }

    setConfirmingDeleteId(null);
    setSeries((prev) => prev.filter((s) => s.id !== seriesId));
    setFormMode("closed");
  }

  const editingSeries = formMode !== "closed" && formMode !== "new" ? series.find((s) => s.id === formMode) ?? null : null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
      >
        <IconChevronDown size={14} stroke={1.75} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        Séries
      </button>

      {expanded && (
        <div className="mt-2 pl-4 border-l border-border space-y-2">
          {loading ? (
            <p className="text-sm text-foreground-muted">Carregando séries...</p>
          ) : listError ? (
            <p className="text-sm text-accent-target" role="alert">{listError}</p>
          ) : (
            <>
              {series.length === 0 ? (
                formMode === "closed" &&
                (trainingOpen ? (
                  <EmptyState
                    icon={IconListNumbers}
                    title="Nenhuma série registrada ainda"
                    description="Cada série é um disparo ou sequência de disparos."
                    actionLabel="Registrar série"
                    onAction={() => setFormMode("new")}
                  />
                ) : (
                  <p className="text-sm text-foreground-muted">Nenhuma série registrada ainda.</p>
                ))
              ) : (
                <ul className="space-y-1">
                  {series.map((s, index) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSaveError(null);
                          setFormMode(s.id);
                        }}
                        className="w-full flex items-center justify-between gap-3 py-1.5 text-left text-sm hover:text-foreground transition-colors"
                      >
                        <span className="text-foreground shrink-0">Série {index + 1}</span>
                        <span className="text-foreground-muted truncate">{formatSeriesSummary(s, weaponsById)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {formMode === "closed" && trainingOpen && series.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFormMode("new")}
                  className="text-sm text-accent-brass-soft hover:text-accent-brass transition-colors"
                >
                  + Registrar série
                </button>
              )}

              {formMode !== "closed" && (
                <SeriesForm
                  key={formMode}
                  idPrefix={`series-${trainingId}-${formMode}`}
                  resultTypes={resultTypes}
                  weapons={weapons}
                  ammunitions={ammunitions}
                  initialSeries={editingSeries}
                  onSubmit={(values) => handleSaveSeries(values, editingSeries)}
                  onCancel={() => {
                    setFormMode("closed");
                    setSaveError(null);
                  }}
                  onDelete={editingSeries ? () => setConfirmingDeleteId(editingSeries.id) : undefined}
                  saving={saving}
                  error={saveError}
                />
              )}
            </>
          )}
        </div>
      )}

      {confirmingDeleteId && (
        <ConfirmDialog
          id="confirm-delete-series"
          title="Excluir série"
          busy={deletingId === confirmingDeleteId}
          busyLabel="Excluindo..."
          onCancel={() => setConfirmingDeleteId(null)}
          onConfirm={() => handleDeleteSeries(confirmingDeleteId)}
        >
          Essa ação não pode ser desfeita. Confirmar?
        </ConfirmDialog>
      )}
    </div>
  );
}

function SeriesForm({
  idPrefix,
  resultTypes,
  weapons,
  ammunitions,
  initialSeries,
  onSubmit,
  onCancel,
  onDelete,
  saving,
  error,
}: {
  idPrefix: string;
  resultTypes: ResultType[];
  weapons: Weapon[];
  ammunitions: Ammunition[];
  initialSeries: Series | null;
  onSubmit: (values: SeriesFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [weaponId, setWeaponId] = useState(initialSeries?.weaponId ?? "");
  const [ammunitionId, setAmmunitionId] = useState(initialSeries?.ammunitionId ?? "");
  const [distanceMeters, setDistanceMeters] = useState(
    initialSeries?.distanceMeters != null ? String(initialSeries.distanceMeters) : ""
  );
  const [target, setTarget] = useState(initialSeries?.target ?? "");
  const [shotCount, setShotCount] = useState(initialSeries?.shotCount != null ? String(initialSeries.shotCount) : "");
  const [notes, setNotes] = useState(initialSeries?.notes ?? "");
  const [moreOpen, setMoreOpen] = useState(false);
  const [results, setResults] = useState<Record<string, ResultFormValue>>(() => {
    const map: Record<string, ResultFormValue> = {};
    for (const resultType of resultTypes) {
      const existing = initialSeries?.results.find((r) => r.resultTypeId === resultType.id);
      map[resultType.id] = existing
        ? { value: existing.notApplicable ? "" : existing.value ?? "", notApplicable: existing.notApplicable }
        : { value: "", notApplicable: false };
    }
    return map;
  });

  const [formError, setFormError] = useState<string | null>(null);

  function updateResult(id: string, patch: Partial<ResultFormValue>) {
    setResults((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function numericResultValue(resultTypeId: string | undefined): number {
    if (!resultTypeId) return 0;
    const rv = results[resultTypeId];
    if (!rv || rv.notApplicable || rv.value === "") return 0;
    return Number(rv.value) || 0;
  }

  /**
   * Acertos + Erros não pode passar da quantidade de disparos — cada
   * disparo só pode contar pra um dos dois, então a soma nunca excede o
   * total. Só valida quando quantidade de disparos está preenchida (sem
   * ela não há o que comparar, e a tela permite completar depois).
   */
  function validateShotCounts(): string | null {
    const shots = shotCount === "" ? null : Number(shotCount);
    if (shots === null) return null;

    const acertosType = resultTypes.find((rt) => rt.name === "Acertos");
    const errosType = resultTypes.find((rt) => rt.name === "Erros");
    if (!acertosType && !errosType) return null;

    const total = numericResultValue(acertosType?.id) + numericResultValue(errosType?.id);
    if (total > shots) {
      return `Acertos + Erros (${total}) não pode passar da quantidade de disparos (${shots}).`;
    }

    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateShotCounts();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    onSubmit({ weaponId, ammunitionId, distanceMeters, target, shotCount, notes, results });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md bg-surface p-3 space-y-2">
      <div>
        <label htmlFor={`${idPrefix}-weapon`} className="block text-sm text-foreground-muted mb-1">
          Arma
        </label>
        <select id={`${idPrefix}-weapon`} value={weaponId} onChange={(e) => setWeaponId(e.target.value)} className={INPUT_CLASS}>
          <option value="">Nenhuma</option>
          {weapons.map((w) => (
            <option key={w.id} value={w.id}>{weaponLabel(w)}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-shot-count`} className="block text-sm text-foreground-muted mb-1">
          Quantidade de disparos
        </label>
        <input
          id={`${idPrefix}-shot-count`}
          type="number"
          min="0"
          value={shotCount}
          onChange={(e) => setShotCount(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      {resultTypes.map((resultType) => {
        const kind = resultTypeKind(resultType.name);
        const unit = resultTypeUnit(resultType.name);
        const rv = results[resultType.id] ?? { value: "", notApplicable: false };
        return (
          <div key={resultType.id}>
            <label htmlFor={`${idPrefix}-result-${resultType.id}`} className="block text-sm text-foreground-muted mb-1">
              {resultType.name}
              {unit && ` (${unit.label})`}
            </label>
            <div className="flex items-center gap-2">
              {kind === "boolean" ? (
                <select
                  id={`${idPrefix}-result-${resultType.id}`}
                  value={rv.value}
                  disabled={rv.notApplicable}
                  onChange={(e) => updateResult(resultType.id, { value: e.target.value })}
                  className={`${INPUT_CLASS} disabled:opacity-50`}
                >
                  <option value="">Selecione</option>
                  <option value="sim">Sim</option>
                  <option value="não">Não</option>
                </select>
              ) : (
                <input
                  id={`${idPrefix}-result-${resultType.id}`}
                  type={kind === "number" ? "number" : "text"}
                  step={kind === "number" ? "any" : undefined}
                  value={rv.value}
                  disabled={rv.notApplicable}
                  onChange={(e) => updateResult(resultType.id, { value: e.target.value })}
                  className={`${INPUT_CLASS} disabled:opacity-50`}
                />
              )}
              <button
                type="button"
                aria-pressed={rv.notApplicable}
                aria-label={`${resultType.name} não aplicável`}
                onClick={() => updateResult(resultType.id, { notApplicable: !rv.notApplicable, value: "" })}
                className={
                  rv.notApplicable
                    ? "shrink-0 rounded-md px-2 py-2 text-xs font-medium bg-accent-target text-foreground transition-colors"
                    : "shrink-0 rounded-md px-2 py-2 text-xs font-medium border border-border text-foreground-muted hover:text-foreground transition-colors"
                }
              >
                N/A
              </button>
            </div>
          </div>
        );
      })}

      {moreOpen ? (
        <div className="space-y-2 pt-2 border-t border-border">
          <div>
            <label htmlFor={`${idPrefix}-ammunition`} className="block text-sm text-foreground-muted mb-1">
              Munição
            </label>
            <select
              id={`${idPrefix}-ammunition`}
              value={ammunitionId}
              onChange={(e) => setAmmunitionId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Nenhuma</option>
              {ammunitions.map((a) => (
                <option key={a.id} value={a.id}>{ammoLabel(a)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-distance`} className="block text-sm text-foreground-muted mb-1">
              Distância (metros)
            </label>
            <input
              id={`${idPrefix}-distance`}
              type="number"
              step="any"
              min="0"
              value={distanceMeters}
              onChange={(e) => setDistanceMeters(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-target`} className="block text-sm text-foreground-muted mb-1">
              Alvo
            </label>
            <input
              id={`${idPrefix}-target`}
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-notes`} className="block text-sm text-foreground-muted mb-1">
              Observações
            </label>
            <textarea
              id={`${idPrefix}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="text-sm text-accent-brass-soft hover:text-accent-brass transition-colors"
        >
          + mais detalhes
        </button>
      )}

      {(formError || error) && (
        <p className="text-sm text-accent-target" role="alert">
          {formError ?? error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground text-sm font-medium py-2 px-4 transition-colors"
        >
          {saving ? "Salvando..." : initialSeries ? "Salvar alterações" : "Salvar série"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-foreground-muted hover:text-foreground transition-colors">
          Cancelar
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto text-sm text-accent-target hover:text-accent-target-hover transition-colors"
          >
            Excluir série
          </button>
        )}
      </div>
    </form>
  );
}
