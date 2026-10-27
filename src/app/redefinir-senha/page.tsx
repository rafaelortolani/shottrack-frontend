"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogoWordmark } from "@/components/LogoWordmark";
import { TargetRings } from "@/components/TargetRings";

type FieldErrors = Partial<Record<"password" | "confirmation", string>>;
type TokenState = "form" | "invalid" | "expired" | "used";

const TOKEN_ERRORS: Record<string, TokenState> = {
  PASSWORD_RESET_TOKEN_INVALID: "invalid",
  PASSWORD_RESET_TOKEN_EXPIRED: "expired",
  PASSWORD_RESET_TOKEN_ALREADY_USED: "used",
};

const TOKEN_MESSAGES: Record<Exclude<TokenState, "form">, string> = {
  invalid: "Esse link de redefinição é inválido.",
  expired: "Esse link expirou.",
  used: "Esse link já foi utilizado.",
};

function validate(password: string, confirmation: string): FieldErrors {
  const errors: FieldErrors = {};

  if (password.length < 8) {
    errors.password = "Senha precisa ter no mínimo 8 caracteres";
  }
  if (confirmation !== password) {
    errors.confirmation = "As senhas não são iguais";
  }

  return errors;
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense>
      <RedefinirSenhaForm />
    </Suspense>
  );
}

function RedefinirSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [tokenState, setTokenState] = useState<TokenState>(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validate(password, confirmation);
    setFieldErrors(errors);
    setFormError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);

    const response = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });

    setLoading(false);

    if (!response.ok) {
      const { error } = await response.json();
      const mapped = TOKEN_ERRORS[error?.code];

      if (mapped) {
        setTokenState(mapped);
      } else {
        setFormError(error?.message ?? "Não foi possível redefinir a senha");
      }
      return;
    }

    router.push("/login?senha=redefinida");
  }

  if (tokenState !== "form") {
    return (
      <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
        <div className="text-center">
          <p className="text-foreground-muted mb-4" role="alert">
            {TOKEN_MESSAGES[tokenState]}
          </p>
          <Link href="/esqueci-senha" className="text-sm text-accent-brass hover:text-accent-brass-soft transition-colors">
            Pedir um novo link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
      <TargetRings className="absolute -right-24 -top-24 w-[500px] h-[500px] text-accent-target pointer-events-none" />

      <div className="relative w-full max-w-sm px-6">
        <h1 className="text-lg mb-1">
          <LogoWordmark />
        </h1>
        <p className="text-foreground-muted mb-6">Escolha uma nova senha.</p>

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <label htmlFor="password" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
              Nova senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
            />
            {fieldErrors.password && (
              <p className="text-sm text-accent-target mt-1" role="alert">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmation" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
              Confirmar nova senha
            </label>
            <input
              id="confirmation"
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
            />
            {fieldErrors.confirmation && (
              <p className="text-sm text-accent-target mt-1" role="alert">
                {fieldErrors.confirmation}
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
            className="w-full rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-background font-medium py-2 transition-colors"
          >
            {loading ? "Redefinindo..." : "Redefinir senha"}
          </button>
        </form>
      </div>
    </main>
  );
}
