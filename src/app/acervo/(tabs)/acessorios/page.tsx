"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconPlugConnected } from "@tabler/icons-react";

type Weapon = { id: string };
type Accessory = {
  id: string;
  name: string;
  type: string | null;
  notes: string | null;
  weapons: Weapon[];
};

function formatAccessorySummary(accessory: Accessory) {
  const parts: string[] = [];
  if (accessory.type) parts.push(accessory.type);
  if (accessory.weapons.length > 0) {
    parts.push(`${accessory.weapons.length} ${accessory.weapons.length === 1 ? "arma" : "armas"}`);
  }
  return parts.join(" · ");
}

export default function AcessoriosTabPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAccessories() {
      const response = await fetch("/api/accessories");

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar os acessórios");
          setLoading(false);
        }
        return;
      }

      const { data } = await response.json();
      if (!cancelled) {
        setAccessories(data);
        setLoading(false);
      }
    }

    loadAccessories();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const filteredAccessories = accessories.filter((accessory) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      accessory.name.toLowerCase().includes(query) ||
      (accessory.type ?? "").toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <p className="text-foreground-muted">Carregando acessórios...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-foreground-muted">
          {accessories.length} {accessories.length === 1 ? "acessório" : "acessórios"} no acervo
        </p>
        <Link
          href="/acervo/acessorios/novo"
          className="rounded-md bg-accent-target hover:bg-accent-target-hover text-foreground text-sm font-medium px-4 py-2 transition-colors"
        >
          + Cadastrar acessório
        </Link>
      </div>

      {error && (
        <p className="text-sm text-accent-target mb-4" role="alert">
          {error}
        </p>
      )}

      {accessories.length > 1 && (
        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou tipo"
            aria-label="Buscar acessório"
            className="w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
          />
        </div>
      )}

      {accessories.length === 0 ? (
        <p className="text-foreground-muted">
          Seu acervo de acessórios está vazio. Cadastre o primeiro acima.
        </p>
      ) : filteredAccessories.length === 0 ? (
        <p className="text-foreground-muted">Nenhum acessório encontrado com essa busca.</p>
      ) : (
        <ul>
          {filteredAccessories.map((accessory) => {
            const summary = formatAccessorySummary(accessory);
            return (
              <li key={accessory.id} className="border-b border-border last:border-0">
                <Link
                  href={`/acervo/acessorios/${accessory.id}`}
                  className="flex items-center gap-3 py-2 -mx-2 px-2 rounded-md hover:bg-surface transition-colors"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-accent-sage/15 shrink-0">
                    <IconPlugConnected size={18} stroke={1.75} className="text-accent-sage-soft" />
                  </span>
                  <div>
                    <p className="text-foreground">{accessory.name}</p>
                    {summary && <p className="text-sm text-foreground-muted">{summary}</p>}
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
