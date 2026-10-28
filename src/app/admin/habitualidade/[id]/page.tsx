"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { callApi } from "@/lib/clientApi";
import { formatLocalDate } from "@/lib/datetime";
import { summarizeLevel, type AdminRule, type AdminVersion } from "@/lib/habituality";
import { todayIso } from "../_components/dates";
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from "../_components/ui";

async function fetchRule(
  id: string
): Promise<{ ok: true; rule: AdminRule; versions: AdminVersion[] } | { ok: false; status: number; message: string }> {
  const [rules, versions] = await Promise.all([
    callApi<AdminRule[]>("/api/admin/habituality/rules", { fallback: "Não foi possível carregar a regra" }),
    callApi<AdminVersion[]>(`/api/admin/habituality/rules/${id}/versions`, {
      fallback: "Não foi possível carregar as versões",
    }),
  ]);
  if (!rules.ok) return rules;
  if (!versions.ok) return versions;

  const rule = rules.data.find((r) => r.id === id);
  if (!rule) return { ok: false, status: 404, message: "Regra não encontrada" };
  return { ok: true, rule, versions: [...versions.data].sort((a, b) => b.validFrom.localeCompare(a.validFrom)) };
}

/** Detalhe da regra (FUC24): dados da regra e lista de versões (vigente, futuras, passadas). */
export default function AdminRegraPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [rule, setRule] = useState<AdminRule | null>(null);
  const [versions, setVersions] = useState<AdminVersion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [legalReference, setLegalReference] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const apply = useCallback(
    (result: Awaited<ReturnType<typeof fetchRule>>) => {
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
        else setLoadError(result.message);
        return;
      }
      setLoadError(null);
      setRule(result.rule);
      setName(result.rule.name);
      setLegalReference(result.rule.legalReference ?? "");
      setActive(result.rule.active);
      setVersions(result.versions);
    },
    [router]
  );
  const load = useCallback(async () => apply(await fetchRule(id)), [apply, id]);

  useEffect(() => {
    let cancelled = false;
    fetchRule(id).then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply, id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === "") {
      setFormError("Nome não pode ficar vazio");
      return;
    }
    setFormError(null);
    setSaved(false);
    setSaving(true);
    const result = await callApi(`/api/admin/habituality/rules/${id}`, {
      method: "PUT",
      body: { name: name.trim(), legalReference: legalReference.trim() || null, active },
      fallback: "Não foi possível salvar a regra",
    });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setSaved(true);
    await load();
  }

  if (loadError) {
    return (
      <div>
        <Breadcrumb items={[{ href: "/admin", label: "Admin" }, { href: "/admin/habitualidade", label: "Habitualidade" }]} />
        <p className="text-sm text-accent-target" role="alert">
          {loadError}
        </p>
      </div>
    );
  }
  if (!rule || !versions) return <p className="text-foreground-muted">Carregando regra...</p>;

  const today = todayIso();

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { href: "/admin", label: "Admin" },
            { href: "/admin/habitualidade", label: "Habitualidade" },
            { label: rule.name },
          ]}
        />
        <h1 className="font-display text-lg font-semibold">{rule.name}</h1>
      </div>

      <form onSubmit={save} noValidate aria-label="Dados da regra" className="rounded-md bg-surface p-4 space-y-3">
        <div>
          <label htmlFor="rule-name" className={LABEL_CLASS}>
            Nome
          </label>
          <input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="rule-reference" className={LABEL_CLASS}>
            Referência legal
          </label>
          <input
            id="rule-reference"
            value={legalReference}
            onChange={(e) => setLegalReference(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <label className="flex items-center gap-2 min-h-11 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-accent-target"
          />
          Regra ativa
        </label>
        {formError && (
          <p className="text-sm text-accent-target" role="alert">
            {formError}
          </p>
        )}
        {saved && !formError && (
          <p className="text-sm text-positive" role="status">
            Regra salva.
          </p>
        )}
        <button type="submit" disabled={saving} className={PRIMARY_BUTTON_CLASS}>
          {saving ? "Salvando..." : "Salvar regra"}
        </button>
      </form>

      <section aria-labelledby="versions-heading">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 id="versions-heading" className="font-display text-base font-semibold">
            Versões
          </h2>
          <Link href={`/admin/habitualidade/${id}/versoes/nova`} className={PRIMARY_BUTTON_CLASS}>
            Nova versão
          </Link>
        </div>

        {versions.length === 0 ? (
          <p className="text-sm text-foreground-muted">Nenhuma versão cadastrada. Crie a primeira para a regra valer.</p>
        ) : (
          <ul>
            {versions.map((version) => {
              const future = version.validFrom > today;
              return (
                <li key={version.id} className="border-b border-border last:border-0">
                  <Link
                    href={`/admin/habitualidade/${id}/versoes/${version.id}`}
                    className="block py-2 -mx-2 px-2 rounded-md hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>Desde {formatLocalDate(version.validFrom)}</span>
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${
                          version.current
                            ? "bg-accent-target/15 text-accent-target-soft"
                            : future
                              ? "bg-accent-brass/15 text-accent-brass-soft"
                              : "bg-surface-raised text-foreground-muted"
                        }`}
                      >
                        {version.current ? "Vigente" : future ? "Futura" : "Passada"}
                      </span>
                    </div>
                    <p className="text-sm text-foreground-muted">
                      Janela de {version.windowMonths} {version.windowMonths === 1 ? "mês" : "meses"} ·{" "}
                      {version.levels.length} {version.levels.length === 1 ? "nível" : "níveis"}
                    </p>
                    {version.levels.map((level) => (
                      <p key={level.name} className="text-xs text-foreground-muted">
                        {level.name}: {summarizeLevel(level)}
                      </p>
                    ))}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
