"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CancelButton } from "@/components/CancelButton";
import { TargetRings } from "@/components/TargetRings";

type Catalog = { id: string; name: string };

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

export default function NovoAcessorioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<Catalog[]>([]);
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; typeId?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      const response = await fetch("/api/accessory-catalog/types");

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar os tipos");
          setLoading(false);
        }
        return;
      }

      const { data } = await response.json();
      if (!cancelled) {
        setTypes(data);
        setLoading(false);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors: { name?: string; typeId?: string } = {};
    if (!name.trim()) {
      errors.name = "Nome não pode ficar vazio";
    }
    if (!typeId) {
      errors.typeId = "Selecione um tipo";
    }
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setError(null);
    setSaving(true);

    const response = await fetch("/api/accessories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        typeId,
        notes: notes.trim() || undefined,
      }),
    });

    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível cadastrar o acessório");
      return;
    }

    router.push("/acervo/acessorios");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando catálogo...</p>
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
            { href: "/acervo/acessorios", label: "Acessórios" },
            { label: "Cadastrar acessório" },
          ]}
        />

        <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
          Cadastrar acessório
        </h1>
        <p className="text-foreground-muted mb-6">Nome e tipo são obrigatórios.</p>

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <label htmlFor="name" className="block text-sm text-foreground-muted mb-1">
              Nome
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Coldre"
              className={INPUT_CLASS}
            />
            {fieldErrors.name && (
              <p className="text-sm text-accent-target mt-1" role="alert">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="typeId" className="block text-sm text-foreground-muted mb-1">
              Tipo
            </label>
            <select
              id="typeId"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="" disabled>Selecione</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {fieldErrors.typeId && (
              <p className="text-sm text-accent-target mt-1" role="alert">
                {fieldErrors.typeId}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm text-foreground-muted mb-1">
              Observações <span className="text-foreground-muted/60">· opcional</span>
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

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
              {saving ? "Cadastrando..." : "Cadastrar"}
            </button>
            <CancelButton href="/acervo/acessorios" />
          </div>
        </form>
      </div>
    </div>
  );
}
