import { PageContainer } from "@/components/PageContainer";

export default function UsuarioShellLayout({ children }: { children: React.ReactNode }) {
  return <PageContainer ringsClassName="text-accent-brass">{children}</PageContainer>;
}
