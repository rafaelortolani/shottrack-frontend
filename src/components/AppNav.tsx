"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconLayoutDashboard,
  IconTarget,
  IconBriefcase,
  IconUser,
  IconLogout,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconChevronDown,
  IconFocus2,
  IconCapsuleHorizontal,
  IconBackpack,
  IconIdBadge2,
  IconCategory2,
  type TablerIcon,
} from "@tabler/icons-react";

const NAV_COLLAPSED_KEY = "shottrack:nav-collapsed";

type NavChild = { href: string; label: string; icon: TablerIcon; color: string };

type NavItem = {
  href: string;
  label: string;
  icon: TablerIcon;
  color: string;
  enabled: boolean;
  children?: NavChild[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard, color: "text-accent-target-soft", enabled: true },
  { href: "/treinos", label: "Treinos", icon: IconTarget, color: "text-accent-brass-soft", enabled: true },
  {
    href: "/acervo",
    label: "Acervo",
    icon: IconBriefcase,
    color: "text-accent-sage-soft",
    enabled: true,
    children: [
      { href: "/acervo/armas", label: "Armas", icon: IconFocus2, color: "text-accent-target-soft" },
      { href: "/acervo/municoes", label: "Munições", icon: IconCapsuleHorizontal, color: "text-accent-brass-soft" },
      { href: "/acervo/acessorios", label: "Acessórios", icon: IconBackpack, color: "text-accent-sage-soft" },
    ],
  },
  {
    href: "/usuario",
    label: "Usuário",
    icon: IconUser,
    color: "text-foreground-muted",
    enabled: true,
    children: [
      { href: "/usuario/perfil", label: "Perfil", icon: IconIdBadge2, color: "text-foreground-muted" },
      { href: "/usuario/modalidades", label: "Modalidades", icon: IconCategory2, color: "text-foreground-muted" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Nav principal do app — mesmos itens/ícones/cores no desktop (sidebar
 * lateral) e no mobile (barra inferior fixa); só a posição/layout muda
 * (regra de consistência mobile/desktop da skill convencoes-frontend).
 * Submenu (Acervo, Usuário) só existe na sidebar — a barra inferior não
 * tem espaço pra isso, então no mobile a troca entre sub-telas continua
 * pelas abas já existentes dentro de cada tela.
 */
export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [manualGroups, setManualGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Só dá pra ler localStorage depois de montar (SSR não tem window) —
    // por isso lê aqui em vez de inicializar o useState direto, senão o
    // HTML do servidor (sempre expandido) diverge do primeiro render do
    // cliente e o React acusa mismatch de hidratação.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(NAV_COLLAPSED_KEY) === "1");
    } catch {
      // modo privado ou storage bloqueado — mantém expandido
    }
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // preferência só não persiste entre sessões
    }
  }

  function toggleGroup(href: string, expanded: boolean) {
    setManualGroups((prev) => ({ ...prev, [href]: expanded }));
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      <aside
        className={`hidden md:flex flex-col py-6 shrink-0 border-r border-border transition-[width] duration-150 ${
          collapsed ? "w-16 px-3" : "w-56 px-5"
        }`}
      >
        <div className={`flex items-center mb-10 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && <span className="font-display font-semibold text-lg">ShotTrack</span>}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="text-foreground-muted hover:text-foreground transition-colors shrink-0"
          >
            {collapsed ? (
              <IconLayoutSidebarLeftExpand size={20} stroke={1.75} />
            ) : (
              <IconLayoutSidebarLeftCollapse size={20} stroke={1.75} />
            )}
          </button>
        </div>

        <nav className="space-y-1 text-sm">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const expanded = manualGroups[item.href] ?? active;
            return (
              <DesktopNavLink
                key={item.href}
                item={item}
                pathname={pathname}
                active={active}
                collapsed={collapsed}
                expanded={expanded}
                onToggle={(next) => toggleGroup(item.href, next)}
              />
            );
          })}
        </nav>
        <div className="mt-auto pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sair"
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 w-full text-sm text-foreground-muted hover:text-accent-target disabled:opacity-60 transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <IconLogout size={18} stroke={1.75} />
            {!collapsed && (loggingOut ? "Saindo..." : "Sair")}
          </button>
        </div>
      </aside>

      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-background items-center py-2">
        <div className="flex flex-1 items-center justify-around">
          {NAV_ITEMS.map((item) => (
            <MobileNavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex flex-col items-center gap-1 px-4 py-1 border-l border-border text-foreground-muted hover:text-accent-target disabled:opacity-60 transition-colors"
        >
          <IconLogout size={20} stroke={1.75} />
          <span className="text-[10px]">{loggingOut ? "Saindo..." : "Sair"}</span>
        </button>
      </nav>
    </>
  );
}

function DesktopNavLink({
  item,
  pathname,
  active,
  collapsed,
  expanded,
  onToggle,
}: {
  item: NavItem;
  pathname: string;
  active: boolean;
  collapsed: boolean;
  expanded: boolean;
  onToggle: (next: boolean) => void;
}) {
  const Icon = item.icon;

  if (!item.enabled) {
    return (
      <span
        className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-foreground-muted/60 cursor-not-allowed ${
          collapsed ? "justify-center" : ""
        }`}
        title="Em breve"
      >
        <Icon size={18} stroke={1.75} className={item.color} />
        {!collapsed && item.label}
      </span>
    );
  }

  const hasChildren = !collapsed && Boolean(item.children?.length);

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors ${collapsed ? "justify-center" : ""} ${
          active ? "bg-surface text-foreground" : "text-foreground-muted hover:text-foreground hover:bg-surface"
        }`}
      >
        <Icon size={18} stroke={1.75} className={item.color} />
        {!collapsed && item.label}
      </Link>
    );
  }

  return (
    <div>
      <div
        className={`flex items-center rounded-md transition-colors ${
          active ? "bg-surface text-foreground" : "text-foreground-muted hover:text-foreground hover:bg-surface"
        }`}
      >
        <Link href={item.href} className="flex items-center gap-2.5 px-3 py-2 flex-1">
          <Icon size={18} stroke={1.75} className={item.color} />
          {item.label}
        </Link>
        <button
          type="button"
          onClick={() => onToggle(!expanded)}
          aria-expanded={expanded}
          title={expanded ? `Recolher ${item.label}` : `Expandir ${item.label}`}
          className="px-2.5 py-2 text-foreground-muted hover:text-foreground transition-colors"
        >
          <IconChevronDown size={14} stroke={1.75} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-0.5 ml-4 pl-3 border-l border-border space-y-0.5">
          {item.children!.map((child) => {
            const childActive = pathname === child.href;
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  childActive ? "text-foreground bg-surface" : "text-foreground-muted hover:text-foreground"
                }`}
              >
                <ChildIcon size={15} stroke={1.75} className={child.color} />
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
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
