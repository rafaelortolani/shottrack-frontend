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
type Accessory = {
  id: string;
  name: string;
  type: string | null;
  notes: string | null;
  weapons: Weapon[];
};

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

function weaponLabel(weapon: Weapon) {
  return weapon.nickname || `${weapon.brand.name} ${weapon.model.name}`;
}

export default function EditarAcessorioPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const accessoryId = params.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [notes, setNotes] = useState("");
  const [associatedWeapons, setAssociatedWeapons] = useState<Weapon[]>([]);
  const [allWeapons, setAllWeapons] = useState<Weapon[]>([]);
  const [weaponToAssociate, setWeaponToAssociate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [associating, setAssociating] = useState(false);
  const [disassociatingId, setDisassociatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [accessoriesRes, weaponsRes] = await Promise.all([
        fetch("/api/accessories"),
        fetch("/api/weapons"),
      ]);

      if ([accessoriesRes, weaponsRes].some((r) => r.status === 401)) {
        router.push("/login");
        return;
      }

      if (!accessoriesRes.ok || !weaponsRes.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar os dados");
          setLoading(false);
        }
        return;
      }

      const { data: accessories } = await accessoriesRes.json();
      const accessory: Accessory | undefined = accessories.find((a: Accessory) => a.id === accessoryId);

      if (!accessory) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const { data: weaponsData } = await weaponsRes.json();

      if (!cancelled) {
        setName(accessory.name);
        setType(accessory.type ?? "");
        setNotes(accessory.notes ?? "");
        setAssociatedWeapons(accessory.weapons);
        setAllWeapons(weaponsData);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [router, accessoryId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Nome não pode ficar vazio");
      return;
    }

    setError(null);
    setSaving(true);

    const response = await fetch(`/api/accessories/${accessoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type: type.trim() || undefined,
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
      setError(error?.message ?? "Não foi possível salvar as alterações");
      return;
    }

    router.push("/acervo/acessorios");
  }

  async function handleAssociate() {
    if (!weaponToAssociate) return;

    setError(null);
    setAssociating(true);

    const response = await fetch(`/api/accessories/${accessoryId}/weapons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weaponId: weaponToAssociate }),
    });

    setAssociating(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível associar a arma");
      return;
    }

    const { data } = await response.json();
    setAssociatedWeapons(data.weapons);
    setWeaponToAssociate("");
  }

  async function handleDisassociate(weaponId: string) {
    setError(null);
    setDisassociatingId(weaponId);

    const response = await fetch(`/api/accessories/${accessoryId}/weapons/${weaponId}`, {
      method: "DELETE",
    });

    setDisassociatingId(null);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível desassociar a arma");
      return;
    }

    const { data } = await response.json();
    setAssociatedWeapons(data.weapons);
  }

  async function handleDelete() {
    setError(null);
    setDeleteBlocked(false);
    setDeleting(true);

    const response = await fetch(`/api/accessories/${accessoryId}`, { method: "DELETE" });

    setDeleting(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      if (error?.code === "ACCESSORY_IN_USE") {
        setDeleteBlocked(true);
      } else {
        setError(error?.message ?? "Não foi possível excluir o acessório");
      }
      return;
    }

    router.push("/acervo/acessorios");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando acessório...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground-muted mb-4">Acessório não encontrado.</p>
          <Link href="/acervo/acessorios" className="text-sm text-accent-target hover:text-accent-target-hover transition-colors">
            Voltar pro acervo
          </Link>
        </div>
      </div>
    );
  }

  const associatedIds = new Set(associatedWeapons.map((w) => w.id));
  const availableWeapons = allWeapons.filter((w) => !associatedIds.has(w.id));

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
      <div className="relative w-full max-w-sm px-6">
        <TargetRings className="absolute -top-14 -right-14 z-0 w-[380px] h-[380px] text-accent-target-soft pointer-events-none" />

        <div className="relative z-10">
          <BackLink href="/acervo/acessorios" />

          <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
            Editar acessório
          </h1>
          <p className="text-foreground-muted mb-6">Atualize os dados ou associe armas do acervo.</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm text-foreground-muted mb-1">
                Nome
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm text-foreground-muted mb-1">
                Tipo <span className="text-foreground-muted/60">· opcional</span>
              </label>
              <input
                id="type"
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={INPUT_CLASS}
              />
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
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <CancelButton href="/acervo/acessorios" />
            </div>
          </form>

          <div className="pt-4 mt-4 border-t border-border">
            <h2 className="text-sm text-foreground-muted mb-2">Armas associadas</h2>

            {associatedWeapons.length === 0 ? (
              <p className="text-sm text-foreground-muted mb-3">Nenhuma arma associada ainda.</p>
            ) : (
              <ul className="mb-3">
                {associatedWeapons.map((weapon) => (
                  <li
                    key={weapon.id}
                    className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                  >
                    <span className="text-foreground text-sm">{weaponLabel(weapon)}</span>
                    <button
                      type="button"
                      onClick={() => handleDisassociate(weapon.id)}
                      disabled={disassociatingId === weapon.id}
                      className="text-sm text-foreground-muted hover:text-accent-target disabled:opacity-60 transition-colors"
                    >
                      Desassociar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {availableWeapons.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={weaponToAssociate}
                  onChange={(e) => setWeaponToAssociate(e.target.value)}
                  aria-label="Selecionar arma pra associar"
                  className={INPUT_CLASS}
                >
                  <option value="">Selecione uma arma</option>
                  {availableWeapons.map((weapon) => (
                    <option key={weapon.id} value={weapon.id}>{weaponLabel(weapon)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssociate}
                  disabled={!weaponToAssociate || associating}
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground-muted hover:text-foreground hover:border-accent-target disabled:opacity-60 transition-colors shrink-0"
                >
                  {associating ? "Associando..." : "Associar"}
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-border">
            {deleteBlocked && (
              <p className="text-sm text-accent-target mb-3" role="alert">
                Esse acessório já foi usado e não pode ser excluído.
              </p>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-accent-target hover:text-accent-target-hover disabled:opacity-60 transition-colors"
            >
              {deleting ? "Excluindo..." : "Excluir acessório"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
