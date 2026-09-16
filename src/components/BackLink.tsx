import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

export function BackLink({ href, label = "Acervo" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors mb-3"
    >
      <IconArrowLeft size={16} stroke={1.75} />
      {label}
    </Link>
  );
}
