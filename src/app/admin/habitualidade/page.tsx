"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { callApi } from "@/lib/clientApi";
import { formatLocalDate } from "@/lib/datetime";
import type { AdminRule, AdminVersion } from "@/lib/habituality";
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "./_components/ui";

type RuleRow = AdminRule & { currentVersion: AdminVersion | null };

async function fetchRows(): Promise<{ ok: true; rows: RuleRow[] } | { ok: false; status: number; message: string }> {
  const result = await callApi<AdminRule[]>("/api/admin/habituality/rules", {
    fallback: "Não foi possível carregar as regras",
  });
  if (!result.ok) return result;

  // Versão vigente de cada regra (poucas regras: uma chamada por regra basta)
  const rows = await Promise.all(
    result.data.map(async (rule) => {
      const versions = await callApi<AdminVersion[]>(`/api/admin/habituality/rules/${rule.id}/versions`, {
        fallback: "",
      });
      return { ...rule, currentVersion: versions.ok ? (versions.data.find((v) => v.current) ?? null) : null };
    })
  );
  return { ok: true, rows };
}

/** Lista de regras de habitualidade (FUC24): criar, ativar/desativar. */
export default function AdminHabitualidadePage() {
  const router = useRouter();
  const [rules, setRules] = useState<RuleRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [legalReference, setLegalReference] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = useCallback(
    (result: Awaited<ReturnType<typeof fetchRows>>) => {
      if (result.ok) {
        setLoadError(null);
        setRules(result.rows);
      } else if (result.status === 401) {
        router.push("/login");
      } else {
        setLoadError(result.message);
      }
    },
    [router]
  );
  const load = useCallback(async () => apply(await fetchRows()), [apply]);

  useEffect(() => {
    let cancelled = false;
    fetchRows().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === "") {
      setNameError("Nome não pode ficar vazio");
      return;
    }
    setNameError(null);
    setActionError(null);
    setSaving(true);
    const result = await callApi<AdminRule>("/api/admin/habituality/rules", {
      method: "POST",
      body: { name: name.trim(), legalReference: legalReference.trim() || null, active: true },
      fallback: "Não foi possível criar a regra",
    });
    setSaving(false);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    router.push(`/admin/habitualidade/${result.data.id}`);
  }

  async function toggleActive(rule: RuleRow) {
    setActionError(null);
    const result = await callApi(`/api/admin/habituality/rules/${rule.id}`, {
      method: "PUT",
      body: { name: rule.name, legalReference: rule.legalReference, active: !rule.active },
      fallback: "Não foi possível alterar a regra",
    });
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    await load();
  }

  return (
    <div>
      <Breadcrumb items={[{ href: "/admin", label: "Admin" }, { label: "Habitualidade" }]} />

      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="font-display text-lg font-semibold">Regras de habitualidade</h1>
        {!creating && (
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreating(true)}>
            Nova regra
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={createRule} noValidate aria-label="Nova regra" className="rounded-md bg-surface p-4 space-y-3 mb-4">
          <div>
            <label htmlFor="rule-name" className={LABEL_CLASS}>
              Nome
            </label>
            <input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Habitualidade — Portaria X"
              className={INPUT_CLASS}
            />
            {nameError && (
              <p className="text-sm text-accent-target mt-1" role="alert">
                {nameError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="rule-reference" className={LABEL_CLASS}>
              Referência legal
            </label>
            <input
              id="rule-reference"
              value={legalReference}
              onChange={(e) => setLegalReference(e.target.value)}
              placeholder="Ex: Portaria nº 000/2026"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={PRIMARY_BUTTON_CLASS}>
              {saving ? "Criando..." : "Criar regra"}
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setCreating(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <p className="text-sm text-accent-target mb-3" role="alert">
          {actionError}
        </p>
      )}

      {loadError ? (
        <p className="text-sm text-accent-target" role="alert">
          {loadError}
        </p>
      ) : rules === null ? (
        <p className="text-foreground-muted">Carregando regras...</p>
      ) : rules.length === 0 ? (
        <p className="text-foreground-muted">Nenhuma regra cadastrada.</p>
      ) : (
        <ul>
          {rules.map((rule) => (
            <li key={rule.id} className="border-b border-border last:border-0 py-2 flex items-center gap-3">
              <Link
                href={`/admin/habitualidade/${rule.id}`}
                className="min-w-0 flex-1 py-1 hover:text-accent-target-soft transition-colors"
              >
                <p className="truncate">{rule.name}</p>
                <p className="text-sm text-foreground-muted truncate">
                  {rule.legalReference ?? "Sem referência legal"} ·{" "}
                  {rule.currentVersion ? `vigente desde ${formatLocalDate(rule.currentVersion.validFrom)}` : "sem versão vigente"}
                </p>
              </Link>
              <span
                className={`text-xs rounded-full px-2 py-0.5 ${
                  rule.active ? "bg-positive/15 text-positive" : "bg-surface-raised text-foreground-muted"
                }`}
              >
                {rule.active ? "Ativa" : "Inativa"}
              </span>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                aria-label={`${rule.active ? "Desativar" : "Ativar"} ${rule.name}`}
                onClick={() => toggleActive(rule)}
              >
                {rule.active ? "Desativar" : "Ativar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
