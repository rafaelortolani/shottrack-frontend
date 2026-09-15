"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TargetRings } from "@/components/TargetRings";

type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: "BEGINNER", label: "Iniciante" },
  { value: "INTERMEDIATE", label: "Intermediário" },
  { value: "ADVANCED", label: "Avançado" },
];

type FieldErrors = Partial<Record<"name", string>>;

export default function PerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("BEGINNER");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const response = await fetch("/api/users/me");

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        if (!cancelled) {
          setFormError("Não foi possível carregar o perfil");
          setLoading(false);
        }
        return;
      }

      const { data } = await response.json();
      if (!cancelled) {
        setEmail(data.email);
        setName(data.name);
        setExperienceLevel(data.experienceLevel);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando perfil...</p>
      </div>
    );
  }

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
          <a className="block rounded-md px-3 py-2 text-foreground-muted hover:text-foreground hover:bg-surface transition-colors" href="#">
            <span className="hidden md:inline">Treinos</span>
            <span className="md:hidden">○</span>
          </a>
          <a className="block rounded-md px-3 py-2 text-foreground-muted hover:text-foreground hover:bg-surface transition-colors" href="#">
            <span className="hidden md:inline">Acervo</span>
            <span className="md:hidden">○</span>
          </a>
          <Link className="block rounded-md px-3 py-2 bg-surface text-foreground" href="/perfil">
            <span className="hidden md:inline">Perfil</span>
            <span className="md:hidden">●</span>
          </Link>
        </nav>
      </aside>

      <main className="flex-1 relative overflow-hidden">
        <TargetRings className="absolute -right-32 -top-32 w-[420px] h-[420px] text-accent-brass pointer-events-none" />

        <div className="relative max-w-lg px-6 md:px-10 py-10">
          <h1 className="font-display text-2xl font-semibold mb-10">Perfil</h1>

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
                <p className="text-sm text-foreground-muted">Email</p>
                <p className="text-foreground">{email}</p>
              </div>
              <Link
                href="/perfil/email"
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
              <span
                className="text-sm text-foreground-muted/60 cursor-not-allowed"
                title="Em breve"
              >
                Alterar
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
