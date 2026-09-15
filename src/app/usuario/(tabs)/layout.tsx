import Link from "next/link";
import { TargetRings } from "@/components/TargetRings";
import { Tabs } from "@/components/Tabs";

const USUARIO_TABS = [
  { href: "/usuario", label: "Perfil" },
  { href: "/usuario/modalidades", label: "Modalidades" },
];

export default function UsuarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-16 md:w-56 border-r border-border flex flex-col py-6 px-3 md:px-5 shrink-0">
        <span className="font-display font-semibold text-lg mb-10 hidden md:block">
          ShotTrack
        </span>
        <nav className="space-y-1 text-sm">
          <Link
            className="block rounded-md px-3 py-2 text-foreground-muted hover:text-foreground hover:bg-surface transition-colors"
            href="/dashboard"
          >
            <span className="hidden md:inline">Dashboard</span>
            <span className="md:hidden">○</span>
          </Link>
          <span
            className="block rounded-md px-3 py-2 text-foreground-muted/60 cursor-not-allowed"
            title="Em breve"
          >
            <span className="hidden md:inline">Treinos</span>
            <span className="md:hidden">○</span>
          </span>
          <span
            className="block rounded-md px-3 py-2 text-foreground-muted/60 cursor-not-allowed"
            title="Em breve"
          >
            <span className="hidden md:inline">Acervo</span>
            <span className="md:hidden">○</span>
          </span>
          <Link className="block rounded-md px-3 py-2 bg-surface text-foreground" href="/usuario">
            <span className="hidden md:inline">Usuário</span>
            <span className="md:hidden">●</span>
          </Link>
        </nav>
      </aside>

      <main className="flex-1 relative overflow-hidden">
        <TargetRings className="absolute -right-32 -top-32 w-[420px] h-[420px] text-accent-brass pointer-events-none" />

        <div className="relative max-w-lg px-6 md:px-10 py-10">
          <h1 className="font-display text-2xl font-semibold mb-6">Usuário</h1>
          <Tabs items={USUARIO_TABS} />
          <div>{children}</div>
        </div>
      </main>
    </div>
  );
}
