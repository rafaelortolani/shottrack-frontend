"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CancelButton } from "@/components/CancelButton";
import { PageContainer } from "@/components/PageContainer";

type Catalog = { id: string; name: string };
type Model = Catalog & { type: Catalog };

const SELECT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors disabled:opacity-60";

const READONLY_CLASS =
  "w-full rounded-md bg-surface-raised border border-border px-3 py-2 text-foreground-muted cursor-default focus:outline-none";

export default function NovaArmaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Catalog[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [modelsForBrandId, setModelsForBrandId] = useState<string | null>(null);
  const [calibers, setCalibers] = useState<Catalog[]>([]);
  const [calibersForModelId, setCalibersForModelId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [caliberId, setCaliberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      const brandsRes = await fetch("/api/weapon-catalog/brands");

      if (brandsRes.status === 401) {
        router.push("/login");
        return;
      }

      if (!brandsRes.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar o catálogo");
          setLoading(false);
        }
        return;
      }

      const { data: brandsData } = await brandsRes.json();

      if (!cancelled) {
        setBrands(brandsData);
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

  useEffect(() => {
    if (!modelId) {
      return;
    }

    let cancelled = false;

    fetch(`/api/weapon-catalog/models/${modelId}/calibers`)
      .then(async (response) => {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          if (!cancelled) setError("Não foi possível carregar os calibres");
          return;
        }
        const { data } = await response.json();
        if (!cancelled) {
          setCalibers(data);
          setCalibersForModelId(modelId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [modelId, router]);

  const loadingModels = brandId !== "" && modelsForBrandId !== brandId;
  const loadingCalibers = modelId !== "" && calibersForModelId !== modelId;
  const selectedModel = models.find((m) => m.id === modelId);

  function handleBrandChange(newBrandId: string) {
    setBrandId(newBrandId);
    setModelId("");
    setCaliberId("");
  }

  function handleModelChange(newModelId: string) {
    setModelId(newModelId);
    setCaliberId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setSaving(true);

    const response = await fetch("/api/weapons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId, caliberId }),
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

    router.push("/acervo/armas");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando catálogo...</p>
      </div>
    );
  }

  const canSubmit = Boolean(modelId && caliberId);

  return (
    <PageContainer width="form">
      <Breadcrumb
        items={[
          { href: "/acervo", label: "Acervo" },
          { href: "/acervo/armas", label: "Armas" },
          { label: "Cadastrar arma" },
        ]}
      />

      <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
        Cadastrar arma
      </h1>
      <p className="text-foreground-muted mb-6">Selecione marca, modelo e calibre.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="brandId" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
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
          <label htmlFor="modelId" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
            Modelo
          </label>
          <select
            id="modelId"
            required
            disabled={!brandId || loadingModels}
            value={modelId}
            onChange={(e) => handleModelChange(e.target.value)}
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

        {selectedModel && (
          <div>
            <label htmlFor="type" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
              Tipo
            </label>
            <input
              id="type"
              type="text"
              readOnly
              value={selectedModel.type.name}
              className={READONLY_CLASS}
            />
          </div>
        )}

        <div>
          <label htmlFor="caliberId" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
            Calibre
          </label>
          <select
            id="caliberId"
            required
            disabled={!modelId || loadingCalibers}
            value={caliberId}
            onChange={(e) => setCaliberId(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="" disabled>
              {modelId ? "Selecione" : "Escolha um modelo primeiro"}
            </option>
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
            className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-background font-medium py-2 px-5 transition-colors"
          >
            {saving ? "Cadastrando..." : "Cadastrar"}
          </button>
          <CancelButton href="/acervo/armas" />
        </div>
      </form>
    </PageContainer>
  );
}
