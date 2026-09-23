import { PageContainer } from "@/components/PageContainer";

export default function TreinosShellLayout({ children }: { children: React.ReactNode }) {
  return <PageContainer ringsClassName="text-accent-target">{children}</PageContainer>;
}
