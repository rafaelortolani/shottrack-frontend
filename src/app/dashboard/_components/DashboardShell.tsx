"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  dashboardHref,
  parseParams,
  type Dashboard,
  type DashboardTabId,
  type ModalityOption,
  type ModalitySummary,
  type TabContext,
} from "@/lib/dashboard";
import { resultTypeKind } from "@/lib/resultTypeFormat";
import { DashboardTabs } from "./DashboardTabs";
import { EvolutionTab } from "./EvolutionTab";
import { ModalitiesTab } from "./ModalitiesTab";
import { RecordsTab } from "./RecordsTab";
import { SummaryTab } from "./SummaryTab";
import { FIELD_LABEL_CLASS, SELECT_CLASS } from "./shared";

/**
 * Abas do dashboard. Pra incluir uma nova (ex.: Habitualidade): acrescente em
 * DASHBOARD_TABS (src/lib/dashboard.ts) e o componente aqui.
 */
const TAB_COMPONENTS: Record<DashboardTabId, (context: TabContext) => React.ReactNode> = {
  resumo: (context) => <SummaryTab {...context} />,
  evolucao: (context) => <EvolutionTab {...context} />,
  recordes: (context) => <RecordsTab {...context} />,
  modalidades: (context) => <ModalitiesTab modalities={context.modalities} />,
};

type Option = { id: string; name: string };

/** Modalidades praticadas com só os tipos numéricos (os únicos com evolução) — as que não têm nenhum ficam de fora. */
async function loadEvolutionOptions(): Promise<ModalityOption[]> {
  const modalitiesRes = await fetch("/api/practiced-modalities");
  if (!modalitiesRes.ok) return [];
  const { data: modalities }: { data: Option[] } = await modalitiesRes.json();

  const withTypes = await Promise.all(
    modalities.map(async (modality) => {
      const res = await fetch(`/api/practiced-modalities/${modality.id}/result-types`);
      const types: Option[] = res.ok ? (await res.json()).data : [];
      return { ...modality, resultTypes: types.filter((t) => resultTypeKind(t.name) === "number") };
    })
  );
  return withTypes.filter((m) => m.resultTypes.length > 0);
}

export function DashboardShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => parseParams(searchParams), [searchParams]);

  const [modalities, setModalities] = useState<ModalitySummary[] | null>(null);
  const [options, setOptions] = useState<ModalityOption[] | null>(null);
  const [loaded, setLoaded] = useState<{ filterId: string; dashboard: Dashboard } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Filtro global: só vale modalidade em que o atleta já treinou (a lista do backend); outra coisa na URL = "Todas"
  const filterId = modalities?.some((m) => m.modalityId === params.modalidade) ? params.modalidade : "";

  const hrefFor = useCallback(
    (overrides: Record<string, string | null>) => dashboardHref(searchParams, overrides),
    [searchParams]
  );
  const setParams = useCallback(
    (overrides: Record<string, string | null>) => {
      router.replace(dashboardHref(searchParams, overrides), { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadModalities() {
      setError(null);
      const [modalitiesRes, evolutionOptions] = await Promise.all([
        fetch("/api/dashboard/modalities"),
        loadEvolutionOptions(),
      ]);

      if (modalitiesRes.status === 401) {
        router.push("/login");
        return;
      }
      if (cancelled) return;
      if (!modalitiesRes.ok) {
        setError("Não foi possível carregar o dashboard");
        return;
      }
      setModalities((await modalitiesRes.json()).data);
      setOptions(evolutionOptions);
    }

    loadModalities();
    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  useEffect(() => {
    if (modalities === null) return;
    let cancelled = false;

    async function loadDashboard() {
      setError(null);
      const query = filterId ? `?${new URLSearchParams({ modalityId: filterId })}` : "";
      const response = await fetch(`/api/dashboard${query}`);

      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (cancelled) return;
      if (!response.ok) {
        setError("Não foi possível carregar o dashboard");
        return;
      }
      setLoaded({ filterId, dashboard: (await response.json()).data });
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [router, modalities, filterId, attempt]);

  const onModalitiesTab = params.aba === "modalidades";
  const ready = loaded && loaded.filterId === filterId && modalities && options;
  const context: TabContext | null = ready
    ? { dashboard: loaded.dashboard, modalities, options, filterId, params, hrefFor, setParams }
    : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <h1 className="font-display text-lg font-semibold">Dashboard</h1>

        <div>
          <label htmlFor="dashboard-modality" className={FIELD_LABEL_CLASS}>
            Modalidade
          </label>
          <select
            id="dashboard-modality"
            value={onModalitiesTab ? "" : filterId}
            disabled={onModalitiesTab || modalities === null}
            onChange={(e) => setParams({ modalidade: e.target.value, tipo: null, mod: null })}
            className={`${SELECT_CLASS} min-w-48`}
          >
            <option value="">Todas as modalidades</option>
            {modalities?.map((m) => (
              <option key={m.modalityId} value={m.modalityId}>{m.modalityName}</option>
            ))}
          </select>
          {onModalitiesTab && (
            <p className="text-xs text-foreground-muted mt-1">Esta aba mostra todas as modalidades.</p>
          )}
        </div>
      </div>

      <DashboardTabs active={params.aba} hrefFor={hrefFor} />

      <div className="pt-4">
        {error ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-accent-target">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground-muted hover:text-foreground hover:border-accent-target transition-colors"
            >
              Tentar de novo
            </button>
          </div>
        ) : context ? (
          TAB_COMPONENTS[params.aba](context)
        ) : (
          <Skeleton />
        )}
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-4 animate-pulse">
      <span className="sr-only">Carregando dashboard...</span>
      <div className="h-20 rounded-md bg-surface" />
      <div className="h-16 rounded-md bg-surface" />
      <div className="h-32 rounded-md bg-surface" />
    </div>
  );
}
