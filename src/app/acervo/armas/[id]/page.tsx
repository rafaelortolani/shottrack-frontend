"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { CancelButton } from "@/components/CancelButton";
import { TargetRings } from "@/components/TargetRings";

type Catalog = { id: string; name: string };
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

export default function EditarArmaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const weaponId = params.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [types, setTypes] = useState<Catalog[]>([]);
  const [brands, setBrands] = useState<Catalog[]>([]);
  const [calibers, setCalibers] = useState<Catalog[]>([]);
  const [models, setModels] = useState<Catalog[]>([]);
  const [modelsForBrandId, setModelsForBrandId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [caliberId, setCaliberId] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [weaponsRes, typesRes, brandsRes, calibersRes] = await Promise.all([
        fetch("/api/weapons"),
        fetch("/api/weapon-catalog/types"),
        fetch("/api/weapon-catalog/brands"),
        fetch("/api/weapon-catalog/calibers"),
      ]);

      if ([weaponsRes, typesRes, brandsRes, calibersRes].some((r) => r.status === 401)) {
        router.push("/login");
        return;
      }

      if (!weaponsRes.ok || !typesRes.ok || !brandsRes.ok || !calibersRes.ok) {
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

      const { data: typesData } = await typesRes.json();
      const { data: brandsData } = await brandsRes.json();
      const { data: calibersData } = await calibersRes.json();

      if (!cancelled) {
        setTypes(typesData);
        setBrands(brandsData);
        setCalibers(calibersData);
        setTypeId(weapon.type.id);
        setBrandId(weapon.brand.id);
        setModelId(weapon.model.id);
        setCaliberId(weapon.caliber.id);
        setNickname(weapon.nickname ?? "");
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

  const loadingModels = brandId !== "" && modelsForBrandId !== brandId;

  function handleBrandChange(newBrandId: string) {
    setBrandId(newBrandId);
    setModelId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setSaving(true);

    const response = await fetch(`/api/weapons/${weaponId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeId,
        brandId,
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

    router.push("/acervo");
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

    router.push("/acervo");
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
          <Link href="/acervo" className="text-sm text-accent-target hover:text-accent-target-hover transition-colors">
            Voltar pro acervo
          </Link>
        </div>
      </div>
    );
  }

  const canSubmit = Boolean(typeId && brandId && modelId && caliberId);

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
      <div className="relative w-full max-w-sm px-6">
        <TargetRings className="absolute -top-14 -right-14 z-0 w-[380px] h-[380px] text-accent-target-soft pointer-events-none" />

        <div className="relative z-10">
          <BackLink href="/acervo" />

          <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
            Editar arma
          </h1>
          <p className="text-foreground-muted mb-6">Atualize os dados ou exclua essa arma do acervo.</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="nickname" className="block text-sm text-foreground-muted mb-1">
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
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <CancelButton href="/acervo" />
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
        </div>
      </div>
    </main>
  );
}
