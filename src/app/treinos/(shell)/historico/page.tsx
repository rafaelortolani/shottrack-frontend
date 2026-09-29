"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DateRangeFilter, dateRangeError } from "@/components/DateRangeFilter";
import {
  SeriesForm,
  saveSeries,
  weaponLabel,
  type Ammunition,
  type ResultType,
  type Series,
  type SeriesFormValues,
  type SeriesResult,
  type Weapon,
} from "@/components/SeriesAccordion";
import { formatLocalDate } from "@/lib/datetime";
import { resultTypeUnit } from "@/lib/resultTypeFormat";

type Modality = { id: string; name: string };
type TrainingLocation = { id: string; name: string };

/** Série do histórico (UC47): a série mais o contexto de visita/treino. */
type HistorySeries = {
  id: string;
  trainingId: string;
  date: string;
  trainingLocation: TrainingLocation | null;
  modality: Modality;
  weapon: Weapon | null;
  ammunition: Ammunition | null;
  distanceMeters: number | null;
  target: string | null;
  shotCount: number | null;
  notes: string | null;
  createdAt: string;
  results: SeriesResult[];
};

type Filters = {
  startDate: string;
  endDate: string;
  modalityId: string;
  weaponId: string;
  minDistanceMeters: string;
  maxDistanceMeters: string;
};

const EMPTY_FILTERS: Filters = {
  startDate: "",
  endDate: "",
  modalityId: "",
  weaponId: "",
  minDistanceMeters: "",
  maxDistanceMeters: "",
};

const FIELD_CLASS =
  "rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

function hasActiveFilter(filters: Filters): boolean {
  return Object.values(filters).some((value) => value !== "");
}

function toSeries(item: HistorySeries): Series {
  return {
    id: item.id,
    trainingId: item.trainingId,
    weaponId: item.weapon?.id ?? null,
    ammunitionId: item.ammunition?.id ?? null,
    distanceMeters: item.distanceMeters,
    target: item.target,
    shotCount: item.shotCount,
    notes: item.notes,
    createdAt: item.createdAt,
    results: item.results,
  };
}

function resultsSummary(results: SeriesResult[]): string {
  const filled = results.filter((r) => !r.notApplicable && r.value !== null && r.value !== "");
  if (filled.length === 0) return "Sem resultados registrados";
  return filled.map((r) => `${r.resultTypeName}: ${r.value}${resultTypeUnit(r.resultTypeName)?.suffix ?? ""}`).join(", ");
}

/**
 * FUC18: histórico completo de séries (UC47). Filtros vão pro backend —
 * cada mudança refaz a busca, sem botão de "aplicar". Tocar numa linha
 * abre o mesmo card de edição do FUC14, editável mesmo com o treino
 * encerrado (UC38 permite completar depois).
 */
export default function HistoricoPage() {
  const router = useRouter();
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [ammunitions, setAmmunitions] = useState<Ammunition[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [series, setSeries] = useState<HistorySeries[] | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const [modalitiesRes, weaponsRes, ammunitionsRes] = await Promise.all([
        fetch("/api/practiced-modalities"),
        fetch("/api/weapons"),
        fetch("/api/ammunitions"),
      ]);

      if ([modalitiesRes, weaponsRes, ammunitionsRes].some((r) => r.status === 401)) {
        router.push("/login");
        return;
      }
      if (cancelled) return;

      // sem as opções os selects só ficam vazios — a lista ainda funciona
      if (modalitiesRes.ok) setModalities((await modalitiesRes.json()).data);
      if (weaponsRes.ok) setWeapons((await weaponsRes.json()).data);
      if (ammunitionsRes.ok) setAmmunitions((await ammunitionsRes.json()).data);
      setOptionsLoaded(true);
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const periodError = dateRangeError(filters.startDate, filters.endDate);

  useEffect(() => {
    if (periodError) return;
    let cancelled = false;

    async function loadSeries() {
      setLoadingSeries(true);
      const query = new URLSearchParams();
      for (const [name, value] of Object.entries(filters)) {
        if (value !== "") query.set(name, value);
      }
      const response = await fetch(`/api/series/history?${query}`);

      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (cancelled) return;
      setLoadingSeries(false);

      if (!response.ok) {
        const { error } = await response.json();
        setError(error?.message ?? "Não foi possível carregar o histórico");
        return;
      }
      setError(null);
      setSeries((await response.json()).data);
    }

    loadSeries();
    return () => {
      cancelled = true;
    };
  }, [router, filters, periodError]);

  function updateFilter(name: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function handleSaved(updated: Series) {
    setSeries((prev) =>
      prev!.map((item) =>
        item.id === updated.id
          ? {
              ...item,
              weapon: weapons.find((w) => w.id === updated.weaponId) ?? item.weapon,
              ammunition: ammunitions.find((a) => a.id === updated.ammunitionId) ?? item.ammunition,
              distanceMeters: updated.distanceMeters,
              target: updated.target,
              shotCount: updated.shotCount,
              notes: updated.notes,
              results: updated.results,
            }
          : item
      )
    );
  }

  if (!optionsLoaded || series === null) {
    return (
      <div>
        <Breadcrumb items={[{ href: "/treinos", label: "Treinos" }, { label: "Histórico" }]} />
        <h1 className="font-display text-lg font-semibold mb-4">Histórico</h1>
        {error ? (
          <p className="text-sm text-accent-target" role="alert">{error}</p>
        ) : (
          <p className="text-foreground-muted">Carregando histórico...</p>
        )}
      </div>
    );
  }

  const filtered = hasActiveFilter(filters);

  return (
    <div>
      <Breadcrumb items={[{ href: "/treinos", label: "Treinos" }, { label: "Histórico" }]} />
      <h1 className="font-display text-lg font-semibold mb-4">Histórico</h1>

      <div role="group" aria-label="Filtros" className="flex flex-wrap items-center gap-2 mb-3">
        <DateRangeFilter
          idPrefix="series-history"
          from={filters.startDate}
          onFromChange={(v) => updateFilter("startDate", v)}
          to={filters.endDate}
          onToChange={(v) => updateFilter("endDate", v)}
        />
        <select
          aria-label="Modalidade"
          value={filters.modalityId}
          onChange={(e) => updateFilter("modalityId", e.target.value)}
          className={FIELD_CLASS}
        >
          <option value="">Todas as modalidades</option>
          {modalities.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          aria-label="Arma"
          value={filters.weaponId}
          onChange={(e) => updateFilter("weaponId", e.target.value)}
          className={FIELD_CLASS}
        >
          <option value="">Todas as armas</option>
          {weapons.map((w) => (
            <option key={w.id} value={w.id}>{weaponLabel(w)}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="any"
          aria-label="Distância mínima (m)"
          placeholder="Dist. mín. (m)"
          value={filters.minDistanceMeters}
          onChange={(e) => updateFilter("minDistanceMeters", e.target.value)}
          className={`${FIELD_CLASS} w-32`}
        />
        <input
          type="number"
          min="0"
          step="any"
          aria-label="Distância máxima (m)"
          placeholder="Dist. máx. (m)"
          value={filters.maxDistanceMeters}
          onChange={(e) => updateFilter("maxDistanceMeters", e.target.value)}
          className={`${FIELD_CLASS} w-32`}
        />
        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {(periodError || error) && (
        <p className="text-sm text-accent-target mb-3" role="alert">{periodError ?? error}</p>
      )}

      {series.length === 0 ? (
        filtered ? (
          <div className="rounded-md border border-dashed border-border/60 p-4 text-center">
            <p className="text-foreground-muted mb-2">Nenhuma série encontrada com esses filtros</p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-accent-target-soft hover:text-accent-target transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <p className="text-foreground-muted">Nenhuma série registrada ainda.</p>
        )
      ) : (
        // refazer a busca mantém a lista anterior esmaecida, sem piscar
        <ul
          aria-label="Séries"
          aria-busy={loadingSeries}
          className={loadingSeries ? "opacity-50 transition-opacity" : "transition-opacity"}
        >
          {series.map((item) => (
            <HistoryRow
              key={item.id}
              item={item}
              open={openSeriesId === item.id}
              onToggle={() => setOpenSeriesId(openSeriesId === item.id ? null : item.id)}
              onClose={() => setOpenSeriesId(null)}
              onSaved={handleSaved}
              weapons={weapons}
              ammunitions={ammunitions}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryRow({
  item,
  open,
  onToggle,
  onClose,
  onSaved,
  weapons,
  ammunitions,
}: {
  item: HistorySeries;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSaved: (series: Series) => void;
  weapons: Weapon[];
  ammunitions: Ammunition[];
}) {
  const context = [item.modality.name, item.weapon ? weaponLabel(item.weapon) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 py-2 -mx-2 px-2 rounded-md text-left hover:bg-surface transition-colors"
      >
        <div className="min-w-0">
          <p className="text-foreground truncate">
            {formatLocalDate(item.date)}
            {item.trainingLocation ? ` · ${item.trainingLocation.name}` : ""}
          </p>
          <p className="text-sm text-foreground-muted truncate">{context}</p>
          <p className="text-sm text-accent-target-soft truncate">{resultsSummary(item.results)}</p>
        </div>
        <IconChevronDown
          size={16}
          stroke={1.75}
          aria-hidden
          className={`shrink-0 text-foreground-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <SeriesDetail item={item} onClose={onClose} onSaved={onSaved} weapons={weapons} ammunitions={ammunitions} />
      )}
    </li>
  );
}

/** Card de edição do FUC14, com os tipos de resultado da modalidade da série. */
function SeriesDetail({
  item,
  onClose,
  onSaved,
  weapons,
  ammunitions,
}: {
  item: HistorySeries;
  onClose: () => void;
  onSaved: (series: Series) => void;
  weapons: Weapon[];
  ammunitions: Ammunition[];
}) {
  const router = useRouter();
  const [resultTypes, setResultTypes] = useState<ResultType[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadResultTypes() {
      const response = await fetch(`/api/practiced-modalities/${item.modality.id}/result-types`);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (cancelled) return;
      if (!response.ok) {
        setLoadError("Não foi possível carregar a série");
        return;
      }
      setResultTypes((await response.json()).data);
    }

    loadResultTypes();
    return () => {
      cancelled = true;
    };
  }, [router, item.modality.id]);

  async function handleSubmit(values: SeriesFormValues) {
    setSaveError(null);
    setSaving(true);

    const outcome = await saveSeries(item.trainingId, resultTypes!, values, toSeries(item));

    if (outcome.status === "unauthorized") {
      router.push("/login");
      return;
    }

    setSaving(false);
    if (outcome.series) onSaved(outcome.series);

    if (outcome.status === "error") {
      setSaveError(outcome.message);
      return;
    }

    onClose();
  }

  return (
    <div className="pb-2">
      {loadError ? (
        <p className="text-sm text-accent-target" role="alert">{loadError}</p>
      ) : resultTypes === null ? (
        <p className="text-sm text-foreground-muted">Carregando série...</p>
      ) : (
        <SeriesForm
          idPrefix={`history-${item.id}`}
          resultTypes={resultTypes}
          weapons={weapons}
          ammunitions={ammunitions}
          initialSeries={toSeries(item)}
          onSubmit={handleSubmit}
          onCancel={onClose}
          saving={saving}
          error={saveError}
        />
      )}
    </div>
  );
}
