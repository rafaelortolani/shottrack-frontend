"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { CancelButton } from "@/components/CancelButton";
import { TargetRings } from "@/components/TargetRings";

type Catalog = { id: string; name: string };

const SELECT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors disabled:opacity-60";

export default function NovaArmaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<Catalog[]>([]);
  const [brands, setBrands] = useState<Catalog[]>([]);
  const [calibers, setCalibers] = useState<Catalog[]>([]);
  const [models, setModels] = useState<Catalog[]>([]);
  const [modelsForBrandId, setModelsForBrandId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [caliberId, setCaliberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      const [typesRes, brandsRes, calibersRes] = await Promise.all([
        fetch("/api/weapon-catalog/types"),
        fetch("/api/weapon-catalog/brands"),
        fetch("/api/weapon-catalog/calibers"),
      ]);

      if ([typesRes, brandsRes, calibersRes].some((r) => r.status === 401)) {
        router.push("/login");
        return;
      }

      if (!typesRes.ok || !brandsRes.ok || !calibersRes.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar o catálogo");
          setLoading(false);
        }
        return;
      }

      const { data: typesData } = await typesRes.json();
      const { data: brandsData } = await brandsRes.json();
      const { data: calibersData } = await calibersRes.json();

      if (!cancelled) {
        setTypes(typesData);
        setBrands(brandsData);
        setCalibers(calibersData);
        setLoading(false);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!brandId) {
      return;
    }

    let cancelled = false;

    fetch(`/api/weapon-catalog/brands/${brandId}/models`)
      .then(async (response) => {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          if (!cancelled) setError("Não foi possível carregar os modelos");
          return;
        }
        const { data } = await response.json();
        if (!cancelled) {
          setModels(data);
          setModelsForBrandId(brandId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [brandId, router]);

  const loadingModels = brandId !== "" && modelsForBrandId !== brandId;

  function handleBrandChange(newBrandId: string) {
    setBrandId(newBrandId);
    setModelId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setSaving(true);

    const response = await fetch("/api/weapons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typeId, brandId, modelId, caliberId }),
    });

    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível cadastrar a arma");
      return;
    }

    router.push("/acervo");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando catálogo...</p>
      </div>
    );
  }

  const canSubmit = Boolean(typeId && brandId && modelId && caliberId);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pb-20 md:pb-0">
      <div className="relative w-full max-w-sm px-6">
        <TargetRings className="absolute -top-14 -right-14 z-0 w-[380px] h-[380px] text-accent-target-soft pointer-events-none" />

        <div className="relative z-10">
          <BackLink href="/acervo" />

          <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
            Cadastrar arma
          </h1>
          <p className="text-foreground-muted mb-6">Selecione tipo, marca, modelo e calibre.</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="typeId" className="block text-sm text-foreground-muted mb-1">
                Tipo
              </label>
              <select
                id="typeId"
                required
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="" disabled>Selecione</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="brandId" className="block text-sm text-foreground-muted mb-1">
                Marca
              </label>
              <select
                id="brandId"
                required
                value={brandId}
                onChange={(e) => handleBrandChange(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="" disabled>Selecione</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="modelId" className="block text-sm text-foreground-muted mb-1">
                Modelo
              </label>
              <select
                id="modelId"
                required
                disabled={!brandId || loadingModels}
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="" disabled>
                  {brandId ? "Selecione" : "Escolha uma marca primeiro"}
                </option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="caliberId" className="block text-sm text-foreground-muted mb-1">
                Calibre
              </label>
              <select
                id="caliberId"
                required
                value={caliberId}
                onChange={(e) => setCaliberId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="" disabled>Selecione</option>
                {calibers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-accent-target" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || !canSubmit}
                className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2 px-5 transition-colors"
              >
                {saving ? "Cadastrando..." : "Cadastrar"}
              </button>
              <CancelButton href="/acervo" />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
