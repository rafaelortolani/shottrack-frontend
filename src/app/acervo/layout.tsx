import { AppNav } from "@/components/AppNav";

export default function AcervoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <AppNav />

      <main className="flex-1 relative overflow-hidden">{children}</main>
    </div>
  );
}
