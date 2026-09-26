/**
 * Retícula estilo mil-dot — evoluiu do motivo de anéis concêntricos
 * puros pra incluir cruz central e marcações, refletindo a direção
 * tática adotada (ver skill de convenções, "Identidade visual —
 * revisão tática"). Continua sendo textura de fundo discreta, nunca
 * ícone literal em primeiro plano — só o peso visual mudou.
 */
export function TargetRings({
  className = "",
  animated = false,
}: {
  className?: string;
  // entrada do login: traça círculo, cruz e marcações (classe em globals.css)
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`${className} ${animated ? "reticle-draw" : ""}`}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="100" cy="100" r="85" pathLength="1" stroke="currentColor" strokeOpacity="0.24" strokeWidth="1" />
      <line x1="100" y1="15" x2="100" y2="185" pathLength="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <line x1="15" y1="100" x2="185" y2="100" pathLength="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <line x1="70" y1="15" x2="70" y2="30" pathLength="1" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1" />
      <line x1="130" y1="15" x2="130" y2="30" pathLength="1" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1" />
      <line x1="15" y1="70" x2="30" y2="70" pathLength="1" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1" />
      <line x1="15" y1="130" x2="30" y2="130" pathLength="1" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1" />
    </svg>
  );
}