"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconCircle, IconCircleCheck } from "@tabler/icons-react";
import { AppNav } from "@/components/AppNav";
import { LogoWordmark } from "@/components/LogoWordmark";
import { TargetRings } from "@/components/TargetRings";

type OnboardingStep = "CREATE_PROFILE" | "CONFIGURE_MODALITIES" | "REGISTER_WEAPON";

// Só o que a tela usa do GET /api/dashboard (UC42)
type Dashboard = {
  // ausente quando não há pendência de configuração
  onboarding?: { pendingSteps: OnboardingStep[] };
  trainingsThisMonth: number;
  // mais recente primeiro
  recentTrainings: { startedAt: string }[];
};

// Ordem de exibição e destino de cada pendência — "Continuar configuração"
// leva pra primeira que ainda estiver pendente.
const ONBOARDING_STEPS: { step: OnboardingStep; label: string; href: string }[] = [
  { step: "CREATE_PROFILE", label: "Criar perfil", href: "/usuario/perfil" },
  { step: "CONFIGURE_MODALITIES", label: "Configurar modalidades", href: "/usuario/modalidades" },
  { step: "REGISTER_WEAPON", label: "Cadastrar arma", href: "/acervo/armas/nova" },
];

function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

// Diferença em dias de calendário (não em horas corridas): treino ontem às
// 23h visto hoje às 8h é "ontem", não "hoje".
function daysAgoLabel(iso: string, now: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

function contextLine(dashboard: Dashboard, now: Date): string {
  const count = dashboard.trainingsThisMonth;
  const parts = [count === 0 ? "Nenhum treino este mês" : `${count} ${count === 1 ? "treino" : "treinos"} este mês`];
  const [latest] = dashboard.recentTrainings;
  if (latest) {
    parts.push(`última visita ${daysAgoLabel(latest.startedAt, now)}`);
  }
  return parts.join(" · ");
}

/**
 * FUC17: destino pós-login sem visita ativa. Mostra a configuração
 * pendente no primeiro acesso; depois vira só uma saudação com contexto
 * rápido — sem CTA, a pessoa segue pela nav.
 */
export default function BoasVindasPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // O nome não vem no dashboard — sai do perfil (GET /api/users/me, FUC03)
      const [dashboardResponse, profileResponse] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/users/me"),
      ]);

      if (dashboardResponse.status === 401 || profileResponse.status === 401) {
        router.push("/login");
        return;
      }

      if (!dashboardResponse.ok || !profileResponse.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar suas informações");
        }
        return;
      }

      const [{ data: dashboardData }, { data: profile }] = await Promise.all([
        dashboardResponse.json(),
        profileResponse.json(),
      ]);
      if (!cancelled) {
        setDashboard(dashboardData);
        setName(profile.name);
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

      <main className="flex-1 relative overflow-hidden min-h-screen flex items-center justify-center px-5 py-10 pb-24 md:pb-10">
        {/* Maior e mais presente que nas outras telas: aqui não compete com formulário */}
        <TargetRings className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 w-[min(max(96vw,560px),92vh,760px)] h-[min(max(96vw,560px),92vh,760px)] text-accent-target pointer-events-none" />

        {/* Placa por trás do texto: o centro da retícula (cruz e pontos) não corta a saudação */}
        <div className="relative z-10 w-full max-w-sm text-center rounded-lg bg-background/85 px-5 py-6">
          <LogoWordmark className="text-4xl mb-4" />

          {error ? (
            <p className="text-sm text-accent-target" role="alert">
              {error}
            </p>
          ) : !dashboard || name === null ? (
            <p className="text-foreground-muted">Carregando...</p>
          ) : dashboard.onboarding ? (
            <>
              <h1 className="font-display text-lg font-semibold mb-4">Bem-vindo, {name}</h1>
              <OnboardingChecklist pendingSteps={dashboard.onboarding.pendingSteps} />
            </>
          ) : (
            <Greeting name={name} dashboard={dashboard} />
          )}
        </div>
      </main>
    </div>
  );
}

function Greeting({ name, dashboard }: { name: string; dashboard: Dashboard }) {
  const now = new Date();
  return (
    <>
      <h1 className="font-display text-lg font-semibold mb-1">
        {greetingForHour(now.getHours())}, {name}
      </h1>
      <p className="text-sm text-foreground-muted">{contextLine(dashboard, now)}</p>
    </>
  );
}

function OnboardingChecklist({ pendingSteps }: { pendingSteps: OnboardingStep[] }) {
  const firstPending = ONBOARDING_STEPS.find((s) => pendingSteps.includes(s.step));
  const doneCount = ONBOARDING_STEPS.filter((s) => !pendingSteps.includes(s.step)).length;

  return (
    <section aria-labelledby="onboarding-title" className="rounded-md bg-surface p-5 text-left">
      <div className="flex items-baseline justify-between mb-3">
        <h2 id="onboarding-title" className="font-display text-base font-semibold">
          Configuração inicial
        </h2>
        <span className="text-sm text-foreground-muted">
          {doneCount} de {ONBOARDING_STEPS.length} concluídos
        </span>
      </div>
      <ul className="space-y-2 mb-4">
        {ONBOARDING_STEPS.map(({ step, label }) => {
          const done = !pendingSteps.includes(step);
          return (
            <li key={step} className="flex items-center gap-2 text-sm">
              {done ? (
                <IconCircleCheck size={18} stroke={1.75} className="text-accent-target-soft shrink-0" aria-hidden />
              ) : (
                <IconCircle size={18} stroke={1.75} className="text-foreground-muted shrink-0" aria-hidden />
              )}
              <span className={done ? "text-foreground-muted" : "text-foreground"}>{label}</span>
              <span className="sr-only">{done ? "(concluído)" : "(pendente)"}</span>
            </li>
          );
        })}
      </ul>
      {firstPending && (
        <Link
          href={firstPending.href}
          className="block text-center rounded-md bg-accent-target hover:bg-accent-target-hover text-background text-sm font-medium px-4 py-2 transition-colors"
        >
          Continuar configuração
        </Link>
      )}
    </section>
  );
}
