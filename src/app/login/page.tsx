"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TargetRings } from "@/components/TargetRings";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("cadastro") === "sucesso";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Email ou senha incorretos.");
      return;
    }

    const { landing } = await response.json();
    router.push(landing ?? "/dashboard");
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
      <div className="relative w-full max-w-sm px-6">
        <TargetRings className="absolute -top-14 -right-14 z-0 w-[380px] h-[380px] text-accent-target-soft pointer-events-none" />

        <div className="relative z-10">
          <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
            ShotTrack
          </h1>
          <p className="text-foreground-muted mb-6">Treine. Registre. Evolua.</p>

          {registered && (
            <p className="text-sm text-accent-brass mb-3" role="status">
              Conta criada com sucesso. Entre com suas credenciais.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm text-foreground-muted mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
                placeholder="voce@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-foreground-muted mb-1">
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-accent-target" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2 transition-colors"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-sm text-foreground-muted mt-4 text-center">
            Não tem conta?{" "}
            <Link href="/cadastro" className="text-foreground hover:text-accent-target transition-colors">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
