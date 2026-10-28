import Link from "next/link";

export const PRIMARY_LINK_CLASS =
  "inline-flex items-center justify-center rounded-md bg-accent-target hover:bg-accent-target-hover text-background text-sm font-medium px-4 py-2 transition-colors";
export const SECTION_LINK_CLASS = "text-sm text-accent-brass-soft hover:text-accent-brass transition-colors";
export const SELECT_CLASS =
  "rounded-md bg-background border border-border px-3 py-2 text-sm pointer-coarse:text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors disabled:opacity-60";
export const FIELD_LABEL_CLASS = "block text-xs uppercase tracking-wide text-foreground-muted mb-1";

export function segmentClass(selected: boolean): string {
  return `px-3 py-1.5 text-sm rounded transition-colors ${
    selected ? "bg-surface-raised text-foreground font-medium" : "text-foreground-muted hover:text-foreground"
  }`;
}

export function SectionHeader({
  id,
  title,
  link,
}: {
  id: string;
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h2 id={id} className="font-display text-base font-semibold">
        {title}
      </h2>
      {link && (
        <Link href={link.href} className={SECTION_LINK_CLASS}>
          {link.label}
        </Link>
      )}
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-foreground-muted">{children}</p>;
}
