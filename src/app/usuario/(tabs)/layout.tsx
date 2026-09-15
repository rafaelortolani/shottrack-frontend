import { AppHeader } from "@/components/AppHeader";
import { AppNav } from "@/components/AppNav";
import { TargetRings } from "@/components/TargetRings";
import { Tabs } from "@/components/Tabs";

const USUARIO_TABS = [
  { href: "/usuario", label: "Perfil" },
  { href: "/usuario/modalidades", label: "Modalidades" },
];

export default function UsuarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <AppNav />

      <main className="flex-1 relative overflow-hidden">
        <TargetRings className="absolute -right-32 -top-32 w-[420px] h-[420px] text-accent-brass pointer-events-none" />

        <div className="relative max-w-lg px-6 md:px-10 py-10 pb-24 md:pb-10">
          <AppHeader />

          <h1 className="font-display text-2xl font-semibold mb-6">Usuário</h1>
          <Tabs items={USUARIO_TABS} />
          <div>{children}</div>
        </div>
      </main>
    </div>
  );
}
