"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { TargetRings } from "@/components/TargetRings";

type FieldErrors = Partial<Record<"currentPassword" | "newPassword", string>>;

export default function AlterarSenhaPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 8) {
      setFieldErrors({ newPassword: "Senha precisa ter no mínimo 8 caracteres" });
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSaving(true);

    const response = await fetch("/api/users/me/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setSaving(false);

    if (!response.ok) {
      const { error } = await response.json();

      // INVALID_CURRENT_PASSWORD também vem com status 401 (o backend trata
      // como uma reautenticação que falhou) — checa o código do erro antes
      // de assumir que é sessão expirada.
      if (error?.code === "INVALID_CURRENT_PASSWORD") {
        setFieldErrors({ currentPassword: "Senha atual incorreta" });
        return;
      }

      if (error?.code === "PASSWORD_UNCHANGED") {
        setFieldErrors({ newPassword: "A nova senha precisa ser diferente da atual" });
        return;
      }

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      setFormError(error?.message ?? "Não foi possível alterar a senha");
      return;
    }

    router.push("/usuario/perfil?senha=alterada");
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pb-20 md:pb-0">
      <TargetRings className="absolute -right-24 -top-24 w-[500px] h-[500px] text-accent-target pointer-events-none" />

      <div className="relative w-full max-w-sm px-6">
        <Breadcrumb items={[{ href: "/usuario", label: "Usuário" }, { href: "/usuario/perfil", label: "Perfil" }, { label: "Alterar senha" }]} />
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Alterar senha
        </h1>
        <p className="text-foreground-muted mb-10">Confirme sua senha atual pra definir uma nova.</p>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="currentPassword" className="block text-sm text-foreground-muted mb-1.5">
              Senha atual
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md bg-surface border border-border px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
            />
            {fieldErrors.currentPassword && (
              <p className="text-sm text-accent-target mt-1.5" role="alert">
                {fieldErrors.currentPassword}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm text-foreground-muted mb-1.5">
              Nova senha
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md bg-surface border border-border px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
            />
            {fieldErrors.newPassword && (
              <p className="text-sm text-accent-target mt-1.5" role="alert">
                {fieldErrors.newPassword}
              </p>
            )}
          </div>

          {formError && (
            <p className="text-sm text-accent-target" role="alert">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2.5 px-6 transition-colors"
            >
              {saving ? "Alterando..." : "Alterar senha"}
            </button>
            <Link href="/usuario/perfil" className="text-sm text-foreground-muted hover:text-foreground transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
