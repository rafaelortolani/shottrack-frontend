/**
 * Wordmark completa — "SHOTTRACK" com o ponto de mira no lugar do
 * primeiro "O". Usado onde o nome completo cabe: login, cadastro,
 * cabeçalho da nav expandida. Ver skill de convenções, seção "Logo".
 */
export function LogoWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="ShotTrack"
      className={`inline-flex items-center font-display font-bold tracking-wide text-foreground ${className}`}
    >
      SH
      <svg
        width="0.7em"
        height="0.7em"
        viewBox="0 0 22 22"
        className="mx-[0.02em] inline-block"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="9" fill="none" stroke="var(--accent-target)" strokeWidth="1.6" />
        <circle cx="11" cy="11" r="3" fill="var(--accent-brass)" />
      </svg>
      TTRACK
    </span>
  );
}