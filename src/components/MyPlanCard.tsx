"use client";

import { formatBytes, usageLevel, usagePercent, type UsageLevel } from "@/lib/plans";
import { useMyPlan } from "@/lib/useMyPlan";

const BAR_COLOR: Record<UsageLevel, string> = {
  ok: "bg-accent-sage",
  warning: "bg-accent-target",
  limit: "bg-accent-brass",
};

const LEVEL_TEXT: Record<UsageLevel, string | null> = {
  ok: null,
  warning: "Perto do limite",
  limit: "Limite atingido",
};

function UsageBar({ id, label, used, limit, valueText }: { id: string; label: string; used: number; limit: number; valueText: string }) {
  const percent = usagePercent(used, limit);
  const level = usageLevel(used, limit);
  return (
    <div data-level={level}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span id={`${id}-label`} className="text-foreground-muted">
          {label}
        </span>
        <span className="text-foreground">{valueText}</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={`${id}-label`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${valueText}${LEVEL_TEXT[level] ? ` — ${LEVEL_TEXT[level]}` : ""}`}
        className="mt-1 h-2 rounded-full bg-surface-raised overflow-hidden"
      >
        <div className={`h-full rounded-full ${BAR_COLOR[level]}`} style={{ width: `${percent}%` }} />
      </div>
      {LEVEL_TEXT[level] && (
        <p className={`mt-1 text-xs ${level === "limit" ? "text-accent-brass-soft" : "text-accent-target-soft"}`}>
          {LEVEL_TEXT[level]}
        </p>
      )}
    </div>
  );
}

/** FUC28: "Meu plano" — plano, uso de fotos e espaço (barras em alerta a 80% e no limite a 100%) e limites em texto. */
export function MyPlanCard() {
  const { plan, loading, error, refresh } = useMyPlan();

  return (
    <section aria-labelledby="my-plan-title" className="mt-4 rounded-md bg-surface p-4 space-y-3" data-testid="my-plan-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="my-plan-title" className="text-sm text-foreground-muted">
          Meu plano
        </h2>
        {plan && (
          <p className="font-display text-base font-semibold" data-testid="my-plan-name">
            {plan.plan.name}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-foreground-muted">Carregando seu plano...</p>
      ) : !plan ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-accent-target" role="alert">
          {error ?? "Não foi possível carregar o seu plano"}
          <button type="button" onClick={() => void refresh()} className="min-h-11 px-2 underline">
            Tentar de novo
          </button>
        </p>
      ) : (
        <>
          <UsageBar
            id="plan-photos"
            label="Fotos"
            used={plan.usage.photos}
            limit={plan.limits.photosPerAthlete}
            valueText={`${plan.usage.photos} de ${plan.limits.photosPerAthlete}`}
          />
          <UsageBar
            id="plan-storage"
            label="Espaço"
            used={plan.usage.storageBytes}
            limit={plan.limits.storageBytesPerAthlete}
            valueText={`${formatBytes(plan.usage.storageBytes)} de ${formatBytes(plan.limits.storageBytesPerAthlete)}`}
          />
          <p className="text-sm text-foreground-muted">
            Seu plano permite até {plan.limits.photosPerSeries} {plan.limits.photosPerSeries === 1 ? "foto" : "fotos"} por série e{" "}
            {plan.limits.uploadsPerHour} {plan.limits.uploadsPerHour === 1 ? "envio" : "envios"} por hora.
          </p>
        </>
      )}
    </section>
  );
}
