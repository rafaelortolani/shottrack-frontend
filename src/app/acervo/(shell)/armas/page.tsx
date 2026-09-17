"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconFocus2 } from "@tabler/icons-react";
import { Breadcrumb } from "@/components/Breadcrumb";

type Catalog = { id: string; name: string };
type Weapon = {
  id: string;
  nickname: string | null;
  type: Catalog;
  brand: Catalog;
  model: Catalog;
  caliber: Catalog;
};

function distinctById(items: Catalog[]): Catalog[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return Array.from(byId.values());
}

export default function ArmasTabPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [caliberFilter, setCaliberFilter] = useState("");

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

  const types = useMemo(() => distinctById(weapons.map((w) => w.type)), [weapons]);
  const calibers = useMemo(() => distinctById(weapons.map((w) => w.caliber)), [weapons]);

  const filteredWeapons = weapons.filter((weapon) => {
    const name = weapon.nickname || `${weapon.brand.name} ${weapon.model.name}`;
    const matchesSearch = name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesType = !typeFilter || weapon.type.id === typeFilter;
    const matchesCaliber = !caliberFilter || weapon.caliber.id === caliberFilter;
    return matchesSearch && matchesType && matchesCaliber;
  });

  if (loading) {
    return <p className="text-foreground-muted">Carregando armas...</p>;
  }

  return (
    <div>
      <Breadcrumb items={[{ href: "/acervo", label: "Acervo" }, { label: "Armas" }]} />
      <h1 className="font-display text-lg font-semibold mb-4">Armas</h1>

      <div className="flex items-center justify-between mb-4">
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
        <p className="text-sm text-accent-target mb-4" role="alert">
          {error}
        </p>
      )}

      {weapons.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou apelido"
            aria-label="Buscar arma"
            className="flex-1 min-w-[160px] rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filtrar por tipo"
            className="rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
          >
            <option value="">Todos os tipos</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
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

      {weapons.length === 0 ? (
        <p className="text-foreground-muted">
          Seu acervo de armas está vazio. Cadastre a primeira acima.
        </p>
      ) : filteredWeapons.length === 0 ? (
        <p className="text-foreground-muted">Nenhuma arma encontrada com esses filtros.</p>
      ) : (
        <ul>
          {filteredWeapons.map((weapon) => (
            <li key={weapon.id} className="border-b border-border last:border-0">
              <Link
                href={`/acervo/armas/${weapon.id}`}
                className="flex items-center gap-3 py-2 -mx-2 px-2 rounded-md hover:bg-surface transition-colors"
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-accent-target/15 shrink-0">
                  <IconFocus2 size={18} stroke={1.75} className="text-accent-target-soft" />
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
