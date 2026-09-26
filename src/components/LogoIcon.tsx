/**
 * Ícone da marca — retícula (círculo + cruz + ponto central). Usado
 * onde não cabe o nome por extenso: favicon, nav recolhida.
 * Nunca usar no lugar do LogoWordmark por preferência de tela — ver
 * skill de convenções, seção "Logo".
 */
export function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} role="img" aria-label="ShotTrack">
      <circle cx="30" cy="30" r="26" fill="none" stroke="var(--accent-target)" strokeWidth="2" />
      <circle cx="30" cy="30" r="17" fill="none" stroke="var(--accent-target)" strokeWidth="1.4" opacity="0.7" />
      <line x1="30" y1="4" x2="30" y2="56" stroke="var(--accent-target)" strokeWidth="1" opacity="0.5" />
      <line x1="4" y1="30" x2="56" y2="30" stroke="var(--accent-target)" strokeWidth="1" opacity="0.5" />
      <circle cx="30" cy="30" r="4.5" fill="var(--accent-brass)" />
    </svg>
  );
}