"use client";

import { useState } from "react";
import { IconDeviceMobile, IconX } from "@tabler/icons-react";
import { usePwa } from "@/components/PwaProvider";

const DISMISS_KEY = "shottrack_install_dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Convite pra instalar o app (FUC22). Android/Chrome: botão com o prompt
 * nativo; iPhone: instruções do Compartilhar. Some quando já instalado, e
 * quando não há como instalar (nem prompt nem iOS).
 *  - "card": Boas-vindas, dispensável (a dispensa fica em localStorage)
 *  - "section": Usuário > Perfil, sempre visível enquanto instalável
 */
export function InstallApp({ variant }: { variant: "card" | "section" }) {
  const { standalone, ios, canInstall, promptInstall } = usePwa();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (standalone || (!canInstall && !ios)) return null;
  if (variant === "card" && dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sem storage a dispensa só vale nesta visita
    }
  }

  const action = canInstall ? (
    <button
      type="button"
      onClick={promptInstall}
      className="min-h-11 rounded-md bg-accent-target hover:bg-accent-target-hover text-background text-sm font-medium py-2 px-4 transition-colors"
    >
      Instalar app
    </button>
  ) : (
    <p className="text-sm text-foreground-muted">
      Toque em <strong className="text-foreground font-semibold">Compartilhar</strong> e depois em{" "}
      <strong className="text-foreground font-semibold">Adicionar à Tela de Início</strong>.
    </p>
  );

  if (variant === "section") {
    return (
      <section aria-labelledby="aplicativo" className="space-y-2 pt-4 border-t border-border">
        <h2 id="aplicativo" className="text-xs uppercase tracking-wide text-foreground-muted">
          Aplicativo
        </h2>
        <p className="text-sm text-foreground-muted">Instale o ShotTrack no celular: tela cheia e acesso direto.</p>
        {action}
      </section>
    );
  }

  return (
    <section aria-labelledby="instalar-app" className="relative rounded-md bg-surface p-4 pr-12 border-l-2 border-accent-target">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar convite de instalação"
        className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
      >
        <IconX size={18} stroke={1.75} />
      </button>
      <h2 id="instalar-app" className="flex items-center gap-2 font-display text-base font-semibold mb-1">
        <IconDeviceMobile size={18} stroke={1.75} className="text-accent-target-soft" />
        Instale o ShotTrack
      </h2>
      <p className="text-sm text-foreground-muted mb-2">Abra em tela cheia, direto da tela inicial do celular.</p>
      {action}
    </section>
  );
}
