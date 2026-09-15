"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconCrosshair } from "@tabler/icons-react";

type Catalog = { id: string; name: string };
type Weapon = {
  id: string;
  nickname: string | null;
  type: Catalog;
  brand: Catalog;
  model: Catalog;
  caliber: Catalog;
};

export default function ArmasTabPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWeapons() {
      const response = await fetch("/api/weapons");

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar as armas");
          setLoading(false);
        }
        return;
      }

      const { data } = await response.json();
      if (!cancelled) {
        setWeapons(data);
        setLoading(false);
      }
    }

    loadWeapons();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return <p className="text-foreground-muted">Carregando armas...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-foreground-muted">
          {weapons.length} {weapons.length === 1 ? "arma" : "armas"} no acervo
        </p>
        <Link
          href="/acervo/armas/nova"
          className="rounded-md bg-accent-target hover:bg-accent-target-hover text-foreground text-sm font-medium px-4 py-2 transition-colors"
        >
          + Cadastrar arma
        </Link>
      </div>

      {error && (
        <p className="text-sm text-accent-target mb-6" role="alert">
          {error}
        </p>
      )}

      {weapons.length === 0 ? (
        <p className="text-foreground-muted">
          Seu acervo de armas está vazio. Cadastre a primeira acima.
        </p>
      ) : (
        <ul className="space-y-3">
          {weapons.map((weapon) => (
            <li key={weapon.id}>
              <Link
                href={`/acervo/armas/${weapon.id}`}
                className="flex items-center gap-3.5 rounded-md bg-surface border border-border px-4 py-3.5 hover:border-accent-target transition-colors"
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-target/15 shrink-0">
                  <IconCrosshair size={20} stroke={1.75} className="text-accent-target-soft" />
                </span>
                <div>
                  <p className="text-foreground">
                    {weapon.nickname || `${weapon.brand.name} ${weapon.model.name}`}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    {weapon.type.name} · {weapon.caliber.name}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
