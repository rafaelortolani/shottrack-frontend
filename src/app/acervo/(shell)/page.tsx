import Link from "next/link";
import { IconFocus2, IconCapsuleHorizontal, IconBackpack } from "@tabler/icons-react";

const SECTIONS = [
  {
    href: "/acervo/armas",
    label: "Armas",
    description: "Pistolas, revólveres e mais",
    icon: IconFocus2,
    bg: "bg-accent-target/15",
    color: "text-accent-target-soft",
  },
  {
    href: "/acervo/municoes",
    label: "Munições",
    description: "Cartuchos e recarregas",
    icon: IconCapsuleHorizontal,
    bg: "bg-accent-brass/15",
    color: "text-accent-brass-soft",
  },
  {
    href: "/acervo/acessorios",
    label: "Acessórios",
    description: "Coldres, miras e outros",
    icon: IconBackpack,
    bg: "bg-accent-sage/15",
    color: "text-accent-sage-soft",
  },
];

export default function AcervoPage() {
  return (
    <div>
      <h1 className="font-display text-lg font-semibold mb-4">Acervo</h1>

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
