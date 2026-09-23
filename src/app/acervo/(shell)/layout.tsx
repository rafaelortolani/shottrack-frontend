import { PageContainer } from "@/components/PageContainer";

export default function AcervoShellLayout({ children }: { children: React.ReactNode }) {
  return <PageContainer ringsClassName="text-accent-brass">{children}</PageContainer>;
}
