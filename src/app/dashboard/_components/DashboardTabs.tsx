"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { DASHBOARD_TABS, type DashboardTabId } from "@/lib/dashboard";

/**
 * Barra de abas do dashboard. Cada aba é um link (a aba ativa vive na URL, em
 * `?aba=`); no celular a barra rola na horizontal e a ativa fica à vista.
 */
export function DashboardTabs({
  active,
  hrefFor,
  attention = [],
}: {
  active: DashboardTabId;
  /** Abas com selo (algo pede atenção do atleta). */
  attention?: DashboardTabId[];
  hrefFor: (overrides: Record<string, string | null>) => string;
}) {
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  return (
    <nav
      aria-label="Seções do dashboard"
      className="-mx-5 md:-mx-6 px-5 md:px-6 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-1">
        {DASHBOARD_TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                ref={isActive ? activeRef : undefined}
                href={hrefFor({ aba: tab.id })}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center min-h-11 px-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-accent-target text-foreground"
                    : "border-transparent text-foreground-muted hover:text-foreground"
                }`}
              >
                {tab.label}
                {attention.includes(tab.id) && (
                  <>
                    <span aria-hidden="true" className="ml-1.5 h-2 w-2 rounded-full bg-accent-brass" />
                    <span className="sr-only"> (requer atenção)</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
