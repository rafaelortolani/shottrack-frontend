import Link from "next/link";
import { IconClipboardList, IconHistory, IconMapPin } from "@tabler/icons-react";

const SECTIONS = [
  {
    href: "/treinos/visitas",
    label: "Visitas",
    description: "Iniciar e acompanhar visitas de treino",
    icon: IconClipboardList,
    bg: "bg-accent-brass/15",
    color: "text-accent-brass-soft",
  },
  {
    href: "/treinos/locais",
    label: "Locais",
    description: "Onde você treina",
    icon: IconMapPin,
    bg: "bg-accent-target/15",
    color: "text-accent-target-soft",
  },
  {
    href: "/treinos/historico",
    label: "Histórico",
    description: "Todas as séries, com filtros",
    icon: IconHistory,
    bg: "bg-accent-brass/15",
    color: "text-accent-brass-soft",
  },
];

export default function TreinosPage() {
  return (
    <div>
      <h1 className="font-display text-lg font-semibold mb-4">Treinos</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="flex items-center gap-3 rounded-md bg-surface p-4 hover:bg-surface/70 transition-colors"
            >
              <span className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${section.bg}`}>
                <Icon size={20} stroke={1.75} className={section.color} />
              </span>
              <div>
                <p className="text-foreground font-medium">{section.label}</p>
                <p className="text-sm text-foreground-muted">{section.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
