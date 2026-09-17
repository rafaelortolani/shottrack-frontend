"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { CancelButton } from "@/components/CancelButton";
import { TargetRings } from "@/components/TargetRings";
import { BRAZILIAN_STATES } from "@/lib/brazilianStates";

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

type TrainingLocation = {
  id: string;
  name: string;
  city: string;
  state: string;
};

type FormValues = {
  name: string;
  city: string;
  state: string;
};

type FieldErrors = Partial<Record<"name" | "city" | "state", string>>;

function toFormValues(location: TrainingLocation): FormValues {
  return { name: location.name, city: location.city, state: location.state };
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (values.name.trim() === "") {
    errors.name = "Nome não pode ficar vazio";
  }
  if (values.city.trim() === "") {
    errors.city = "Cidade não pode ficar vazia";
  }
  if (values.state === "") {
    errors.state = "Selecione um estado";
  }

  return errors;
}

function buildDiff(initial: FormValues, current: FormValues): Record<string, unknown> {
  const diff: Record<string, unknown> = {};

  if (current.name !== initial.name) {
    diff.name = current.name;
  }
  if (current.city !== initial.city) {
    diff.city = current.city;
  }
  if (current.state !== initial.state) {
    diff.state = current.state;
  }

  return diff;
}

export default function EditarLocalTreinoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const locationId = params.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [initialValues, setInitialValues] = useState<FormValues | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const response = await fetch("/api/training-locations");

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar os dados");
          setLoading(false);
        }
        return;
      }

      const { data: locations } = await response.json();
      const location: TrainingLocation | undefined = locations.find((l: TrainingLocation) => l.id === locationId);

      if (!location) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        const formValues = toFormValues(location);
        setInitialValues(formValues);
        setValues(formValues);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [router, locationId]);

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values || !initialValues) return;

    const errors = validate(values);
    setFieldErrors(errors);
    setError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const diff = buildDiff(initialValues, values);

    if (Object.keys(diff).length === 0) {
      router.push("/treinos");
      return;
    }

    setSaving(true);

    const response = await fetch(`/api/training-locations/${locationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(diff),
    });

    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível salvar as alterações");
      return;
    }

    router.push("/treinos");
  }

  async function handleDelete() {
    setError(null);
    setDeleteBlocked(false);
    setDeleting(true);

    const response = await fetch(`/api/training-locations/${locationId}`, { method: "DELETE" });

    setDeleting(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      if (error?.code === "TRAINING_LOCATION_IN_USE") {
        setDeleteBlocked(true);
      } else {
        setError(error?.message ?? "Não foi possível excluir o local de treino");
      }
      return;
    }

    router.push("/treinos");
  }

  if (loading || !values) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando local de treino...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground-muted mb-4">Local de treino não encontrado.</p>
          <Link href="/treinos" className="text-sm text-accent-target hover:text-accent-target-hover transition-colors">
            Voltar pros treinos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pb-20 md:pb-0">
      <div className="relative w-full max-w-sm px-6">
        <TargetRings className="absolute -top-14 -right-14 z-0 w-[380px] h-[380px] text-accent-target-soft pointer-events-none" />

        <div className="relative z-10">
          <BackLink href="/treinos" label="Treinos" />

          <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
            Editar local
          </h1>
          <p className="text-foreground-muted mb-6">Só os campos alterados são salvos.</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm text-foreground-muted mb-1">
                Nome
              </label>
              <input
                id="name"
                type="text"
                value={values.name}
                onChange={(e) => updateField("name", e.target.value)}
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
                value={values.city}
                onChange={(e) => updateField("city", e.target.value)}
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
                value={values.state}
                onChange={(e) => updateField("state", e.target.value)}
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
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <CancelButton href="/treinos" />
            </div>
          </form>

          <div className="pt-4 mt-4 border-t border-border">
            {deleteBlocked && (
              <p className="text-sm text-accent-target mb-3" role="alert">
                Esse local já foi usado em algum treino e não pode ser excluído.
              </p>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-accent-target hover:text-accent-target-hover disabled:opacity-60 transition-colors"
            >
              {deleting ? "Excluindo..." : "Excluir local"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
