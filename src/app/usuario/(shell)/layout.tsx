import { TargetRings } from "@/components/TargetRings";

export default function UsuarioShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <TargetRings className="absolute -right-32 -top-32 w-[420px] h-[420px] text-accent-brass pointer-events-none" />

      <div className="relative max-w-lg px-5 md:px-6 py-6 pb-20 md:pb-6">{children}</div>
    </div>
  );
}
