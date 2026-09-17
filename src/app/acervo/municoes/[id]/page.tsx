"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CancelButton } from "@/components/CancelButton";
import { TargetRings } from "@/components/TargetRings";

type Catalog = { id: string; name: string };
type Ammunition = {
  id: string;
  nickname: string | null;
  manufacturer: Catalog | null;
  caliber: Catalog | null;
  projectileWeightGrains: number | null;
  powderCharge: number | null;
  lot: string | null;
  notes: string | null;
};

type FormValues = {
  manufacturerId: string;
  nickname: string;
  caliberId: string;
  projectileWeightGrains: string;
  powderCharge: string;
  lot: string;
  notes: string;
};

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

function toFormValues(ammo: Ammunition): FormValues {
  return {
    manufacturerId: ammo.manufacturer?.id ?? "",
    nickname: ammo.nickname ?? "",
    caliberId: ammo.caliber?.id ?? "",
    projectileWeightGrains: ammo.projectileWeightGrains?.toString() ?? "",
    powderCharge: ammo.powderCharge?.toString() ?? "",
    lot: ammo.lot ?? "",
    notes: ammo.notes ?? "",
  };
}

function formatAmmoSummary(ammo: Ammunition): { primary: string; secondary: string } {
  const primary = ammo.nickname || ammo.manufacturer?.name || "Munição";

  const secondaryParts: string[] = [];
  if (ammo.nickname && ammo.manufacturer) {
    secondaryParts.push(ammo.manufacturer.name);
  }
  if (ammo.caliber) {
    secondaryParts.push(ammo.caliber.name);
  }

  return { primary, secondary: secondaryParts.join(" · ") };
}

function buildDiff(initial: FormValues, current: FormValues): Record<string, unknown> {
  const diff: Record<string, unknown> = {};

  if (current.manufacturerId !== initial.manufacturerId) {
    diff.manufacturerId = current.manufacturerId || null;
  }
  if (current.nickname !== initial.nickname) {
    diff.nickname = current.nickname;
  }
  if (current.caliberId !== initial.caliberId) {
    diff.caliberId = current.caliberId || null;
  }
  if (current.projectileWeightGrains !== initial.projectileWeightGrains) {
    diff.projectileWeightGrains = current.projectileWeightGrains === "" ? null : Number(current.projectileWeightGrains);
  }
  if (current.powderCharge !== initial.powderCharge) {
    diff.powderCharge = current.powderCharge === "" ? null : Number(current.powderCharge);
  }
  if (current.lot !== initial.lot) {
    diff.lot = current.lot;
  }
  if (current.notes !== initial.notes) {
    diff.notes = current.notes;
  }

  return diff;
}

export default function EditarMunicaoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const ammoId = params.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [manufacturers, setManufacturers] = useState<Catalog[]>([]);
  const [calibers, setCalibers] = useState<Catalog[]>([]);
  const [initialValues, setInitialValues] = useState<FormValues | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [summary, setSummary] = useState<{ primary: string; secondary: string } | null>(null);
  const [identificationError, setIdentificationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [ammunitionsRes, manufacturersRes, calibersRes] = await Promise.all([
        fetch("/api/ammunitions"),
        fetch("/api/ammunition-catalog/manufacturers"),
        fetch("/api/weapon-catalog/calibers"),
      ]);

      if ([ammunitionsRes, manufacturersRes, calibersRes].some((r) => r.status === 401)) {
        router.push("/login");
        return;
      }

      if (!ammunitionsRes.ok || !manufacturersRes.ok || !calibersRes.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar os dados");
          setLoading(false);
        }
        return;
      }

      const { data: ammunitions } = await ammunitionsRes.json();
      const ammo: Ammunition | undefined = ammunitions.find((a: Ammunition) => a.id === ammoId);

      if (!ammo) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const { data: manufacturersData } = await manufacturersRes.json();
      const { data: calibersData } = await calibersRes.json();

      if (!cancelled) {
        setManufacturers(manufacturersData);
        setCalibers(calibersData);
        const formValues = toFormValues(ammo);
        setInitialValues(formValues);
        setValues(formValues);
        setSummary(formatAmmoSummary(ammo));
        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [router, ammoId]);

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values || !initialValues) return;

    if (!values.manufacturerId && !values.nickname.trim()) {
      setIdentificationError("Informe ao menos o fabricante ou um apelido");
      return;
    }

    setIdentificationError(null);
    setError(null);

    const diff = buildDiff(initialValues, values);

    if (Object.keys(diff).length === 0) {
      router.push("/acervo/municoes");
      return;
    }

    setSaving(true);

    const response = await fetch(`/api/ammunitions/${ammoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(diff),
    });

    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      if (error?.code === "AMMUNITION_IDENTIFICATION_REQUIRED") {
        setIdentificationError("Informe ao menos o fabricante ou um apelido");
      } else {
        setError(error?.message ?? "Não foi possível salvar as alterações");
      }
      return;
    }

    router.push("/acervo/municoes");
  }

  async function handleDelete() {
    setError(null);
    setDeleteBlocked(false);
    setDeleting(true);

    const response = await fetch(`/api/ammunitions/${ammoId}`, { method: "DELETE" });

    setDeleting(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      if (error?.code === "AMMUNITION_IN_USE") {
        setDeleteBlocked(true);
      } else {
        setError(error?.message ?? "Não foi possível excluir a munição");
      }
      return;
    }

    router.push("/acervo/municoes");
  }

  if (loading || !values) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando munição...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground-muted mb-4">Munição não encontrada.</p>
          <Link href="/acervo/municoes" className="text-sm text-accent-target hover:text-accent-target-hover transition-colors">
            Voltar pro acervo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <TargetRings className="absolute -top-14 -right-14 z-0 w-[380px] h-[380px] text-accent-target-soft pointer-events-none" />

      <div className="relative max-w-sm px-5 md:px-6 py-6 pb-20 md:pb-6">
        <Breadcrumb
          items={[
            { href: "/acervo", label: "Acervo" },
            { href: "/acervo/municoes", label: "Munições" },
            { label: "Editar munição" },
          ]}
        />

        <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
          Editar munição
        </h1>
        {summary && (
          <p className="text-sm text-foreground-muted mb-1">
            <span className="text-foreground">{summary.primary}</span>
            {summary.secondary && <> · {summary.secondary}</>}
          </p>
        )}
        <p className="text-foreground-muted mb-6">
          Só os campos alterados são salvos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="manufacturerId" className="block text-sm text-foreground-muted mb-1">
                Fabricante <span className="text-foreground-muted/60">· opcional</span>
              </label>
              <select
                id="manufacturerId"
                value={values.manufacturerId}
                onChange={(e) => updateField("manufacturerId", e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Nenhum</option>
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="nickname" className="block text-sm text-foreground-muted mb-1">
                Apelido <span className="text-foreground-muted/60">· opcional</span>
              </label>
              <input
                id="nickname"
                type="text"
                value={values.nickname}
                onChange={(e) => updateField("nickname", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            {identificationError && (
              <p className="text-sm text-accent-target" role="alert">
                {identificationError}
              </p>
            )}

            <details className="rounded-md border border-border px-3 py-2">
              <summary className="text-sm text-foreground-muted cursor-pointer select-none">
                Detalhes adicionais (opcional)
              </summary>

              <div className="mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="caliberId" className="block text-sm text-foreground-muted mb-1">
                      Calibre
                    </label>
                    <select
                      id="caliberId"
                      value={values.caliberId}
                      onChange={(e) => updateField("caliberId", e.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="">Nenhum</option>
                      {calibers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="projectileWeightGrains" className="block text-sm text-foreground-muted mb-1">
                      Peso (grains)
                    </label>
                    <input
                      id="projectileWeightGrains"
                      type="number"
                      step="any"
                      value={values.projectileWeightGrains}
                      onChange={(e) => updateField("projectileWeightGrains", e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor="powderCharge" className="block text-sm text-foreground-muted mb-1">
                      Pólvora
                    </label>
                    <input
                      id="powderCharge"
                      type="number"
                      step="any"
                      value={values.powderCharge}
                      onChange={(e) => updateField("powderCharge", e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor="lot" className="block text-sm text-foreground-muted mb-1">
                      Lote
                    </label>
                    <input
                      id="lot"
                      type="text"
                      value={values.lot}
                      onChange={(e) => updateField("lot", e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label htmlFor="notes" className="block text-sm text-foreground-muted mb-1">
                    Observações
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={values.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </details>

            {error && (
              <p className="text-sm text-accent-target" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2 px-5 transition-colors"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <CancelButton href="/acervo/municoes" />
            </div>
          </form>

          <div className="pt-4 mt-4 border-t border-border">
            {deleteBlocked && (
              <p className="text-sm text-accent-target mb-3" role="alert">
                Essa munição já foi usada e não pode ser excluída.
              </p>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-accent-target hover:text-accent-target-hover disabled:opacity-60 transition-colors"
            >
              {deleting ? "Excluindo..." : "Excluir munição"}
            </button>
          </div>
      </div>
    </div>
  );
}
