"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { probePhoto } from "@/lib/photoLoad";
import type { PhotoMeta } from "@/lib/photoUpload";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_PX = 60;

export function photoUrl(seriesId: string, photoId: string, kind: "content" | "thumbnail") {
  return `/api/series/${encodeURIComponent(seriesId)}/photos/${encodeURIComponent(photoId)}/${kind}`;
}

const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-full bg-background/70 text-foreground hover:bg-background disabled:opacity-40 transition-colors";

/**
 * FUC26: visualizador em tela cheia. Zoom por pinça e por duplo toque, arrastar para mover a foto ampliada,
 * deslizar (ou setas) para a próxima/anterior, Esc fecha, "Excluir foto" pede confirmação.
 * `onDelete` devolve a mensagem de erro (ou null se excluiu).
 */
/** Palco da foto: carregamento, zoom (pinça e duplo toque), arrastar e deslizar. Recriado a cada foto (`key`). */
function PhotoStage({
  seriesId,
  photo,
  label,
  onSwipe,
  onMissing,
}: {
  seriesId: string;
  photo: PhotoMeta;
  label: string;
  onSwipe: (delta: number) => void;
  onMissing: (photo: PhotoMeta) => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  /** A `<img>` falhou: descobre o motivo. 404 → some da lista; sessão renovada → recarrega uma vez; senão → "tentar de novo". */
  async function onImageError() {
    const url = photoUrl(seriesId, photo.id, "content");
    const result = await probePhoto(url);
    if (result === "missing") onMissing(photo);
    else if (result === "available" && attempt === 0) setAttempt(1);
    else setLoadFailed(true);
  }

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ startDistance: 0, startScale: 1, startX: 0, startY: 0, moved: false, lastTap: 0, panFrom: { x: 0, y: 0 } });

  function resetZoom() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function distance() {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(event: React.PointerEvent) {
    // botão dentro do palco (ex.: "Tentar de novo"): a captura do ponteiro engoliria o clique
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
    const g = gesture.current;
    if (pointers.current.size === 2) {
      g.startDistance = distance();
      g.startScale = scale;
    } else {
      g.startX = event.clientX;
      g.startY = event.clientY;
      g.moved = false;
      g.panFrom = offset;
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;

    if (pointers.current.size === 2) {
      g.moved = true;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.startScale * (distance() / g.startDistance)));
      setScale(next);
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return;
    }

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (Math.hypot(dx, dy) > 8) g.moved = true;
    if (scale > MIN_SCALE) setOffset({ x: g.panFrom.x + dx, y: g.panFrom.y + dy });
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    const wasPinch = pointers.current.size === 2;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setDragging(false);
    const g = gesture.current;
    if (wasPinch) {
      // o dedo que sobrou continua a partir daqui, sem "pular"
      const rest = [...pointers.current.values()][0];
      if (rest) {
        g.startX = rest.x;
        g.startY = rest.y;
        g.panFrom = offset;
      }
      g.moved = true;
      return;
    }

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;

    if (scale === MIN_SCALE && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      onSwipe(dx < 0 ? 1 : -1); // deslizar para a esquerda = próxima
      return;
    }

    if (!g.moved) {
      const now = Date.now();
      if (now - g.lastTap < 300) {
        g.lastTap = 0;
        if (scale > MIN_SCALE) resetZoom();
        else setScale(DOUBLE_TAP_SCALE);
      } else {
        g.lastTap = now;
      }
    }
  }

  return (
    <div
      data-testid="photo-stage"
      className="relative flex-1 min-h-0 overflow-hidden touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {!loaded && !loadFailed && <div className="absolute inset-4 animate-pulse rounded-md bg-surface" aria-hidden="true" />}
      {loadFailed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-foreground-muted" role="alert">Não foi possível carregar a foto.</p>
          <button
            type="button"
            onClick={() => {
              setLoadFailed(false);
              setAttempt((n) => n + 1);
            }}
            className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-surface"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a foto vem do BFF autenticado (no-store); next/image está desligado
        <img
          key={attempt}
          src={`${photoUrl(seriesId, photo.id, "content")}${attempt ? `?t=${attempt}` : ""}`}
          alt={label}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => void onImageError()}
          data-scale={scale}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transition: dragging ? "none" : "transform 150ms" }}
          className={`absolute inset-0 m-auto max-h-full max-w-full object-contain ${loaded ? "" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

export function PhotoViewer({
  seriesId,
  seriesNumber,
  photos,
  index,
  onIndexChange,
  onClose,
  onDelete,
  onPhotoMissing,
  notice,
}: {
  seriesId: string;
  seriesNumber: number;
  photos: PhotoMeta[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDelete: (photo: PhotoMeta) => Promise<string | null>;
  /** A foto não existe mais no servidor (404): a tela-mãe a tira da lista e informa em `notice`. */
  onPhotoMissing: (photo: PhotoMeta) => void;
  notice?: string | null;
}) {
  const photo = photos[index];
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  // foco no modal ao abrir e de volta ao elemento que o abriu ao fechar
  useEffect(() => {
    opener.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < photos.length) {
        setDeleteError(null);
        onIndexChange(next);
      }
    },
    [index, photos.length, onIndexChange]
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (confirming) return; // o diálogo de confirmação cuida do teclado
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "Tab") {
        // mantém o foco dentro do modal
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, go, onClose]);

  async function confirmDelete() {
    setDeleting(true);
    const message = await onDelete(photo);
    setDeleting(false);
    setConfirming(false);
    setDeleteError(message);
  }

  if (!photo || typeof document === "undefined") return null;
  const label = `Foto do alvo da série ${seriesNumber}`;

  // Portal em document.body: fora de qualquer contexto de empilhamento da tela, acima da barra do app (z-viewer).
  // O padding respeita o notch e as bordas arredondadas (o do rodapé está na barra de controles).
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${label}, foto ${index + 1} de ${photos.length}`}
      className="fixed inset-0 z-viewer flex flex-col bg-background pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      <div className="flex items-center justify-between gap-3 p-3">
        <span className="text-sm text-foreground-muted" aria-live="polite">
          Foto {index + 1} de {photos.length}
        </span>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar" className={ICON_BUTTON}>
          <IconX size={22} stroke={1.75} aria-hidden="true" />
        </button>
      </div>

      <PhotoStage key={photo.id} seriesId={seriesId} photo={photo} label={label} onSwipe={go} onMissing={onPhotoMissing} />

      {(deleteError ?? notice) && (
        <p className="px-4 pb-1 text-center text-sm text-accent-target" role="alert">{deleteError ?? notice}</p>
      )}

      <div className="flex items-center justify-between gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Foto anterior" className={ICON_BUTTON}>
          <IconChevronLeft size={22} stroke={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setConfirming(true);
          }}
          className="min-h-11 px-4 text-sm text-accent-target hover:text-accent-target-hover transition-colors"
        >
          Excluir foto
        </button>
        <button type="button" onClick={() => go(1)} disabled={index === photos.length - 1} aria-label="Próxima foto" className={ICON_BUTTON}>
          <IconChevronRight size={22} stroke={1.75} aria-hidden="true" />
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          id="confirm-delete-photo"
          title="Excluir foto"
          busy={deleting}
          busyLabel="Excluindo..."
          onCancel={() => setConfirming(false)}
          onConfirm={confirmDelete}
        >
          Esta foto será removida definitivamente.
        </ConfirmDialog>
      )}
    </div>,
    document.body
  );
}
