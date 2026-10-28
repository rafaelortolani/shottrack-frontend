"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TimeLineChart, type TimePoint } from "@/components/TimeLineChart";
import {
  MODES,
  PERIODS,
  defaultResultTypeId,
  formatValue,
  mostTrained,
  parseEvolutionResponse,
  periodWindow,
  shiftDate,
  windowLengthDays,
  type EvolutionPoint,
  type TabContext,
} from "@/lib/dashboard";
import { resultTypeUnit } from "@/lib/resultTypeFormat";
import { EmptyNote, SECTION_LINK_CLASS, SELECT_CLASS, segmentClass } from "./shared";

type Loaded = { key: string; points: EvolutionPoint[]; previousPoints: EvolutionPoint[] };

/**
 * Aba Evolução (FUC16): a única do dashboard com controles. A modalidade vem do
 * filtro global; com "Todas", um seletor local começa na mais treinada. Toda a
 * seleção (modalidade, tipo, período, modo, comparação) mora na URL.
 */
export function EvolutionTab({ dashboard, modalities, options, filterId, params, setParams }: TabContext) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = filterId ? options.filter((m) => m.id === filterId) : options;
  const modality = filtered.length
    ? filterId
      ? filtered[0]
      : (filtered.find((m) => m.id === params.mod) ?? mostTrained(filtered, modalities))
    : undefined;
  const resultType = modality
    ? (modality.resultTypes.find((t) => t.id === params.tipo) ??
      modality.resultTypes.find((t) => t.id === defaultResultTypeId(modality, dashboard.records.map((r) => r.resultTypeName))))
    : undefined;

  const { periodo: period, modo: mode, comparar: compare } = params;
  const modalityId = modality?.id ?? "";
  const resultTypeId = resultType?.id ?? "";
  const key = [modalityId, resultTypeId, period, mode, compare].join("|");

  useEffect(() => {
    if (!modalityId || !resultTypeId) return;
    let cancelled = false;

    async function load() {
      setError(null);
      const query = new URLSearchParams({ modalityId, resultTypeId, period, mode });
      if (compare) query.set("comparePrevious", "true");
      const response = await fetch(`/api/dashboard/evolution?${query}`);

      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (cancelled) return;
      if (!response.ok) {
        setError("Não foi possível carregar a evolução");
        return;
      }
      setLoaded({ key, ...parseEvolutionResponse((await response.json()).data) });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router, key, modalityId, resultTypeId, period, mode, compare]);

  if (options.length === 0) {
    return (
      <section aria-labelledby="evolution-title" className="rounded-md bg-surface p-4">
        <h2 id="evolution-title" className="font-display text-base font-semibold mb-2">
          Evolução
        </h2>
        <EmptyNote>
          Para ver a evolução, configure ao menos um tipo de resultado numérico em{" "}
          <Link href="/usuario/modalidades" className={SECTION_LINK_CLASS}>
            Modalidades
          </Link>
          .
        </EmptyNote>
      </section>
    );
  }

  if (!modality || !resultType) {
    return (
      <section aria-labelledby="evolution-title" className="rounded-md bg-surface p-4">
        <h2 id="evolution-title" className="font-display text-base font-semibold mb-2">
          Evolução
        </h2>
        <EmptyNote>Essa modalidade não tem tipo de resultado numérico configurado.</EmptyNote>
      </section>
    );
  }

  const modeLabel = MODES.find((m) => m.value === mode)!.label;
  const unit = resultTypeUnit(resultType.name);
  const chartLabel = `${modeLabel} diária de ${resultType.name}${unit ? ` (${unit.suffix})` : ""} — ${modality.name}`;
  const window = periodWindow(period);
  const lengthDays = windowLengthDays(window);

  const ready = loaded?.key === key ? loaded : null;
  // Mantém o gráfico anterior (esmaecido) enquanto recarrega, sem piscar nem pular layout
  const shown = ready ?? loaded;
  const loading = !ready && !error;
  const previousPoints: TimePoint[] = (shown?.previousPoints ?? []).map((p) => ({
    date: shiftDate(p.date, lengthDays), // sobrepõe o período anterior na janela atual
    value: p.value,
    realDate: p.date,
  }));

  return (
    <section aria-labelledby="evolution-title" className="rounded-md bg-surface p-4">
      <h2 id="evolution-title" className="font-display text-base font-semibold mb-3">
        Evolução
      </h2>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {filterId ? (
          <p className="text-sm text-foreground-muted">
            Modalidade: <span className="text-foreground">{modality.name}</span>
          </p>
        ) : (
          <select
            aria-label="Modalidade"
            value={modality.id}
            onChange={(e) => setParams({ mod: e.target.value, tipo: null })}
            className={SELECT_CLASS}
          >
            {options.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <select
          aria-label="Tipo de resultado"
          value={resultType.id}
          onChange={(e) => setParams({ tipo: e.target.value })}
          className={SELECT_CLASS}
        >
          {modality.resultTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div role="tablist" aria-label="Período" className="flex rounded-md border border-border p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={period === p.value}
              onClick={() => setParams({ periodo: p.value })}
              className={segmentClass(period === p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Modo" className="flex rounded-md border border-border p-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setParams({ modo: m.param })}
              className={segmentClass(mode === m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 min-h-11 mb-2 text-sm text-foreground-muted cursor-pointer w-fit">
        <input
          type="checkbox"
          role="switch"
          checked={compare}
          onChange={(e) => setParams({ comparar: e.target.checked ? "1" : null })}
          className="peer relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-surface-raised transition-colors checked:border-accent-target checked:bg-accent-target before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-foreground-muted before:transition-transform before:content-[''] checked:before:translate-x-5 checked:before:bg-background focus-visible:ring-2 focus-visible:ring-accent-target/50 focus-visible:outline-none"
        />
        Comparar com período anterior
      </label>

      <p className="text-sm text-foreground-muted mb-2">{chartLabel}</p>

      {error ? (
        <p className="text-sm text-accent-target" role="alert">{error}</p>
      ) : shown === null ? (
        <p className="text-sm text-foreground-muted h-[180px]">Carregando evolução...</p>
      ) : shown.points.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center rounded-md border border-dashed border-border">
          <p className="text-sm text-foreground-muted">Nenhum registro nesse período</p>
        </div>
      ) : (
        <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          <TimeLineChart
            label={chartLabel}
            points={shown.points}
            previousPoints={previousPoints}
            startDate={window.startDate}
            endDate={window.endDate}
            formatValue={(v) => formatValue(v, resultType.name)}
          />
          {compare && shown.previousPoints.length === 0 && ready && (
            <p className="text-xs text-foreground-muted mt-2">Sem registros no período anterior.</p>
          )}
        </div>
      )}
    </section>
  );
}
