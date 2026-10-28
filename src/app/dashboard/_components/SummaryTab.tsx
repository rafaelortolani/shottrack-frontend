"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TimeLineChart } from "@/components/TimeLineChart";
import { formatDate, formatDateTime } from "@/lib/datetime";
import {
  formatDelta,
  formatHighlight,
  formatNumber,
  formatValue,
  periodWindow,
  type Dashboard,
  type EvolutionPoint,
  type Indicator,
  type TabContext,
  parseEvolutionResponse,
} from "@/lib/dashboard";
import { resultTypeUnit } from "@/lib/resultTypeFormat";
import { EmptyNote, PRIMARY_LINK_CLASS, SectionHeader } from "./shared";

/** Aba Resumo (FUC15 v6): ação principal, indicadores com delta, mini evolução, últimos treinos e recordes. */
export function SummaryTab({ dashboard, options, filterId, hrefFor }: TabContext) {
  return (
    <div className="space-y-6">
      <MainAction mainAction={dashboard.mainAction} />
      <Indicators dashboard={dashboard} />
      <MiniEvolution dashboard={dashboard} options={options} filterId={filterId} hrefFor={hrefFor} />
      <RecentTrainings trainings={dashboard.recentTrainings} />
      {dashboard.records.length > 0 && <TopRecords records={dashboard.records} hrefFor={hrefFor} />}
    </div>
  );
}

function MainAction({ mainAction }: { mainAction: Dashboard["mainAction"] }) {
  const visit = mainAction.type === "CONTINUE_VISIT" ? mainAction.activeVisit : null;

  return (
    <section
      aria-label="Ação principal"
      className="rounded-md bg-surface p-4 border-l-2 border-accent-target flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      {visit ? (
        <>
          <div className="min-w-0">
            <p className="text-sm text-accent-brass-soft font-medium">Visita em andamento</p>
            <p className="text-foreground truncate">{visit.trainingLocationName ?? "Local"}</p>
            <p className="text-sm text-foreground-muted">Início: {formatDateTime(visit.startedAt)}</p>
            {visit.activeTrainingModalityNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {visit.activeTrainingModalityNames.map((name, index) => (
                  <span
                    key={`${name}-${index}`}
                    className="text-xs rounded-full bg-accent-brass/15 text-accent-brass-soft px-2 py-0.5"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Link href="/treinos/visitas" className={`${PRIMARY_LINK_CLASS} shrink-0`}>
            Continuar treino
          </Link>
        </>
      ) : (
        <>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold">Pronto pra treinar?</p>
            <p className="text-sm text-foreground-muted">
              Inicie uma visita no seu local de treino e registre as séries conforme atira.
            </p>
          </div>
          <Link href="/treinos/visitas" className={`${PRIMARY_LINK_CLASS} shrink-0`}>
            Iniciar treino
          </Link>
        </>
      )}
    </section>
  );
}

function Indicators({ dashboard }: { dashboard: Dashboard }) {
  const stats: { label: string; indicator: Indicator }[] = [
    { label: "Treinos esse mês", indicator: dashboard.trainingsThisMonth },
    { label: "Disparos esse mês", indicator: dashboard.shotsThisMonth },
    { label: "Modalidades praticadas", indicator: dashboard.modalitiesPracticed },
  ];

  return (
    <section aria-label="Indicadores" className="grid grid-cols-3 gap-x-3 pb-5 border-b border-border">
      {stats.map(({ label, indicator }) => {
        const delta = formatDelta(indicator);
        return (
          <div key={label} role="group" aria-label={label} className="min-w-0">
            <p className="font-display text-2xl font-medium">{formatNumber(indicator.value)}</p>
            <p className="text-sm text-foreground-muted">{label}</p>
            <p
              aria-label={delta.label}
              className={`text-xs mt-0.5 ${delta.tone === "positive" ? "text-positive" : "text-foreground-muted"}`}
            >
              {delta.text}
            </p>
          </div>
        );
      })}
    </section>
  );
}

/** Evolução sugerida (UC42 v7), pequena e sem controles; some se não há dados. */
function MiniEvolution({
  dashboard,
  options,
  filterId,
  hrefFor,
}: Pick<TabContext, "options" | "filterId" | "hrefFor"> & { dashboard: Dashboard }) {
  const router = useRouter();
  const suggestion = dashboard.suggestedEvolution;
  const key = suggestion ? `${suggestion.modalityId}|${suggestion.resultTypeId}` : "";
  const [result, setResult] = useState<{ key: string; points: EvolutionPoint[] } | null>(null);

  useEffect(() => {
    if (!suggestion) return;
    let cancelled = false;

    async function load() {
      const query = new URLSearchParams({
        modalityId: suggestion!.modalityId,
        resultTypeId: suggestion!.resultTypeId,
        period: "30d",
        mode: "MEDIA",
      });
      const response = await fetch(`/api/dashboard/evolution?${query}`);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (cancelled) return;
      if (!response.ok) {
        setResult({ key, points: [] }); // sem o gráfico, o resumo segue sem o bloco
        return;
      }
      setResult({ key, points: parseEvolutionResponse((await response.json()).data).points });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [suggestion, key, router]);

  if (!suggestion || result?.key !== key || result.points.length === 0) return null;

  const modality = options.find((m) => m.id === suggestion.modalityId);
  const resultType = modality?.resultTypes.find((t) => t.id === suggestion.resultTypeId);
  const unit = resultType ? resultTypeUnit(resultType.name) : null;
  const label = resultType
    ? `Média diária de ${resultType.name}${unit ? ` (${unit.suffix})` : ""} — ${modality!.name}`
    : "Evolução dos últimos 30 dias";
  const { startDate, endDate } = periodWindow("30d");

  return (
    <section aria-labelledby="mini-evolution-title" className="rounded-md bg-surface p-4">
      <SectionHeader
        id="mini-evolution-title"
        title="Evolução"
        link={{
          href: hrefFor({ aba: "evolucao", tipo: suggestion.resultTypeId, mod: filterId ? null : suggestion.modalityId }),
          label: "Ver evolução",
        }}
      />
      <p className="text-sm text-foreground-muted mb-1">{label}</p>
      <TimeLineChart
        label={label}
        points={result.points}
        startDate={startDate}
        endDate={endDate}
        formatValue={(v) => formatValue(v, resultType?.name ?? "")}
        height={120}
      />
    </section>
  );
}

function RecentTrainings({ trainings }: { trainings: Dashboard["recentTrainings"] }) {
  return (
    <section aria-labelledby="recent-trainings-title">
      <SectionHeader
        id="recent-trainings-title"
        title="Últimos treinos"
        link={trainings.length > 0 ? { href: "/treinos/historico", label: "Ver histórico" } : undefined}
      />
      {trainings.length === 0 ? (
        // sem botão próprio: o convite já está na ação principal, logo acima
        <EmptyNote>Ainda não há treinos. Comece pelo &quot;Iniciar treino&quot; acima.</EmptyNote>
      ) : (
        <ul>
          {trainings.slice(0, 3).map((t) => {
            const content = (
              <>
                <div className="min-w-0">
                  <p className="text-foreground truncate">{t.modalityName ?? "Treino"}</p>
                  <p className="text-sm text-foreground-muted truncate">
                    {formatDate(t.startedAt)}
                    {t.trainingLocationName ? ` · ${t.trainingLocationName}` : ""}
                  </p>
                </div>
                {t.highlight && (
                  <span className="text-sm text-accent-target-soft shrink-0">{formatHighlight(t.highlight)}</span>
                )}
              </>
            );
            return (
              <li key={t.trainingId} className="border-b border-border last:border-0">
                {t.visitId ? (
                  <Link
                    href={`/treinos/${t.visitId}`}
                    className="flex items-center justify-between gap-3 py-2 -mx-2 px-2 rounded-md hover:bg-surface transition-colors"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-3 py-2">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TopRecords({ records, hrefFor }: { records: Dashboard["records"]; hrefFor: TabContext["hrefFor"] }) {
  return (
    <section aria-labelledby="top-records-title">
      <SectionHeader
        id="top-records-title"
        title="Recordes"
        link={{ href: hrefFor({ aba: "recordes" }), label: "Ver todos" }}
      />
      <ul className="grid grid-cols-3 gap-x-3">
        {records.slice(0, 3).map((r) => {
          const unit = resultTypeUnit(r.resultTypeName);
          return (
            <li key={r.resultTypeName} className="min-w-0">
              <p className="font-display text-2xl font-medium">
                {formatNumber(r.value)}
                {unit && <span className="text-sm text-foreground-muted ml-1">{unit.suffix}</span>}
              </p>
              <p className="text-sm text-foreground-muted truncate">{r.resultTypeName}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
