"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TargetRings } from "@/components/TargetRings";

type FieldErrors = Partial<Record<"name" | "password", string>>;
type TokenState = "form" | "invalid" | "expired" | "used";

function validate(name: string, password: string): FieldErrors {
  const errors: FieldErrors = {};

  if (name.trim() === "") {
    errors.name = "Nome não pode ficar vazio";
  }
  if (password.length < 8) {
    errors.password = "Senha precisa ter no mínimo 8 caracteres";
  }

  return errors;
}

export default function CompletarCadastroPage() {
  return (
    <Suspense>
      <CompletarCadastroForm />
    </Suspense>
  );
}

function CompletarCadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [tokenState, setTokenState] = useState<TokenState>(token ? "form" : "invalid");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validate(name, password);
    setFieldErrors(errors);
    setFormError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);

    const response = await fetch("/api/users/registration/completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const { error } = await response.json();

      if (error?.code === "REGISTRATION_TOKEN_INVALID") {
        setTokenState("invalid");
      } else if (error?.code === "REGISTRATION_TOKEN_EXPIRED") {
        setTokenState("expired");
      } else if (error?.code === "REGISTRATION_TOKEN_ALREADY_USED") {
        setTokenState("used");
      } else {
        setFormError(error?.message ?? "Não foi possível concluir o cadastro");
      }
      return;
    }

    router.push("/login?cadastro=sucesso");
  }

  if (tokenState !== "form") {
    const content = {
      invalid: {
        message: "Esse link de cadastro é inválido.",
        href: "/cadastro",
        label: "Solicitar novo cadastro",
      },
      expired: {
        message: "Esse link expirou.",
        href: "/cadastro",
        label: "Solicitar novo cadastro",
      },
      used: {
        message: "Esse cadastro já foi concluído.",
        href: "/login",
        label: "Ir para o login",
      },
    }[tokenState];

    return (
      <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
        <div className="text-center">
          <p className="text-foreground-muted mb-4">{content.message}</p>
          <Link href={content.href} className="text-sm text-accent-target hover:text-accent-target-hover transition-colors">
            {content.label}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
      <TargetRings className="absolute -right-24 -top-24 w-[500px] h-[500px] text-accent-target pointer-events-none" />

      <div className="relative w-full max-w-sm px-6">
        <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
          Completar cadastro
        </h1>
        <p className="text-foreground-muted mb-6">Informe seu nome e escolha uma senha.</p>

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
              className="w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
              placeholder="Seu nome"
            />
            {fieldErrors.name && (
              <p className="text-sm text-accent-target mt-1" role="alert">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-foreground-muted mb-1">
              Senha
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

          {formError && (
            <p className="text-sm text-accent-target" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2 transition-colors"
          >
            {loading ? "Concluindo..." : "Concluir cadastro"}
          </button>
        </form>
      </div>
    </main>
  );
}
