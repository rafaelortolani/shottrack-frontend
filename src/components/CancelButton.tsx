import Link from "next/link";

export function CancelButton({ href, children = "Cancelar" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border px-5 py-2 text-sm font-medium text-foreground-muted hover:text-foreground hover:border-accent-target transition-colors"
    >
      {children}
    </Link>
  );
}
