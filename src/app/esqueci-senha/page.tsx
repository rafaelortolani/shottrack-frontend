"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoWordmark } from "@/components/LogoWordmark";
import { TargetRings } from "@/components/TargetRings";
import { tooManyRequestsMessage } from "@/lib/rateLimit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!EMAIL_PATTERN.test(email)) {
      setEmailError("Email precisa ter um formato válido");
      return;
    }

    setEmailError(null);
    setLoading(true);

    const response = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (response.status === 429) {
      setEmailError(tooManyRequestsMessage(response.headers.get("Retry-After")));
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setEmailError(error?.message ?? "Não foi possível enviar o link");
      return;
    }

    // Sempre a mesma mensagem, exista a conta ou não — não revela quem está cadastrado.
    setSent(true);
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
      <TargetRings className="absolute -right-24 -top-24 w-[500px] h-[500px] text-accent-target pointer-events-none" />

      <div className="relative w-full max-w-sm px-6">
        <h1 className="text-lg mb-1">
          <LogoWordmark />
        </h1>
        <p className="text-foreground-muted mb-6">Esqueci minha senha</p>

        {sent ? (
          <p className="text-sm text-accent-brass mb-4" role="status">
            Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
                placeholder="voce@email.com"
              />
              {emailError && (
                <p className="text-sm text-accent-target mt-1" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-background font-medium py-2 transition-colors"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </button>
          </form>
        )}

        <p className="text-sm text-center mt-4">
          <Link href="/login" className="text-accent-brass hover:text-accent-brass-soft transition-colors">
            Voltar ao login
          </Link>
        </p>
      </div>
    </main>
  );
}
