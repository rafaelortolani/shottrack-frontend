import { IconPlus } from "@tabler/icons-react";

/**
 * Botão secundário de "adicionar mais um" (novo treino, nova série) —
 * contorno, sem preenchimento: o botão sólido fica pro estado vazio, onde
 * essa é a ação principal da tela.
 */
export function AddButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-accent-brass transition-colors"
    >
      <IconPlus size={16} stroke={1.75} className="text-accent-brass-soft" aria-hidden />
      {children}
    </button>
  );
}
