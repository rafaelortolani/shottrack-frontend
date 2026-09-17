import { TargetRings } from "@/components/TargetRings";
import { Tabs } from "@/components/Tabs";

const ACERVO_TABS = [
  { href: "/acervo", label: "Armas" },
  { href: "/acervo/municoes", label: "Munições" },
  { href: "/acervo/acessorios", label: "Acessórios" },
];

export default function AcervoTabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <TargetRings className="absolute -right-32 -top-32 w-[420px] h-[420px] text-accent-brass pointer-events-none" />

      <div className="relative max-w-lg px-5 md:px-6 py-6 pb-20 md:pb-6">
        <h1 className="font-display text-lg font-semibold mb-4">Acervo</h1>
        <Tabs items={ACERVO_TABS} className="md:hidden" />
        <div>{children}</div>
      </div>
    </div>
  );
}
