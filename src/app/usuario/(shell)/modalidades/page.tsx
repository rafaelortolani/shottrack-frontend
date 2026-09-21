"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconAdjustments, IconX } from "@tabler/icons-react";
import { Breadcrumb } from "@/components/Breadcrumb";

type Modality = { id: string; name: string };
type ResultType = { id: string; name: string };

export default function ModalidadesTabPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [practiced, setPracticed] = useState<Modality[]>([]);
  const [catalog, setCatalog] = useState<Modality[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [configModality, setConfigModality] = useState<Modality | null>(null);

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
    setFeedback(null);
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
      setFeedback(`${modality.name} removida`);
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
    setFeedback(`${modality.name} adicionada`);
  }

  if (loading) {
    return <p className="text-foreground-muted">Carregando modalidades...</p>;
  }

  return (
    <div>
      <Breadcrumb items={[{ href: "/usuario", label: "Usuário" }, { label: "Modalidades" }]} />
      <h1 className="font-display text-lg font-semibold mb-4">Modalidades</h1>

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

          if (!isPracticed) {
            return (
              <button
                key={modality.id}
                type="button"
                aria-pressed={false}
                disabled={pendingId === modality.id}
                onClick={() => handleToggle(modality, false)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border text-foreground-muted px-3 py-1.5 text-sm hover:text-foreground hover:border-accent-target disabled:opacity-60 transition-colors"
              >
                {modality.name}
              </button>
            );
          }

          return (
            <div
              key={modality.id}
              className="inline-flex items-center gap-1 rounded-full bg-accent-target text-foreground pl-3 pr-1.5 py-1.5 text-sm"
            >
              <button
                type="button"
                aria-pressed={true}
                disabled={pendingId === modality.id}
                onClick={() => handleToggle(modality, true)}
                className="inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                <span aria-hidden="true">✓</span>
                {modality.name}
              </button>
              <button
                type="button"
                aria-label={`Configurar tipos de resultado de ${modality.name}`}
                onClick={() => setConfigModality(modality)}
                className="p-1 rounded-full text-foreground/80 hover:text-foreground hover:bg-black/10 transition-colors"
              >
                <IconAdjustments size={15} stroke={1.75} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-1">
        {feedback && (
          <p className="text-sm text-accent-brass" role="status">
            {feedback}
          </p>
        )}
        <p className="text-sm text-foreground-muted">
          {practiced.length} modalidade{practiced.length === 1 ? "" : "s"} selecionada
          {practiced.length === 1 ? "" : "s"}
        </p>
      </div>

      {configModality && (
        <ResultTypePanel modality={configModality} onClose={() => setConfigModality(null)} />
      )}
    </div>
  );
}

function ResultTypePanel({ modality, onClose }: { modality: Modality; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<ResultType[]>([]);
  const [configured, setConfigured] = useState<ResultType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [catalogRes, configuredRes] = await Promise.all([
        fetch("/api/result-type-catalog"),
        fetch(`/api/practiced-modalities/${modality.id}/result-types`),
      ]);

      if (catalogRes.status === 401 || configuredRes.status === 401) {
        router.push("/login");
        return;
      }

      if (!catalogRes.ok || !configuredRes.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar os tipos de resultado");
          setLoading(false);
        }
        return;
      }

      const { data: catalogData } = await catalogRes.json();
      const { data: configuredData } = await configuredRes.json();

      if (!cancelled) {
        setCatalog(catalogData);
        setConfigured(configuredData);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [modality.id, router]);

  async function handleToggle(resultType: ResultType, isConfigured: boolean) {
    setError(null);
    setPendingId(resultType.id);

    if (isConfigured) {
      const response = await fetch(
        `/api/practiced-modalities/${modality.id}/result-types/${resultType.id}`,
        { method: "DELETE" }
      );
      setPendingId(null);

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        const { error } = await response.json();
        setError(error?.message ?? "Não foi possível remover o tipo de resultado");
        return;
      }

      setConfigured((prev) => prev.filter((t) => t.id !== resultType.id));
      return;
    }

    const response = await fetch(`/api/practiced-modalities/${modality.id}/result-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultTypeId: resultType.id }),
    });
    setPendingId(null);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível adicionar o tipo de resultado");
      return;
    }

    const { data } = await response.json();
    setConfigured((prev) => [...prev, data]);
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-background/80 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-type-panel-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-md bg-surface p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="result-type-panel-title" className="font-display text-base font-semibold">
            {modality.name} — tipos de resultado
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            <IconX size={18} stroke={1.75} />
          </button>
        </div>

        {error && (
          <p className="text-sm text-accent-target mb-3" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-foreground-muted text-sm">Carregando tipos de resultado...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {catalog.map((resultType) => {
              const isConfigured = configured.some((t) => t.id === resultType.id);
              return (
                <button
                  key={resultType.id}
                  type="button"
                  aria-pressed={isConfigured}
                  disabled={pendingId === resultType.id}
                  onClick={() => handleToggle(resultType, isConfigured)}
                  className={
                    isConfigured
                      ? "inline-flex items-center gap-1.5 rounded-full bg-accent-target text-foreground px-3 py-1.5 text-sm disabled:opacity-60 transition-colors"
                      : "inline-flex items-center gap-1.5 rounded-full border border-border text-foreground-muted px-3 py-1.5 text-sm hover:text-foreground hover:border-accent-target disabled:opacity-60 transition-colors"
                  }
                >
                  {isConfigured && <span aria-hidden="true">✓</span>}
                  {resultType.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
