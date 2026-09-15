"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconTarget,
  IconBriefcase,
  IconUser,
  type TablerIcon,
} from "@tabler/icons-react";

type NavItem = {
  href: string;
  label: string;
  icon: TablerIcon;
  color: string;
  enabled: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard, color: "text-accent-target-soft", enabled: true },
  { href: "/treinos", label: "Treinos", icon: IconTarget, color: "text-accent-brass-soft", enabled: false },
  { href: "/acervo", label: "Acervo", icon: IconBriefcase, color: "text-accent-sage-soft", enabled: false },
  { href: "/usuario", label: "Usuário", icon: IconUser, color: "text-foreground-muted", enabled: true },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Nav principal do app — mesmos itens/ícones/cores no desktop (sidebar
 * lateral) e no mobile (barra inferior fixa); só a posição/layout muda
 * (regra de consistência mobile/desktop da skill convencoes-frontend).
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden md:flex w-56 border-r border-border flex-col py-6 px-5 shrink-0">
        <span className="font-display font-semibold text-lg mb-10">ShotTrack</span>
        <nav className="space-y-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <DesktopNavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
      </aside>

      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-background items-center justify-around py-2">
        {NAV_ITEMS.map((item) => (
          <MobileNavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
    </>
  );
}

function DesktopNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  if (!item.enabled) {
    return (
      <span
        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-foreground-muted/60 cursor-not-allowed"
        title="Em breve"
      >
        <Icon size={18} stroke={1.75} className={item.color} />
        {item.label}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors ${
        active ? "bg-surface text-foreground" : "text-foreground-muted hover:text-foreground hover:bg-surface"
      }`}
    >
      <Icon size={18} stroke={1.75} className={item.color} />
      {item.label}
    </Link>
  );
}

function MobileNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  if (!item.enabled) {
    return (
      <span
        className="flex flex-col items-center gap-1 px-3 py-1 text-foreground-muted/60"
        title="Em breve"
      >
        <Icon size={20} stroke={1.75} className={item.color} />
        <span className="text-[10px]">{item.label}</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center gap-1 px-3 py-1 rounded-md transition-colors ${
        active ? "text-foreground" : "text-foreground-muted hover:text-foreground"
      }`}
    >
      <Icon size={20} stroke={1.75} className={item.color} />
      <span className="text-[10px]">{item.label}</span>
    </Link>
  );
}
