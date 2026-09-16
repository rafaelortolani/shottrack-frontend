"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-5 border-b border-border mb-5">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`pb-2 text-sm border-b-2 -mb-px transition-colors ${
              active
                ? "border-accent-target text-foreground"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
