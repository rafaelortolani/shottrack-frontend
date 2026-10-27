import Link from "next/link";

/** Rodapé das telas de autenticação: Termos de Uso e Política de Privacidade (FUC21). */
export function LegalLinks() {
  return (
    <p className="text-xs text-foreground-muted mt-6 text-center">
      <Link href="/termos" className="hover:text-foreground transition-colors">
        Termos
      </Link>
      {" · "}
      <Link href="/privacidade" className="hover:text-foreground transition-colors">
        Privacidade
      </Link>
    </p>
  );
}
