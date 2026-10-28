import { Suspense } from "react";
import { AppNav } from "@/components/AppNav";
import { PageContainer } from "@/components/PageContainer";
import { DashboardShell } from "./_components/DashboardShell";

/**
 * Dashboard em abas (FUC15 v6): Resumo | Evolução | Recordes | Modalidades, com
 * filtro global de modalidade. Aba e filtro ficam na URL (?aba=, ?modalidade=).
 */
export default function DashboardPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground flex">
      <AppNav />

      <main className="flex-1 min-w-0 relative overflow-clip">
        <PageContainer width="wide">
          <Suspense>
            <DashboardShell />
          </Suspense>
        </PageContainer>
      </main>
    </div>
  );
}
