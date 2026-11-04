"use client";

import { useRef } from "react";
import { IconCamera, IconPhoto } from "@tabler/icons-react";

export const MAX_PHOTOS_PER_SERIES = 5;

const BUTTON =
  "inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-foreground hover:bg-surface disabled:opacity-60 transition-colors";

/**
 * FUC26: dois botões — "Tirar foto" (câmera traseira no celular) e "Escolher da galeria". Só entrega o `File`;
 * redução e envio são de quem usa. Com o limite atingido, os botões somem e aparece o aviso.
 */
export function PhotoPicker({
  onFile,
  disabled = false,
  limitReached = false,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  limitReached?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  if (limitReached) {
    return <p className="text-sm text-foreground-muted">Limite de {MAX_PHOTOS_PER_SERIES} fotos por série</p>;
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo (ex.: depois de um erro)
    if (file) onFile(file);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={BUTTON} disabled={disabled} onClick={() => cameraRef.current?.click()}>
        <IconCamera size={18} stroke={1.75} aria-hidden="true" />
        Tirar foto
      </button>
      <button type="button" className={BUTTON} disabled={disabled} onClick={() => galleryRef.current?.click()}>
        <IconPhoto size={18} stroke={1.75} aria-hidden="true" />
        Escolher da galeria
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Câmera" data-testid="photo-input-camera" onChange={handleChange} />
      <input ref={galleryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Galeria" data-testid="photo-input-gallery" onChange={handleChange} />
    </div>
  );
}

/** Barra de progresso do envio, com cancelar. */
export function PhotoProgress({
  label,
  fraction,
  onCancel,
}: {
  label: string;
  /** null = progresso indeterminado (preparando a foto). */
  fraction: number | null;
  onCancel: () => void;
}) {
  const percent = fraction === null ? null : Math.round(fraction * 100);
  return (
    <div className="space-y-1" role="status">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-foreground-muted">{label}</span>
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-foreground-muted hover:text-foreground transition-colors">
          Cancelar
        </button>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(percent !== null ? { "aria-valuenow": percent } : {})}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface"
      >
        <div
          className={`h-full bg-accent-target transition-[width] ${percent === null ? "w-1/3 animate-pulse" : ""}`}
          style={percent !== null ? { width: `${percent}%` } : undefined}
        />
      </div>
    </div>
  );
}
