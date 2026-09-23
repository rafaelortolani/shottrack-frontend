import { TargetRings } from "@/components/TargetRings";

const WIDTHS = {
  // dashboard: gráfico de evolução precisa de mais largura que uma lista
  wide: "max-w-3xl",
  // listas e detalhe
  content: "max-w-2xl",
  // formulários: um pouco mais largo que um campo, sem esticar os inputs
  form: "max-w-lg",
};

/**
 * Layout de conteúdo (skill convencoes-frontend): container centralizado com
 * largura máxima confortável e o TargetRings ancorado atrás dele — mesmo
 * padrão do login/cadastro, nunca conteúdo grudado à esquerda com vazio à
 * direita nem anel solto num canto da tela.
 */
export function PageContainer({
  width = "content",
  ringsClassName,
  children,
}: {
  width?: keyof typeof WIDTHS;
  // cor do anel da seção, ex: "text-accent-brass"
  ringsClassName: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative mx-auto w-full ${WIDTHS[width]} px-5 md:px-6 py-6 pb-20 md:pb-6`}>
      <TargetRings
        className={`absolute -top-14 -right-14 z-0 w-[380px] h-[380px] pointer-events-none ${ringsClassName}`}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
