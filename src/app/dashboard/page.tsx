"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconCircle, IconFocus2 } from "@tabler/icons-react";
import { AppNav } from "@/components/AppNav";
import { EvolutionSection } from "@/components/EvolutionSection";
import { PageContainer } from "@/components/PageContainer";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { resultTypeUnit } from "@/lib/resultTypeFormat";

// UC42: melhor valor de um tipo de resultado — um recorde do atleta, ou o
// destaque de uma modalidade ou de um treino, conforme onde aparece.
type Highlight = {
  resultTypeName: string;
  value: number;
};

type OnboardingStep = "CREATE_PROFILE" | "CONFIGURE_MODALITIES" | "REGISTER_WEAPON";

type ActiveVisit = {
  visitId: string;
  trainingLocationName: string | null;
  startedAt: string;
  activeTrainingModalityNames: string[];
};

type RecentTraining = {
  trainingId: string;
  visitId: string | null;
  startedAt: string;
  trainingLocationName: string | null;
  modalityName: string | null;
  highlight?: Highlight;
};

type ModalitySummary = {
  modalityName: string;
  trainingCount: number;
  best: Highlight | null;
};

type Dashboard = {
  // ausente quando não há pendência de configuração
  onboarding?: { pendingSteps: OnboardingStep[] };
  mainAction: { type: "CONTINUE_VISIT" | "START_VISIT"; activeVisit: ActiveVisit | null };
  trainingsThisMonth: number;
  shotsThisMonth: number;
  practicedModalities: string[];
  recentTrainings: RecentTraining[];
  totalTrainings: number;
  modalitySummaries: ModalitySummary[];
  weaponCollection: { weaponCount: number; weaponNames: string[] };
  // um por tipo de resultado com registro (ADR-0016); vazio sem nenhum ainda
  records: Highlight[];
};

// Ordem de exibição e destino de cada pendência — "Continuar configuração"
// leva pra primeira que ainda estiver pendente.
const ONBOARDING_STEPS: { step: OnboardingStep; label: string; href: string }[] = [
  { step: "CREATE_PROFILE", label: "Criar perfil", href: "/usuario/perfil" },
  { step: "CONFIGURE_MODALITIES", label: "Configurar modalidades", href: "/usuario/modalidades" },
  { step: "REGISTER_WEAPON", label: "Cadastrar arma", href: "/acervo/armas/nova" },
];

const RECENT_TRAININGS_SHOWN = 5;

const PRIMARY_LINK_CLASS =
  "inline-block rounded-md bg-accent-target hover:bg-accent-target-hover text-background text-sm font-medium px-4 py-2 transition-colors";
// Secundário: a ação principal logo abaixo é o único botão sólido da tela
const SECONDARY_LINK_CLASS =
  "inline-block rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground hover:border-accent-target transition-colors";
const SECTION_LINK_CLASS = "text-sm text-accent-brass-soft hover:text-accent-brass transition-colors";

function formatNumber(value: number): string {
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatHighlight(highlight: Highlight): string {
  const unit = resultTypeUnit(highlight.resultTypeName);
  return `${highlight.resultTypeName}: ${formatNumber(highlight.value)}${unit ? ` ${unit.suffix}` : ""}`;
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
        <PageContainer width="wide">
          <p className="text-foreground-muted mb-1">Bem-vindo de volta</p>
          <h1 className="font-display text-lg font-semibold mb-4">
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
        </PageContainer>
      </main>
    </div>
  );
}

function DashboardContent({ dashboard }: { dashboard: Dashboard }) {
  const trainingCountByModality = Object.fromEntries(
    dashboard.modalitySummaries.map((m) => [m.modalityName, m.trainingCount])
  );

  return (
    <div className="space-y-6">
      {dashboard.onboarding && <OnboardingSection pendingSteps={dashboard.onboarding.pendingSteps} />}
      <EvolutionSection
        trainingCountByModality={trainingCountByModality}
        recordTypeNames={dashboard.records.map((r) => r.resultTypeName)}
      />
      <MainActionSection mainAction={dashboard.mainAction} />
      <IndicatorsSection dashboard={dashboard} />
      {dashboard.records.length > 0 && <RecordsSection records={dashboard.records} />}
      <RecentTrainingsSection trainings={dashboard.recentTrainings} totalTrainings={dashboard.totalTrainings} />
      <ModalitiesSection summaries={dashboard.modalitySummaries} />
      <WeaponCollectionSection collection={dashboard.weaponCollection} />
    </div>
  );
}

function SectionHeader({ id, title, link }: { id: string; title: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h2 id={id} className="font-display text-base font-semibold">
        {title}
      </h2>
      {link && (
        <Link href={link.href} className={SECTION_LINK_CLASS}>
          {link.label}
        </Link>
      )}
    </div>
  );
}

function OnboardingSection({ pendingSteps }: { pendingSteps: OnboardingStep[] }) {
  // só as pendentes aparecem — item concluído sai da lista, o progresso fica no contador
  const pending = ONBOARDING_STEPS.filter((s) => pendingSteps.includes(s.step));
  const doneCount = ONBOARDING_STEPS.length - pending.length;

  return (
    <section aria-labelledby="onboarding-title" className="rounded-md bg-surface p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 id="onboarding-title" className="font-display text-base font-semibold">
          Configuração inicial
        </h2>
        <span className="text-sm text-foreground-muted">
          {doneCount} de {ONBOARDING_STEPS.length} concluídos
        </span>
      </div>
      <ul className="space-y-1.5 mb-3">
        {pending.map(({ step, label }) => (
          <li key={step} className="flex items-center gap-2 text-sm">
            <IconCircle size={18} stroke={1.75} className="text-foreground-muted shrink-0" aria-hidden />
            <span className="text-foreground">{label}</span>
          </li>
        ))}
      </ul>
      <Link href={pending[0].href} className={SECONDARY_LINK_CLASS}>
        Continuar configuração
      </Link>
    </section>
  );
}

function MainActionSection({ mainAction }: { mainAction: Dashboard["mainAction"] }) {
  const visit = mainAction.type === "CONTINUE_VISIT" ? mainAction.activeVisit : null;

  return (
    <section aria-label="Ação principal" className="rounded-md bg-surface p-4 border-l-2 border-accent-target">
      {visit ? (
        <>
          <p className="text-sm text-accent-brass-soft font-medium mb-1">Visita em andamento</p>
          <p className="text-foreground">{visit.trainingLocationName ?? "Local"}</p>
          <p className="text-sm text-foreground-muted mb-2">Início: {formatDateTime(visit.startedAt)}</p>
          {visit.activeTrainingModalityNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
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
          <Link href="/treinos/visitas" className={PRIMARY_LINK_CLASS}>
            Continuar treino
          </Link>
        </>
      ) : (
        <>
          <p className="font-display text-base font-semibold mb-1">Pronto pra treinar?</p>
          <p className="text-sm text-foreground-muted mb-3">
            Inicie uma visita no seu local de treino e registre as séries conforme atira.
          </p>
          <Link href="/treinos/visitas" className={PRIMARY_LINK_CLASS}>
            Iniciar treino
          </Link>
        </>
      )}
    </section>
  );
}

function IndicatorsSection({ dashboard }: { dashboard: Dashboard }) {
  const stats = [
    { label: "Treinos esse mês", value: formatNumber(dashboard.trainingsThisMonth) },
    { label: "Disparos esse mês", value: formatNumber(dashboard.shotsThisMonth) },
  ];

  return (
    <section aria-label="Indicadores" className="pb-6 border-b border-border">
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        {stats.map((s) => (
          <div key={s.label} role="group" aria-label={s.label}>
            <p className="font-display text-2xl font-medium">{s.value}</p>
            <p className="text-sm text-foreground-muted">{s.label}</p>
          </div>
        ))}
        <div role="group" aria-label="Modalidades praticadas">
          <div className="flex flex-wrap gap-1.5 min-h-8 items-center">
            {dashboard.practicedModalities.length === 0 ? (
              <p className="font-display text-2xl font-medium">0</p>
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
    </section>
  );
}

function RecordsSection({ records }: { records: Highlight[] }) {
  return (
    <section aria-labelledby="records-title">
      <SectionHeader id="records-title" title="Recordes" />
      <ul className="flex flex-wrap gap-x-6 gap-y-3">
        {records.map((r) => {
          const unit = resultTypeUnit(r.resultTypeName);
          return (
            <li key={r.resultTypeName}>
              <p className="font-display text-2xl font-medium">
                {formatNumber(r.value)}
                {unit && <span className="text-sm text-foreground-muted ml-1">{unit.suffix}</span>}
              </p>
              <p className="text-sm text-foreground-muted">{r.resultTypeName}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RecentTrainingsSection({ trainings, totalTrainings }: { trainings: RecentTraining[]; totalTrainings: number }) {
  return (
    <section aria-labelledby="recent-trainings-title">
      <SectionHeader
        id="recent-trainings-title"
        title="Últimos treinos"
        link={totalTrainings > RECENT_TRAININGS_SHOWN ? { href: "/treinos/visitas", label: "Ver todos" } : undefined}
      />
      {trainings.length === 0 ? (
        // sem botão próprio: o convite já está na ação principal, logo acima
        <p className="text-sm text-foreground-muted">Ainda não há treinos. Comece pelo &quot;Iniciar treino&quot; acima.</p>
      ) : (
        <ul>
          {trainings.map((t) => {
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

function ModalitiesSection({ summaries }: { summaries: ModalitySummary[] }) {
  return (
    <section aria-labelledby="modalities-title">
      <SectionHeader id="modalities-title" title="Modalidades" link={{ href: "/usuario/modalidades", label: "Ver modalidades" }} />
      {summaries.length === 0 ? (
        <p className="text-sm text-foreground-muted">Nenhum treino registrado em nenhuma modalidade ainda.</p>
      ) : (
        <ul>
          {summaries.map((m) => (
            <li
              key={m.modalityName}
              className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate">{m.modalityName}</p>
                <p className="text-sm text-foreground-muted">
                  {m.trainingCount} {m.trainingCount === 1 ? "treino" : "treinos"}
                </p>
              </div>
              {m.best && (
                <span className="text-sm text-accent-target-soft shrink-0">Melhor {formatHighlight(m.best)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WeaponCollectionSection({ collection }: { collection: Dashboard["weaponCollection"] }) {
  return (
    <section aria-labelledby="weapon-collection-title">
      <SectionHeader id="weapon-collection-title" title="Acervo" link={{ href: "/acervo", label: "Gerenciar acervo" }} />
      {collection.weaponCount === 0 ? (
        <p className="text-sm text-foreground-muted">Nenhuma arma cadastrada ainda.</p>
      ) : (
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-md bg-accent-target/15 text-accent-target-soft shrink-0">
            <IconFocus2 size={18} stroke={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-foreground">
              {collection.weaponCount} {collection.weaponCount === 1 ? "arma" : "armas"}
            </p>
            <p className="text-sm text-foreground-muted truncate">{collection.weaponNames.join(", ")}</p>
          </div>
        </div>
      )}
    </section>
  );
}
