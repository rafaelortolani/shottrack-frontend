import Link from "next/link";
import { LogoWordmark } from "@/components/LogoWordmark";
import { TargetRings } from "@/components/TargetRings";
import { readLegalDocument, renderLegalMarkdown, type LegalDocument } from "@/lib/legalMarkdown";

/** Página pública (fora do proxy de login) com o texto de `docs/legal/`. */
export async function LegalPage({ document }: { document: LegalDocument }) {
  const content = renderLegalMarkdown(await readLegalDocument(document));

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <TargetRings className="absolute -right-24 -top-24 w-[500px] h-[500px] text-accent-target pointer-events-none" />

      <div className="relative w-full max-w-2xl mx-auto px-6 py-10">
        <p className="text-lg mb-6">
          <Link href="/login" aria-label="ShotTrack — voltar ao login">
            <LogoWordmark />
          </Link>
        </p>

        <article>{content}</article>

        <p className="text-sm mt-8 pt-4 border-t border-border">
          <Link href="/login" className="text-accent-brass hover:text-accent-brass-soft transition-colors">
            Voltar ao login
          </Link>
        </p>
      </div>
    </main>
  );
}
