import Link from "next/link";
import { IconCalendarStats } from "@tabler/icons-react";

export default function AdminPage() {
  return (
    <div>
      <h1 className="font-display text-lg font-semibold mb-4">Administração</h1>

      <Link
        href="/admin/habitualidade"
        className="flex items-center gap-3 rounded-md bg-surface hover:bg-surface-raised p-4 min-h-11 transition-colors"
      >
        <span className="flex items-center justify-center w-10 h-10 rounded-full shrink-0 bg-accent-sage/15">
          <IconCalendarStats size={20} stroke={1.75} className="text-accent-sage-soft" />
        </span>
        <p className="font-medium">Regras de habitualidade</p>
      </Link>
    </div>
  );
}
