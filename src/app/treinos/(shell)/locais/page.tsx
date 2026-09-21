"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconMapPin } from "@tabler/icons-react";
import { Breadcrumb } from "@/components/Breadcrumb";

type TrainingLocation = {
  id: string;
  name: string;
  city: string;
  state: string;
};

function distinctStates(locations: TrainingLocation[]): string[] {
  return Array.from(new Set(locations.map((l) => l.state))).sort();
}

export default function LocaisTabPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<TrainingLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLocations() {
      const response = await fetch("/api/training-locations");

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar os locais de treino");
          setLoading(false);
        }
        return;
      }

      const { data } = await response.json();
      if (!cancelled) {
        setLocations(data);
        setLoading(false);
      }
    }

    loadLocations();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const states = useMemo(() => distinctStates(locations), [locations]);

  const filteredLocations = locations.filter((location) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query || location.name.toLowerCase().includes(query) || location.city.toLowerCase().includes(query);
    const matchesState = !stateFilter || location.state === stateFilter;
    return matchesSearch && matchesState;
  });

  return (
    <div>
      <Breadcrumb items={[{ href: "/treinos", label: "Treinos" }, { label: "Locais" }]} />
      <h1 className="font-display text-lg font-semibold mb-4">Locais</h1>

      {loading ? (
        <p className="text-foreground-muted">Carregando locais de treino...</p>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-foreground-muted">
              {locations.length} {locations.length === 1 ? "local" : "locais"} de treino
            </p>
            <Link
              href="/treinos/locais/novo"
              className="rounded-md bg-accent-target hover:bg-accent-target-hover text-foreground text-sm font-medium px-4 py-2 transition-colors"
            >
              + Cadastrar local
            </Link>
          </div>

          {error && (
            <p className="text-sm text-accent-target mb-4" role="alert">
              {error}
            </p>
          )}

          {locations.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou cidade"
                aria-label="Buscar local de treino"
                className="flex-1 min-w-[160px] rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
              />
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                aria-label="Filtrar por estado"
                className="rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
              >
                <option value="">Todos os estados</option>
                {states.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          )}

          {locations.length === 0 ? (
            <p className="text-foreground-muted">
              Você ainda não cadastrou nenhum local de treino. Cadastre o primeiro acima.
            </p>
          ) : filteredLocations.length === 0 ? (
            <p className="text-foreground-muted">Nenhum local encontrado com esses filtros.</p>
          ) : (
            <ul>
              {filteredLocations.map((location) => (
                <li key={location.id} className="border-b border-border last:border-0">
                  <Link
                    href={`/treinos/locais/${location.id}`}
                    className="flex items-center gap-3 py-2 -mx-2 px-2 rounded-md hover:bg-surface transition-colors"
                  >
                    <span className="flex items-center justify-center w-9 h-9 rounded-full bg-accent-target/15 shrink-0">
                      <IconMapPin size={18} stroke={1.75} className="text-accent-target-soft" />
                    </span>
                    <div>
                      <p className="text-foreground">{location.name}</p>
                      <p className="text-sm text-foreground-muted">{location.city} · {location.state}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
