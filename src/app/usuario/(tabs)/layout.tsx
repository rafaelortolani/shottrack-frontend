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

        <div className="relative max-w-lg px-5 md:px-6 py-6 pb-20 md:pb-6">
          <h1 className="font-display text-lg font-semibold mb-4">Usuário</h1>
          <Tabs items={USUARIO_TABS} className="md:hidden" />
          <div>{children}</div>
        </div>
      </main>
    </div>
  );
}
