"use client";

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="min-h-11 w-full rounded-md bg-accent-target hover:bg-accent-target-hover text-background font-medium py-2 transition-colors"
    >
      Tentar de novo
    </button>
  );
}
