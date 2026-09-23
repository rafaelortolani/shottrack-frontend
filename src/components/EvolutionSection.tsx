"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TimeLineChart, type TimePoint } from "@/components/TimeLineChart";
import { resultTypeKind, resultTypeUnit } from "@/lib/resultTypeFormat";

type Option = { id: string; name: string };
type ModalityOption = Option & { resultTypes: Option[] };

type Period = "7d" | "30d" | "3m" | "1a";
type Mode = "MEDIA" | "MELHOR";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "3m", label: "3 meses" },
  { value: "1a", label: "1 ano" },
];

const MODES: { value: Mode; label: string }[] = [
  { value: "MEDIA", label: "Média" },
  { value: "MELHOR", label: "Melhor" },
];

const SELECT_CLASS =
  "rounded-md bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

function segmentClass(selected: boolean): string {
  return `px-3 py-1.5 text-sm rounded transition-colors ${
    selected ? "bg-surface-raised text-foreground font-medium" : "text-foreground-muted hover:text-foreground"
  }`;
}

/**
 * Janela do período, igual à do backend (UC46): "7d" com hoje = dia 10
 * cobre os dias 4 a 10, sempre em UTC (dia do treino no backend é UTC).
 */
function periodWindow(period: Period): { startDate: string; endDate: string } {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end);
  if (period === "7d") start.setUTCDate(start.getUTCDate() - 7);
  if (period === "30d") start.setUTCDate(start.getUTCDate() - 30);
  if (period === "3m") start.setUTCMonth(start.getUTCMonth() - 3);
  if (period === "1a") start.setUTCFullYear(start.getUTCFullYear() - 1);
  start.setUTCDate(start.getUTCDate() + 1);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

function formatValue(value: number, resultTypeName: string): string {
  const unit = resultTypeUnit(resultTypeName);
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit ? ` ${unit.suffix}` : ""}`;
}

/** Tipo inicial: o primeiro que já tem recorde (tem dado); senão, o primeiro. */
function defaultResultType(modality: ModalityOption, recordTypeNames: string[]): string {
  return (modality.resultTypes.find((t) => recordTypeNames.includes(t.name)) ?? modality.resultTypes[0]).id;
}

/**
 * FUC16: gráfico de evolução (UC46). Só tipos numéricos entram no seletor —
 * são os únicos com orientação (MENOR/MAIOR_MELHOR) e valor agregável;
 * "Exercício concluído" e "Anotação livre" ficam de fora. Sem nenhuma
 * modalidade com tipo numérico configurado, a seção não aparece.
 */
export function EvolutionSection({
  trainingCountByModality,
  recordTypeNames,
}: {
  trainingCountByModality: Record<string, number>;
  recordTypeNames: string[];
}) {
  const router = useRouter();
  const [options, setOptions] = useState<ModalityOption[] | null>(null);
  const [modalityId, setModalityId] = useState("");
  const [resultTypeId, setResultTypeId] = useState("");
  const [period, setPeriod] = useState<Period>("30d");
  const [mode, setMode] = useState<Mode>("MEDIA");
  const [points, setPoints] = useState<TimePoint[] | null>(null);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const modalitiesRes = await fetch("/api/practiced-modalities");
      if (modalitiesRes.status === 401) {
        router.push("/login");
        return;
      }
      if (!modalitiesRes.ok) {
        if (!cancelled) setOptions([]);
        return;
      }
      const { data: modalities }: { data: Option[] } = await modalitiesRes.json();

      const withTypes = await Promise.all(
        modalities.map(async (modality) => {
          const res = await fetch(`/api/practiced-modalities/${modality.id}/result-types`);
          const types: Option[] = res.ok ? (await res.json()).data : [];
          return { ...modality, resultTypes: types.filter((t) => resultTypeKind(t.name) === "number") };
        })
      );
      const eligible = withTypes.filter((m) => m.resultTypes.length > 0);
      if (cancelled) return;

      setOptions(eligible);
      if (eligible.length === 0) return;

      // Modalidade inicial: a mais treinada
      const initial = eligible.reduce((best, m) =>
        (trainingCountByModality[m.name] ?? 0) > (trainingCountByModality[best.name] ?? 0) ? m : best
      );
      setModalityId(initial.id);
      setResultTypeId(defaultResultType(initial, recordTypeNames));
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
    // opções carregam uma vez; contagens/recordes só escolhem a seleção inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!modalityId || !resultTypeId) return;
    let cancelled = false;

    async function loadPoints() {
      setLoadingPoints(true);
      setError(null);
      const query = new URLSearchParams({ modalityId, resultTypeId, period, mode });
      const response = await fetch(`/api/dashboard/evolution?${query}`);

      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (cancelled) return;
      setLoadingPoints(false);

      if (!response.ok) {
        setError("Não foi possível carregar a evolução");
        return;
      }
      const { data } = await response.json();
      setPoints(data.map((p: { date: string; value: number }) => ({ date: p.date, value: Number(p.value) })));
    }

    loadPoints();
    return () => {
      cancelled = true;
    };
  }, [router, modalityId, resultTypeId, period, mode]);

  if (!options || options.length === 0) return null;

  const modality = options.find((m) => m.id === modalityId);
  const resultType = modality?.resultTypes.find((t) => t.id === resultTypeId);
  if (!modality || !resultType) return null;

  function handleModalityChange(id: string) {
    const next = options!.find((m) => m.id === id)!;
    setModalityId(id);
    setResultTypeId(defaultResultType(next, recordTypeNames));
  }

  const { startDate, endDate } = periodWindow(period);
  const unit = resultTypeUnit(resultType.name);
  const chartLabel = `${mode === "MEDIA" ? "Média" : "Melhor"} diária de ${resultType.name}${unit ? ` (${unit.suffix})` : ""} — ${modality.name}`;

  return (
    <section aria-labelledby="evolution-title" className="rounded-md bg-surface p-4">
      <h2 id="evolution-title" className="font-display text-base font-semibold mb-3">
        Evolução
      </h2>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          aria-label="Modalidade"
          value={modalityId}
          onChange={(e) => handleModalityChange(e.target.value)}
          className={SELECT_CLASS}
        >
          {options.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          aria-label="Tipo de resultado"
          value={resultTypeId}
          onChange={(e) => setResultTypeId(e.target.value)}
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
              onClick={() => setPeriod(p.value)}
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
              onClick={() => setMode(m.value)}
              className={segmentClass(mode === m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-foreground-muted mb-2">{chartLabel}</p>

      {error ? (
        <p className="text-sm text-accent-target" role="alert">{error}</p>
      ) : points === null ? (
        <p className="text-sm text-foreground-muted h-[180px]">Carregando evolução...</p>
      ) : points.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center rounded-md border border-dashed border-border">
          <p className="text-sm text-foreground-muted">Nenhum registro nesse período</p>
        </div>
      ) : (
        // recarregar mantém o gráfico anterior esmaecido, sem piscar nem pular layout
        <div className={loadingPoints ? "opacity-50 transition-opacity" : "transition-opacity"} aria-busy={loadingPoints}>
          <TimeLineChart
            label={chartLabel}
            points={points}
            startDate={startDate}
            endDate={endDate}
            formatValue={(v) => formatValue(v, resultType.name)}
          />
        </div>
      )}
    </section>
  );
}
