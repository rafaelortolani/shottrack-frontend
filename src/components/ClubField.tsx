/** Caixa "Este local é um clube" (FUC23): conta nas exigências de habitualidade "só em clube". */
export function ClubField({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor="club" className="flex items-center gap-2 min-h-11 text-sm cursor-pointer">
      <input
        id="club"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-accent-target"
      />
      Este local é um clube
    </label>
  );
}
