"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CancelButton } from "@/components/CancelButton";
import { TargetRings } from "@/components/TargetRings";

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

export default function NovoAcessorioPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Nome não pode ficar vazio");
      return;
    }

    setError(null);
    setSaving(true);

    const response = await fetch("/api/accessories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type: type.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    });

    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível cadastrar o acessório");
      return;
    }

    router.push("/acervo/acessorios");
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pb-20 md:pb-0">
      <div className="relative w-full max-w-sm px-6">
        <TargetRings className="absolute -top-14 -right-14 z-0 w-[380px] h-[380px] text-accent-target-soft pointer-events-none" />

        <div className="relative z-10">
          <Breadcrumb
            items={[
              { href: "/acervo", label: "Acervo" },
              { href: "/acervo/acessorios", label: "Acessórios" },
              { label: "Cadastrar acessório" },
            ]}
          />

          <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
            Cadastrar acessório
          </h1>
          <p className="text-foreground-muted mb-6">Só o nome é obrigatório.</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm text-foreground-muted mb-1">
                Nome
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Coldre"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm text-foreground-muted mb-1">
                Tipo <span className="text-foreground-muted/60">· opcional</span>
              </label>
              <input
                id="type"
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Ex: Coldre, Mira, Carregador..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm text-foreground-muted mb-1">
                Observações <span className="text-foreground-muted/60">· opcional</span>
              </label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={INPUT_CLASS}
              />
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
                className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2 px-5 transition-colors"
              >
                {saving ? "Cadastrando..." : "Cadastrar"}
              </button>
              <CancelButton href="/acervo/acessorios" />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
