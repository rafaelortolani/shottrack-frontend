"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLogout } from "@tabler/icons-react";

/**
 * Cabeçalho de topo das telas autenticadas — só o "Sair", alinhado à
 * direita. Fica de fora do AppNav porque é uma ação da página, não um
 * destino de navegação.
 */
export function AppHeader() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex justify-end mb-6">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-accent-target disabled:opacity-60 transition-colors"
      >
        <IconLogout size={16} stroke={1.75} />
        {loggingOut ? "Saindo..." : "Sair"}
      </button>
    </div>
  );
}
