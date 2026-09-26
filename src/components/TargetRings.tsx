const MIL_DOT_OFFSETS = [9, 18, 27, 36];

/**
 * Retícula estilo mil-dot — evoluiu do motivo de anéis concêntricos
 * puros pra uma retícula de luneta: borda do tubo, postes grossos
 * (duplex), cruz fina central e pontos mil-dot, refletindo a direção
 * tática adotada (ver skill de convenções, "Identidade visual —
 * revisão tática"). Continua sendo textura de fundo discreta, nunca
 * ícone literal em primeiro plano — só o peso visual mudou.
 */
export function TargetRings({
  className = "",
  animated = false,
}: {
  className?: string;
  // entrada do login: traça círculos, postes e cruz; pontos surgem depois (classes em globals.css)
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`${className} ${animated ? "reticle-draw" : ""}`}
      aria-hidden="true"
      fill="none"
    >
      {/* campo de visão + borda do tubo da luneta */}
      <circle cx="100" cy="100" r="85" pathLength="1" stroke="currentColor" strokeOpacity="0.24" strokeWidth="1" />
      <circle cx="100" cy="100" r="90" pathLength="1" stroke="currentColor" strokeOpacity="0.12" strokeWidth="3" />
      {/* postes grossos (duplex) da borda até perto do centro */}
      <line x1="100" y1="15" x2="100" y2="55" pathLength="1" stroke="currentColor" strokeOpacity="0.16" strokeWidth="4" />
      <line x1="100" y1="145" x2="100" y2="185" pathLength="1" stroke="currentColor" strokeOpacity="0.16" strokeWidth="4" />
      <line x1="15" y1="100" x2="55" y2="100" pathLength="1" stroke="currentColor" strokeOpacity="0.16" strokeWidth="4" />
      <line x1="145" y1="100" x2="185" y2="100" pathLength="1" stroke="currentColor" strokeOpacity="0.16" strokeWidth="4" />
      {/* cruz fina no centro */}
      <line x1="100" y1="55" x2="100" y2="145" pathLength="1" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.75" />
      <line x1="55" y1="100" x2="145" y2="100" pathLength="1" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.75" />
      {/* pontos mil-dot, espaçamento igual nos dois eixos */}
      <g className="reticle-dots" fill="currentColor" fillOpacity="0.4">
        {MIL_DOT_OFFSETS.map((d) => (
          <g key={d}>
            <circle cx={100 + d} cy="100" r="1.6" />
            <circle cx={100 - d} cy="100" r="1.6" />
            <circle cx="100" cy={100 + d} r="1.6" />
            <circle cx="100" cy={100 - d} r="1.6" />
          </g>
        ))}
      </g>
    </svg>
  );
}