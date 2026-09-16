"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Modality = { id: string; name: string };

export default function ModalidadesTabPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [practiced, setPracticed] = useState<Modality[]>([]);
  const [catalog, setCatalog] = useState<Modality[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  async function handleToggle(modality: Modality, isPracticed: boolean) {
    setError(null);
    setPendingId(modality.id);

    if (isPracticed) {
      const response = await fetch(`/api/practiced-modalities/${modality.id}`, { method: "DELETE" });
      setPendingId(null);

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
      return;
    }

    const response = await fetch("/api/practiced-modalities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modalityId: modality.id }),
    });
    setPendingId(null);

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

  if (loading) {
    return <p className="text-foreground-muted">Carregando modalidades...</p>;
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-accent-target mb-4" role="alert">
          {error}
        </p>
      )}

      {practiced.length === 0 && (
        <p className="text-foreground-muted mb-4">
          Toque numa modalidade abaixo pra registrar que você pratica.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {catalog.map((modality) => {
          const isPracticed = practiced.some((p) => p.id === modality.id);
          return (
            <button
              key={modality.id}
              type="button"
              aria-pressed={isPracticed}
              disabled={pendingId === modality.id}
              onClick={() => handleToggle(modality, isPracticed)}
              className={
                isPracticed
                  ? "inline-flex items-center gap-1.5 rounded-full bg-accent-target text-foreground px-3 py-1.5 text-sm disabled:opacity-60 transition-colors"
                  : "inline-flex items-center gap-1.5 rounded-full border border-border text-foreground-muted px-3 py-1.5 text-sm hover:text-foreground hover:border-accent-target disabled:opacity-60 transition-colors"
              }
            >
              {isPracticed && <span aria-hidden="true">✓</span>}
              {modality.name}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-foreground-muted mt-4">
        {practiced.length} modalidade{practiced.length === 1 ? "" : "s"} selecionada
        {practiced.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
