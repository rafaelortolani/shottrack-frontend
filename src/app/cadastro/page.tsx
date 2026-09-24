"use client";

import { useState } from "react";
import Link from "next/link";
import { TargetRings } from "@/components/TargetRings";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "request" | "sent";

async function requestRegistration(email: string) {
  return fetch("/api/users/registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export default function CadastroPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!EMAIL_PATTERN.test(email)) {
      setEmailError("Email precisa ter um formato válido");
      return;
    }

    setEmailError(null);
    setLoading(true);

    const response = await requestRegistration(email);

    setLoading(false);

    if (!response.ok) {
      const { error } = await response.json();
      if (error?.code === "EMAIL_ALREADY_REGISTERED") {
        setEmailError("Já existe uma conta com esse email");
      } else {
        setEmailError(error?.message ?? "Não foi possível solicitar o cadastro");
      }
      return;
    }

    setSentEmail(email);
    setStep("sent");
  }

  async function handleResend() {
    setResendMessage(null);
    setResending(true);
    const response = await requestRegistration(sentEmail);
    setResending(false);

    if (response.ok) {
      setResendMessage("Link reenviado");
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
      <TargetRings className="absolute -right-24 -top-24 w-[500px] h-[500px] text-accent-target pointer-events-none" />

      <div className="relative w-full max-w-sm px-6">
        <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
          ShotTrack
        </h1>

        {step === "request" ? (
          <>
            <p className="text-foreground-muted mb-6">Crie sua conta pra começar a treinar.</p>

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
                {loading ? "Enviando..." : "Continuar"}
              </button>
            </form>

            <p className="text-sm text-foreground-muted mt-4 text-center">
              Já tem conta?{" "}
              <Link href="/login" className="text-foreground hover:text-accent-target transition-colors">
                Entrar
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="text-foreground-muted mb-1">Verifique seu email</p>
            <p className="text-sm text-foreground-muted mb-6">
              Enviamos um link de confirmação pra <span className="text-foreground">{sentEmail}</span>.
              Ele expira em 24 horas.
            </p>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full rounded-md border border-border px-5 py-2 text-sm font-medium text-foreground-muted hover:text-foreground hover:border-accent-target disabled:opacity-60 transition-colors"
            >
              {resending ? "Reenviando..." : "Reenviar"}
            </button>

            {resendMessage && (
              <p className="text-sm text-accent-brass mt-3" role="status">
                {resendMessage}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
