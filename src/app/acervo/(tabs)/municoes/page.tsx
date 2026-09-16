"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconCapsule } from "@tabler/icons-react";

type Catalog = { id: string; name: string };
type Ammunition = {
  id: string;
  nickname: string | null;
  manufacturer: Catalog | null;
  caliber: Catalog | null;
};

function formatAmmoSummary(ammo: Ammunition) {
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

export default function MunicoesTabPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ammunitions, setAmmunitions] = useState<Ammunition[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAmmunitions() {
      const response = await fetch("/api/ammunitions");

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar as munições");
          setLoading(false);
        }
        return;
      }

      const { data } = await response.json();
      if (!cancelled) {
        setAmmunitions(data);
        setLoading(false);
      }
    }

    loadAmmunitions();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return <p className="text-foreground-muted">Carregando munições...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-foreground-muted">
          {ammunitions.length} {ammunitions.length === 1 ? "munição" : "munições"} no acervo
        </p>
        <Link
          href="/acervo/municoes/nova"
          className="rounded-md bg-accent-target hover:bg-accent-target-hover text-foreground text-sm font-medium px-4 py-2 transition-colors"
        >
          + Cadastrar munição
        </Link>
      </div>

      {error && (
        <p className="text-sm text-accent-target mb-6" role="alert">
          {error}
        </p>
      )}

      {ammunitions.length === 0 ? (
        <p className="text-foreground-muted">
          Seu acervo de munições está vazio. Cadastre a primeira acima.
        </p>
      ) : (
        <ul className="space-y-3">
          {ammunitions.map((ammo) => {
            const { primary, secondary } = formatAmmoSummary(ammo);
            return (
              <li key={ammo.id}>
                <Link
                  href={`/acervo/municoes/${ammo.id}`}
                  className="flex items-center gap-3.5 rounded-md bg-surface border border-border px-4 py-3.5 hover:border-accent-brass transition-colors"
                >
                  <span className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-brass/15 shrink-0">
                    <IconCapsule size={20} stroke={1.75} className="text-accent-brass-soft" />
                  </span>
                  <div>
                    <p className="text-foreground">{primary}</p>
                    {secondary && <p className="text-sm text-foreground-muted">{secondary}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
