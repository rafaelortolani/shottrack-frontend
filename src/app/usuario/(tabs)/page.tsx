"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
type Modality = { id: string; name: string };

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: "BEGINNER", label: "Iniciante" },
  { value: "INTERMEDIATE", label: "Intermediário" },
  { value: "ADVANCED", label: "Avançado" },
];

type FieldErrors = Partial<Record<"name", string>>;

function formatModalitiesSummary(modalities: Modality[]): string {
  if (modalities.length === 0) {
    return "Nenhuma modalidade selecionada";
  }

  const [first, second, ...rest] = modalities;
  if (!second) {
    return first.name;
  }

  const shown = `${first.name}, ${second.name}`;
  return rest.length > 0 ? `${shown} +${rest.length}` : shown;
}

export default function PerfilTabPage() {
  return (
    <Suspense>
      <PerfilTabForm />
    </Suspense>
  );
}

function PerfilTabForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("BEGINNER");
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    searchParams.get("senha") === "alterada" ? "Senha alterada com sucesso" : null
  );
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const [profileRes, modalitiesRes] = await Promise.all([
        fetch("/api/users/me"),
        fetch("/api/practiced-modalities"),
      ]);

      if (profileRes.status === 401 || modalitiesRes.status === 401) {
        router.push("/login");
        return;
      }

      if (!profileRes.ok) {
        if (!cancelled) {
          setFormError("Não foi possível carregar o perfil");
          setLoading(false);
        }
        return;
      }

      const { data } = await profileRes.json();
      const modalitiesData = modalitiesRes.ok ? (await modalitiesRes.json()).data : [];

      if (!cancelled) {
        setEmail(data.email);
        setName(data.name);
        setExperienceLevel(data.experienceLevel);
        setModalities(modalitiesData);
        setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (name.trim() === "") {
      setFieldErrors({ name: "Nome não pode ficar vazio" });
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);
    setSaving(true);

    const response = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, experienceLevel }),
    });

    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      if (error?.field === "name") {
        setFieldErrors({ name: error.message });
      } else {
        setFormError(error?.message ?? "Não foi possível atualizar o perfil");
      }
      return;
    }

    setSuccessMessage("Perfil atualizado");
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return <p className="text-foreground-muted">Carregando perfil...</p>;
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-5 mb-10">
        <div>
          <label htmlFor="name" className="block text-sm text-foreground-muted mb-1.5">
            Nome
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md bg-surface border border-border px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
          />
          {fieldErrors.name && (
            <p className="text-sm text-accent-target mt-1.5" role="alert">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="experienceLevel" className="block text-sm text-foreground-muted mb-1.5">
            Nível de experiência
          </label>
          <select
            id="experienceLevel"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
            className="w-full rounded-md bg-surface border border-border px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
          >
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>

        {formError && (
          <p className="text-sm text-accent-target" role="alert">
            {formError}
          </p>
        )}

        {successMessage && (
          <p className="text-sm text-accent-brass" role="status">
            {successMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2.5 px-6 transition-colors"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>

      <div className="space-y-4 pt-6 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground-muted">Modalidades</p>
            <p className="text-foreground">{formatModalitiesSummary(modalities)}</p>
          </div>
          <Link
            href="/usuario/modalidades"
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            Editar
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground-muted">Email</p>
            <p className="text-foreground">{email}</p>
          </div>
          <Link
            href="/usuario/email"
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            Alterar
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground-muted">Senha</p>
            <p className="text-foreground">••••••••</p>
          </div>
          <Link
            href="/usuario/senha"
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            Alterar
          </Link>
        </div>
      </div>

      <div className="pt-6 mt-6 border-t border-border">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-sm text-foreground-muted hover:text-accent-target disabled:opacity-60 transition-colors"
        >
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </>
  );
}
