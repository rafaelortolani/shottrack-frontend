import { AppNav } from "@/components/AppNav";

export default function UsuarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground flex">
      <AppNav />

      <main className="flex-1 min-w-0 relative overflow-clip">{children}</main>
    </div>
  );
}
