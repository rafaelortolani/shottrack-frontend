"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";

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

function distinctById(items: Catalog[]): Catalog[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return Array.from(byId.values());
}

export default function MunicoesTabPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ammunitions, setAmmunitions] = useState<Ammunition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [caliberFilter, setCaliberFilter] = useState("");

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

  const calibers = useMemo(
    () => distinctById(ammunitions.map((a) => a.caliber).filter((c): c is Catalog => c !== null)),
    [ammunitions]
  );

  const filteredAmmunitions = ammunitions.filter((ammo) => {
    const { primary } = formatAmmoSummary(ammo);
    const matchesSearch = primary.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCaliber = !caliberFilter || ammo.caliber?.id === caliberFilter;
    return matchesSearch && matchesCaliber;
  });

  if (loading) {
    return <p className="text-foreground-muted">Carregando munições...</p>;
  }

  return (
    <div>
      <Breadcrumb items={[{ href: "/acervo", label: "Acervo" }, { label: "Munições" }]} />
      <h1 className="font-display text-lg font-semibold mb-4">Munições</h1>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-foreground-muted">
          {ammunitions.length} {ammunitions.length === 1 ? "munição" : "munições"} no acervo
        </p>
        <Link
          href="/acervo/municoes/nova"
          className="rounded-md bg-accent-target hover:bg-accent-target-hover text-background text-sm font-medium px-4 py-2 transition-colors"
        >
          + Cadastrar munição
        </Link>
      </div>

      {error && (
        <p className="text-sm text-accent-target mb-4" role="alert">
          {error}
        </p>
      )}

      {ammunitions.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por fabricante ou apelido"
            aria-label="Buscar munição"
            className="flex-1 min-w-[160px] rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
          />
          <select
            value={caliberFilter}
            onChange={(e) => setCaliberFilter(e.target.value)}
            aria-label="Filtrar por calibre"
            className="rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
          >
            <option value="">Todos os calibres</option>
            {calibers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {ammunitions.length === 0 ? (
        <p className="text-foreground-muted">
          Seu acervo de munições está vazio. Cadastre a primeira acima.
        </p>
      ) : filteredAmmunitions.length === 0 ? (
        <p className="text-foreground-muted">Nenhuma munição encontrada com esses filtros.</p>
      ) : (
        <ul>
          {filteredAmmunitions.map((ammo) => {
            const { primary, secondary } = formatAmmoSummary(ammo);
            return (
              <li key={ammo.id} className="border-b border-border last:border-0">
                <Link
                  href={`/acervo/municoes/${ammo.id}`}
                  className="flex items-center gap-3 py-2 px-3 border-l-2 border-accent-brass rounded-r-md hover:bg-surface transition-colors"
                >
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
