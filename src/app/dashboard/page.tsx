"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { TargetRings } from "@/components/TargetRings";
import { formatDate } from "@/lib/datetime";

type RecentVisit = {
  visitId: string;
  trainingLocationName: string | null;
  startedAt: string;
  modalityNames: string[];
};

// UC42: destaque dinâmico — melhor valor do tipo de resultado mais
// registrado pelo atleta; ausente (null) enquanto não houver registro
// numérico elegível.
type Highlight = {
  resultTypeName: string;
  value: number;
};

type Dashboard = {
  trainingsThisMonth: number;
  shotsThisMonth: number;
  practicedModalities: string[];
  recentVisits: RecentVisit[];
  highlight: Highlight | null;
};

function formatNumber(value: number): string {
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const response = await fetch("/api/dashboard");

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar o dashboard");
        }
        return;
      }

      const { data } = await response.json();
      if (!cancelled) {
        setDashboard(data);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <AppNav />

      <main className="flex-1 relative overflow-hidden">
        <TargetRings className="absolute -right-32 -top-32 w-[420px] h-[420px] text-accent-brass pointer-events-none" />

        <div className="relative max-w-4xl px-5 md:px-6 py-6 pb-20 md:pb-6">
          <p className="text-foreground-muted mb-1">Bem-vindo de volta</p>
          <h1 className="font-display text-lg font-semibold mb-6">
            Sua evolução
          </h1>

          {error ? (
            <p className="text-sm text-accent-target" role="alert">
              {error}
            </p>
          ) : !dashboard ? (
            <p className="text-foreground-muted">Carregando dashboard...</p>
          ) : (
            <DashboardContent dashboard={dashboard} />
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardContent({ dashboard }: { dashboard: Dashboard }) {
  const stats = [
    { label: "Treinos esse mês", value: formatNumber(dashboard.trainingsThisMonth) },
    { label: "Disparos esse mês", value: formatNumber(dashboard.shotsThisMonth) },
  ];
  const { highlight } = dashboard;

  return (
    <>
      {/* hero: número grande, sem card */}
      <div role="group" aria-label="Destaque" className="mb-6">
        <p className="text-foreground-muted text-sm mb-1">
          {highlight ? `Melhor ${highlight.resultTypeName}` : "Destaque"}
        </p>
        <p className="font-display text-6xl md:text-7xl font-semibold tracking-tight">
          {highlight ? formatNumber(highlight.value) : "—"}
        </p>
        {!highlight && (
          <p className="text-sm text-foreground-muted mt-1">
            Registre resultados nas suas séries pra ver seu melhor aqui.
          </p>
        )}
      </div>

      {/* estatísticas secundárias em linha, sem cards */}
      <div className="flex flex-wrap gap-x-6 gap-y-4 mb-6 pb-6 border-b border-border">
        {stats.map((s) => (
          <div key={s.label} role="group" aria-label={s.label}>
            <p className="font-display text-2xl font-medium">{s.value}</p>
            <p className="text-sm text-foreground-muted">{s.label}</p>
          </div>
        ))}
        <div role="group" aria-label="Modalidades praticadas">
          <div className="flex flex-wrap gap-1.5 min-h-8 items-center">
            {dashboard.practicedModalities.length === 0 ? (
              <p className="font-display text-2xl font-medium">—</p>
            ) : (
              dashboard.practicedModalities.map((modalidade) => (
                <span
                  key={modalidade}
                  className="text-xs rounded-full bg-accent-brass/15 text-accent-brass-soft px-2 py-0.5"
                >
                  {modalidade}
                </span>
              ))
            )}
          </div>
          <p className="text-sm text-foreground-muted">Modalidades praticadas</p>
        </div>
      </div>

      <h2 className="font-display text-base font-semibold mb-3">
        Visitas recentes
      </h2>
      {dashboard.recentVisits.length === 0 ? (
        <div>
          <p className="text-foreground-muted mb-4">
            Nenhuma visita registrada ainda. Inicie sua primeira visita pra começar a acompanhar sua evolução.
          </p>
          <Link
            href="/treinos/visitas"
            className="rounded-md bg-accent-target hover:bg-accent-target-hover text-foreground text-sm font-medium px-4 py-2 transition-colors"
          >
            Iniciar primeira visita
          </Link>
        </div>
      ) : (
        <ul>
          {dashboard.recentVisits.map((v) => (
            <li key={v.visitId} className="border-b border-border last:border-0">
              <Link
                href={`/treinos/${v.visitId}`}
                className="flex items-center justify-between py-2 hover:bg-surface/50 transition-colors"
              >
                <div>
                  <p className="text-foreground mb-1.5">{v.trainingLocationName ?? "—"}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {v.modalityNames.map((modalidade) => (
                      <span
                        key={modalidade}
                        className="text-xs rounded-full bg-accent-brass/15 text-accent-brass-soft px-2 py-0.5"
                      >
                        {modalidade}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-sm text-foreground-muted">{formatDate(v.startedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
