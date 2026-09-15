import Link from "next/link";
import { TargetRings } from "@/components/TargetRings";

const stats = [
  { label: "Treinos esse mês", value: "9" },
  { label: "Disparos registrados", value: "412" },
  { label: "Melhor agrupamento", value: "3,2 cm" },
];

const recentVisits = [
  { local: "Clube de Tiro Alvorada", data: "12 set", modalidades: "Precisão, IPSC" },
  { local: "Estande Sul", data: "05 set", modalidades: "Precisão" },
  { local: "Clube de Tiro Alvorada", data: "29 ago", modalidades: "Steel Challenge" },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* nav lateral fina */}
      <aside className="w-16 md:w-56 border-r border-border flex flex-col py-6 px-3 md:px-5 shrink-0">
        <span className="font-display font-semibold text-lg mb-10 hidden md:block">
          ShotTrack
        </span>
        <nav className="space-y-1 text-sm">
          <Link className="block rounded-md px-3 py-2 bg-surface text-foreground" href="/dashboard">
            <span className="hidden md:inline">Dashboard</span>
            <span className="md:hidden">●</span>
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
          <Link
            className="block rounded-md px-3 py-2 text-foreground-muted hover:text-foreground hover:bg-surface transition-colors"
            href="/modalidades"
          >
            <span className="hidden md:inline">Modalidades</span>
            <span className="md:hidden">○</span>
          </Link>
          <Link
            className="block rounded-md px-3 py-2 text-foreground-muted hover:text-foreground hover:bg-surface transition-colors"
            href="/perfil"
          >
            <span className="hidden md:inline">Perfil</span>
            <span className="md:hidden">○</span>
          </Link>
        </nav>
      </aside>

      <main className="flex-1 relative overflow-hidden">
        <TargetRings className="absolute -right-32 -top-32 w-[420px] h-[420px] text-accent-brass pointer-events-none" />

        <div className="relative max-w-4xl px-6 md:px-10 py-10">
          <p className="text-foreground-muted mb-1">Bem-vindo de volta</p>
          <h1 className="font-display text-2xl font-semibold mb-10">
            Sua evolução
          </h1>

          {/* hero: número grande, sem card */}
          <div className="mb-12">
            <p className="text-foreground-muted text-sm mb-1">
              Agrupamento médio (últimos 30 dias)
            </p>
            <p className="font-display text-6xl md:text-7xl font-semibold tracking-tight">
              4,1<span className="text-2xl text-foreground-muted ml-2">cm</span>
            </p>
            <p className="text-sm text-accent-brass mt-2">
              ↓ 0,6 cm em relação ao mês anterior
            </p>
          </div>

          {/* estatísticas secundárias em linha, sem cards */}
          <div className="flex flex-wrap gap-x-10 gap-y-6 mb-14 pb-14 border-b border-border">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-display text-2xl font-medium">{s.value}</p>
                <p className="text-sm text-foreground-muted">{s.label}</p>
              </div>
            ))}
          </div>

          <h2 className="font-display text-lg font-semibold mb-5">
            Visitas recentes
          </h2>
          <ul className="space-y-4">
            {recentVisits.map((v, i) => (
              <li
                key={i}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <div>
                  <p className="text-foreground">{v.local}</p>
                  <p className="text-sm text-foreground-muted">{v.modalidades}</p>
                </div>
                <span className="text-sm text-foreground-muted">{v.data}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
