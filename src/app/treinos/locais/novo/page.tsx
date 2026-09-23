"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CancelButton } from "@/components/CancelButton";
import { PageContainer } from "@/components/PageContainer";
import { BRAZILIAN_STATES } from "@/lib/brazilianStates";

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

type FieldErrors = Partial<Record<"name" | "city" | "state", string>>;

function validate(name: string, city: string, state: string): FieldErrors {
  const errors: FieldErrors = {};

  if (name.trim() === "") {
    errors.name = "Nome não pode ficar vazio";
  }
  if (city.trim() === "") {
    errors.city = "Cidade não pode ficar vazia";
  }
  if (state === "") {
    errors.state = "Selecione um estado";
  }

  return errors;
}

export default function NovoLocalTreinoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validate(name, city, state);
    setFieldErrors(errors);
    setError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);

    const response = await fetch("/api/training-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), city: city.trim(), state }),
    });

    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível cadastrar o local de treino");
      return;
    }

    router.push("/treinos/locais");
  }

  return (
    <PageContainer width="form" ringsClassName="text-accent-target-soft">
      <Breadcrumb
        items={[
          { href: "/treinos", label: "Treinos" },
          { href: "/treinos/locais", label: "Locais" },
          { label: "Cadastrar local" },
        ]}
      />

      <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
        Cadastrar local
      </h1>
      <p className="text-foreground-muted mb-6">Informe nome, cidade e estado.</p>

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
            placeholder="Ex: Clube de Tiro Alvorada"
            className={INPUT_CLASS}
          />
          {fieldErrors.name && (
            <p className="text-sm text-accent-target mt-1" role="alert">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="city" className="block text-sm text-foreground-muted mb-1">
            Cidade
          </label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex: Curitiba"
            className={INPUT_CLASS}
          />
          {fieldErrors.city && (
            <p className="text-sm text-accent-target mt-1" role="alert">
              {fieldErrors.city}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="state" className="block text-sm text-foreground-muted mb-1">
            Estado
          </label>
          <select
            id="state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="" disabled>Selecione</option>
            {BRAZILIAN_STATES.map((s) => (
              <option key={s.uf} value={s.uf}>{s.name}</option>
            ))}
          </select>
          {fieldErrors.state && (
            <p className="text-sm text-accent-target mt-1" role="alert">
              {fieldErrors.state}
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
            className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2 px-5 transition-colors"
          >
            {saving ? "Cadastrando..." : "Cadastrar"}
          </button>
          <CancelButton href="/treinos/locais" />
        </div>
      </form>
    </PageContainer>
  );
}
