"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CancelButton } from "@/components/CancelButton";
import { PageContainer } from "@/components/PageContainer";

type Catalog = { id: string; name: string };
type Model = Catalog & { type: Catalog };
type Weapon = {
  id: string;
  nickname: string | null;
  type: Catalog;
  brand: Catalog;
  model: Catalog;
  caliber: Catalog;
};

const SELECT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors disabled:opacity-60";

const READONLY_CLASS =
  "w-full rounded-md bg-surface-raised border border-border px-3 py-2 text-foreground-muted cursor-default focus:outline-none";

export default function EditarArmaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const weaponId = params.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [brands, setBrands] = useState<Catalog[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [modelsForBrandId, setModelsForBrandId] = useState<string | null>(null);
  const [calibers, setCalibers] = useState<Catalog[]>([]);
  const [calibersForModelId, setCalibersForModelId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [caliberId, setCaliberId] = useState("");
  const [nickname, setNickname] = useState("");
  const [summary, setSummary] = useState<{ primary: string; secondary: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [weaponsRes, brandsRes] = await Promise.all([
        fetch("/api/weapons"),
        fetch("/api/weapon-catalog/brands"),
      ]);

      if ([weaponsRes, brandsRes].some((r) => r.status === 401)) {
        router.push("/login");
        return;
      }

      if (!weaponsRes.ok || !brandsRes.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar os dados");
          setLoading(false);
        }
        return;
      }

      const { data: weapons } = await weaponsRes.json();
      const weapon: Weapon | undefined = weapons.find((w: Weapon) => w.id === weaponId);

      if (!weapon) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const { data: brandsData } = await brandsRes.json();

      if (!cancelled) {
        setBrands(brandsData);
        setBrandId(weapon.brand.id);
        setModelId(weapon.model.id);
        setCaliberId(weapon.caliber.id);
        setNickname(weapon.nickname ?? "");
        setSummary({
          primary: weapon.nickname || `${weapon.brand.name} ${weapon.model.name}`,
          secondary: `${weapon.type.name} · ${weapon.caliber.name}`,
        });
        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [router, weaponId]);

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

    const response = await fetch(`/api/weapons/${weaponId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId,
        caliberId,
        nickname: nickname.trim() || undefined,
      }),
    });

    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível salvar as alterações");
      return;
    }

    router.push("/acervo/armas");
  }

  async function handleDelete() {
    setError(null);
    setDeleteBlocked(false);
    setDeleting(true);

    const response = await fetch(`/api/weapons/${weaponId}`, { method: "DELETE" });

    setDeleting(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      if (error?.code === "WEAPON_IN_USE") {
        setDeleteBlocked(true);
      } else {
        setError(error?.message ?? "Não foi possível excluir a arma");
      }
      return;
    }

    router.push("/acervo/armas");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando arma...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground-muted mb-4">Arma não encontrada.</p>
          <Link href="/acervo/armas" className="text-sm text-accent-target hover:text-accent-target-hover transition-colors">
            Voltar pro acervo
          </Link>
        </div>
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
          { label: "Editar arma" },
        ]}
      />

      <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
        Editar arma
      </h1>
      {summary && (
        <p className="text-sm text-foreground-muted mb-6">
          <span className="text-foreground">{summary.primary}</span> · {summary.secondary}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="nickname" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
              Apelido
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
            />
          </div>

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
              <option value="" disabled>Selecione</option>
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
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <CancelButton href="/acervo/armas" />
          </div>
        </form>

        <div className="pt-4 mt-4 border-t border-border">
          {deleteBlocked && (
            <p className="text-sm text-accent-target mb-3" role="alert">
              Essa arma já foi usada e não pode ser excluída.
            </p>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-accent-target hover:text-accent-target-hover disabled:opacity-60 transition-colors"
          >
            {deleting ? "Excluindo..." : "Excluir arma"}
          </button>
        </div>
    </PageContainer>
  );
}
