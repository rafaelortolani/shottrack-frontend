"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TargetRings } from "@/components/TargetRings";

type Modality = { id: string; name: string };

export default function ModalidadesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [practiced, setPracticed] = useState<Modality[]>([]);
  const [catalog, setCatalog] = useState<Modality[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [practicedRes, catalogRes] = await Promise.all([
        fetch("/api/practiced-modalities"),
        fetch("/api/modality-catalog"),
      ]);

      if (practicedRes.status === 401 || catalogRes.status === 401) {
        router.push("/login");
        return;
      }

      if (!practicedRes.ok || !catalogRes.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar as modalidades");
          setLoading(false);
        }
        return;
      }

      const { data: practicedData } = await practicedRes.json();
      const { data: catalogData } = await catalogRes.json();

      if (!cancelled) {
        setPracticed(practicedData);
        setCatalog(catalogData);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleAdd(modality: Modality) {
    setError(null);
    setAddingId(modality.id);

    const response = await fetch("/api/practiced-modalities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modalityId: modality.id }),
    });

    setAddingId(null);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível adicionar a modalidade");
      return;
    }

    const { data } = await response.json();
    setPracticed((prev) => [...prev, data]);
  }

  async function handleRemove(modality: Modality) {
    setError(null);
    setRemovingId(modality.id);

    const response = await fetch(`/api/practiced-modalities/${modality.id}`, {
      method: "DELETE",
    });

    setRemovingId(null);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível remover a modalidade");
      return;
    }

    setPracticed((prev) => prev.filter((m) => m.id !== modality.id));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando modalidades...</p>
      </div>
    );
  }

  const available = catalog.filter((m) => !practiced.some((p) => p.id === m.id));

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-16 md:w-56 border-r border-border flex flex-col py-6 px-3 md:px-5 shrink-0">
        <span className="font-display font-semibold text-lg mb-10 hidden md:block">
          ShotTrack
        </span>
        <nav className="space-y-1 text-sm">
          <Link
            className="block rounded-md px-3 py-2 text-foreground-muted hover:text-foreground hover:bg-surface transition-colors"
            href="/dashboard"
          >
            <span className="hidden md:inline">Dashboard</span>
            <span className="md:hidden">○</span>
          </Link>
          <span
            className="block rounded-md px-3 py-2 text-foreground-muted/60 cursor-not-allowed"
            title="Em breve"
          >
            <span className="hidden md:inline">Treinos</span>
            <span className="md:hidden">○</span>
          </span>
          <span
            className="block rounded-md px-3 py-2 text-foreground-muted/60 cursor-not-allowed"
            title="Em breve"
          >
            <span className="hidden md:inline">Acervo</span>
            <span className="md:hidden">○</span>
          </span>
          <Link className="block rounded-md px-3 py-2 bg-surface text-foreground" href="/modalidades">
            <span className="hidden md:inline">Modalidades</span>
            <span className="md:hidden">●</span>
          </Link>
          <Link
            className="block rounded-md px-3 py-2 text-foreground-muted hover:text-foreground hover:bg-surface transition-colors"
            href="/perfil"
          >
            <span className="hidden md:inline">Perfil</span>
            <span className="md:hidden">○</span>
          </Link>
        </nav>
      </aside>

      <main className="flex-1 relative overflow-hidden">
        <TargetRings className="absolute -right-32 -top-32 w-[420px] h-[420px] text-accent-brass pointer-events-none" />

        <div className="relative max-w-lg px-6 md:px-10 py-10">
          <h1 className="font-display text-2xl font-semibold mb-10">Modalidades praticadas</h1>

          {error && (
            <p className="text-sm text-accent-target mb-6" role="alert">
              {error}
            </p>
          )}

          <section className="mb-12">
            {practiced.length === 0 ? (
              <p className="text-foreground-muted">
                Você ainda não registrou nenhuma modalidade. Escolha uma no catálogo
                abaixo pra começar.
              </p>
            ) : (
              <ul className="space-y-3">
                {practiced.map((modality) => (
                  <li
                    key={modality.id}
                    className="flex items-center justify-between py-2.5 px-3.5 rounded-md bg-surface border border-border"
                  >
                    <span className="text-foreground">{modality.name}</span>
                    <button
                      type="button"
                      aria-label={`Remover ${modality.name}`}
                      disabled={removingId === modality.id}
                      onClick={() => handleRemove(modality)}
                      className="text-foreground-muted hover:text-accent-target disabled:opacity-60 transition-colors"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {available.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-semibold mb-5">
                Catálogo
              </h2>
              <div className="flex flex-wrap gap-2">
                {available.map((modality) => (
                  <button
                    key={modality.id}
                    type="button"
                    aria-label={`Adicionar ${modality.name}`}
                    disabled={addingId === modality.id}
                    onClick={() => handleAdd(modality)}
                    className="rounded-md border border-border px-3.5 py-2 text-sm text-foreground-muted hover:text-foreground hover:border-accent-target disabled:opacity-60 transition-colors"
                  >
                    + {modality.name}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
