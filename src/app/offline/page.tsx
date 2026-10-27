import type { Metadata } from "next";
import { LogoWordmark } from "@/components/LogoWordmark";
import { RetryButton } from "@/components/RetryButton";
import { TargetRings } from "@/components/TargetRings";

export const metadata: Metadata = { title: "Sem conexão — ShotTrack" };

/**
 * Fallback do service worker (FUC22): pública e estática. É a única página
 * pré-cacheada — nada de dados do atleta fica no aparelho.
 */
export default function OfflinePage() {
  return (
    <main className="relative min-h-dvh flex items-center justify-center overflow-hidden bg-background text-foreground px-6">
      <TargetRings className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(120vw,560px)] h-[min(120vw,560px)] text-accent-target pointer-events-none" />

      <div className="relative w-full max-w-sm text-center">
        <p className="text-lg mb-6">
          <LogoWordmark />
        </p>
        <h1 className="font-display text-lg font-semibold mb-1">Sem conexão</h1>
        <p className="text-foreground-muted mb-6">
          Não foi possível carregar o ShotTrack. Confira sua internet e tente de novo.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
