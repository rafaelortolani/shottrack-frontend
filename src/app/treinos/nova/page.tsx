"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CancelButton } from "@/components/CancelButton";
import { PageContainer } from "@/components/PageContainer";

type TrainingLocation = { id: string; name: string; city: string; state: string };

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

export default function IniciarVisitaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<TrainingLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (locationId === "") {
      setFieldError("Selecione um local");
      return;
    }

    setFieldError(null);
    setError(null);
    setSaving(true);

    const response = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainingLocationId: locationId }),
    });

    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível iniciar a visita");
      return;
    }

    router.push("/treinos/visitas");
  }

  return (
    <PageContainer width="form">
      <Breadcrumb
        items={[
          { href: "/treinos", label: "Treinos" },
          { href: "/treinos/visitas", label: "Visitas" },
          { label: "Iniciar visita" },
        ]}
      />

      <h1 className="font-display text-lg font-semibold tracking-tight mb-1">Iniciar visita</h1>
      <p className="text-foreground-muted mb-6">Selecione o local de treino.</p>

      {loading ? (
        <p className="text-foreground-muted">Carregando locais de treino...</p>
      ) : locations.length === 0 ? (
        <div>
          <p className="text-foreground-muted mb-4">
            Você ainda não cadastrou nenhum local de treino. Cadastre um primeiro.
          </p>
          <Link
            href="/treinos/locais/novo"
            className="rounded-md bg-accent-target hover:bg-accent-target-hover text-background text-sm font-medium px-4 py-2 transition-colors"
          >
            + Cadastrar local
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <label htmlFor="locationId" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
              Local de treino
            </label>
            <select
              id="locationId"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="" disabled>Selecione</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} · {location.city}/{location.state}
                </option>
              ))}
            </select>
            {fieldError && (
              <p className="text-sm text-accent-target mt-1" role="alert">
                {fieldError}
              </p>
            )}
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
              className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-background font-medium py-2 px-5 transition-colors"
            >
              {saving ? "Iniciando..." : "Iniciar"}
            </button>
            <CancelButton href="/treinos/visitas" />
          </div>
        </form>
      )}
    </PageContainer>
  );
}
