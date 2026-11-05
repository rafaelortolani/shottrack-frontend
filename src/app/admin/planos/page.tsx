"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { callApi } from "@/lib/clientApi";
import { planErrorMessage, type Plan, type PlanAuditEntry } from "@/lib/plans";
import { PRIMARY_BUTTON_CLASS } from "../habitualidade/_components/ui";
import { AthletesTab } from "./_components/AthletesTab";
import { AuditList } from "./_components/AuditList";
import { NewPlanDialog } from "./_components/NewPlanDialog";
import { PlanCard } from "./_components/PlanCard";

type Tab = "limits" | "athletes";

/** Planos e limites (FUC27): abas Limites e Atletas, mais o Histórico. Acesso restrito a ADMIN (proxy + backend). */
export default function AdminPlanosPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("limits");
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audit, setAudit] = useState<PlanAuditEntry[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [plansResult, auditResult] = await Promise.all([
      callApi<Plan[]>("/api/admin/plans", { fallback: "Não foi possível carregar os planos" }),
      callApi<PlanAuditEntry[]>("/api/admin/plans/audit?limit=50", { fallback: "Não foi possível carregar o histórico" }),
    ]);
    if ([plansResult, auditResult].some((r) => !r.ok && r.status === 401)) {
      router.push("/login");
      return;
    }
    if (plansResult.ok) {
      setPlans(plansResult.data);
      setLoadError(null);
    } else {
      setLoadError(planErrorMessage(plansResult.code, plansResult.message, plansResult.status));
    }
    if (auditResult.ok) {
      setAudit(auditResult.data);
      setAuditError(null);
    } else {
      setAuditError(planErrorMessage(auditResult.code, auditResult.message, auditResult.status));
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    // carga inicial: o setState vem da resposta, não do corpo do efeito
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function changed(message?: string) {
    setNotice(message ?? null);
    await load();
  }

  const tabClass = (active: boolean) =>
    `min-h-11 px-4 text-sm font-medium border-b-2 transition-colors ${
      active ? "border-accent-target text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
    }`;

  return (
    <div>
      <Breadcrumb items={[{ href: "/admin", label: "Admin" }, { label: "Planos e limites" }]} />

      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="font-display text-lg font-semibold">Planos e limites</h1>
      </div>

      <div role="tablist" aria-label="Planos e limites" className="flex border-b border-border mb-4">
        {(
          [
            ["limits", "Limites"],
            ["athletes", "Atletas"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={tabClass(tab === id)}
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const next = id === "limits" ? "athletes" : "limits";
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <p className="text-sm text-positive mb-3" role="status">
          {notice}
        </p>
      )}

      {loadError ? (
        <p className="text-sm text-accent-target" role="alert">
          {loadError}
        </p>
      ) : plans === null ? (
        <p className="text-foreground-muted">Carregando planos...</p>
      ) : tab === "limits" ? (
        <div role="tabpanel" id="panel-limits" aria-labelledby="tab-limits" className="space-y-4">
          <button type="button" className={`min-h-11 ${PRIMARY_BUTTON_CLASS}`} onClick={() => setCreating(true)}>
            Novo plano
          </button>
          <ul className="space-y-4">
            {plans.map((plan) => (
              <PlanCard
                key={`${plan.code}|${plan.name}|${plan.active}|${plan.default}|${plan.limits.map((l) => l.value).join(",")}`}
                plan={plan}
                onChanged={changed}
              />
            ))}
          </ul>
        </div>
      ) : (
        <div role="tabpanel" id="panel-athletes" aria-labelledby="tab-athletes">
          <AthletesTab plans={plans} onChanged={changed} />
        </div>
      )}

      <AuditList entries={audit} error={auditError} />

      {creating && plans && (
        <NewPlanDialog
          plans={plans}
          onClose={() => setCreating(false)}
          onCreated={(plan) => {
            setCreating(false);
            void changed(`Plano ${plan.name} criado.`);
          }}
        />
      )}
    </div>
  );
}
