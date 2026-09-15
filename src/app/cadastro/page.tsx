"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TargetRings } from "@/components/TargetRings";

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(name: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};

  if (name.trim() === "") {
    errors.name = "Nome não pode ficar vazio";
  }
  if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Email precisa ter um formato válido";
  }
  if (password.length < 8) {
    errors.password = "Senha precisa ter no mínimo 8 caracteres";
  }

  return errors;
}

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validate(name, email, password);
    setFieldErrors(errors);
    setFormError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const { error } = await response.json();

      if (error?.code === "EMAIL_ALREADY_REGISTERED") {
        setFieldErrors({ email: "Já existe uma conta com esse email" });
      } else {
        setFormError(error?.message ?? "Não foi possível criar a conta");
      }
      return;
    }

    router.push("/login?cadastro=sucesso");
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
      <TargetRings className="absolute -right-24 -top-24 w-[500px] h-[500px] text-accent-target pointer-events-none" />

      <div className="relative w-full max-w-sm px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          ShotTrack
        </h1>
        <p className="text-foreground-muted mb-10">Crie sua conta pra começar a treinar.</p>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm text-foreground-muted mb-1.5">
              Nome
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md bg-surface border border-border px-3.5 py-2.5 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
              placeholder="Seu nome"
            />
            {fieldErrors.name && (
              <p className="text-sm text-accent-target mt-1.5" role="alert">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-foreground-muted mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md bg-surface border border-border px-3.5 py-2.5 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
              placeholder="voce@email.com"
            />
            {fieldErrors.email && (
              <p className="text-sm text-accent-target mt-1.5" role="alert">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-foreground-muted mb-1.5">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md bg-surface border border-border px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
            />
            {fieldErrors.password && (
              <p className="text-sm text-accent-target mt-1.5" role="alert">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {formError && (
            <p className="text-sm text-accent-target" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2.5 transition-colors"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="text-sm text-foreground-muted mt-6 text-center">
          Já tem conta?{" "}
          <Link href="/login" className="text-foreground hover:text-accent-target transition-colors">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
