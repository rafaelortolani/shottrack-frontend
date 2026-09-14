export function TargetRings({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="200" cy="200" r="180" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
      <circle cx="200" cy="200" r="130" stroke="currentColor" strokeOpacity="0.10" strokeWidth="1" />
      <circle cx="200" cy="200" r="80" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
      <circle cx="200" cy="200" r="30" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
    </svg>
  );
}
