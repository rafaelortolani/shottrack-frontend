export function TargetRings({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="200" cy="200" r="195" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1.5" />
      <circle cx="200" cy="200" r="160" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
      <circle cx="200" cy="200" r="120" stroke="currentColor" strokeOpacity="0.24" strokeWidth="1.5" />
      <circle cx="200" cy="200" r="80" stroke="currentColor" strokeOpacity="0.34" strokeWidth="1.5" />
      <circle cx="200" cy="200" r="40" stroke="currentColor" strokeOpacity="0.46" strokeWidth="1.5" />
      <line x1="0" y1="200" x2="400" y2="200" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1.5" />
      <line x1="200" y1="0" x2="200" y2="400" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1.5" />
    </svg>
  );
}
