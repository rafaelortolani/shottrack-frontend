"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCamera, IconPhotoOff } from "@tabler/icons-react";
import { MAX_PHOTOS_PER_SERIES, PhotoPicker, PhotoProgress } from "@/components/PhotoPicker";
import { photoUrl, PhotoViewer } from "@/components/PhotoViewer";
import { callApi } from "@/lib/clientApi";
import { PHOTO_NOT_FOUND_MESSAGE, probePhoto } from "@/lib/photoLoad";
import { PhotoReduceError, reducePhoto } from "@/lib/photoResize";
import { photoErrorMessage, uploadSeriesPhoto, type PhotoMeta } from "@/lib/photoUpload";

type Job =
  | { phase: "idle" }
  | { phase: "reducing" }
  | { phase: "uploading"; fraction: number }
  | { phase: "failed"; message: string; blob: Blob | null };

/**
 * Miniatura com esqueleto enquanto carrega. Se falhar, descobre o motivo: foto inexistente (404) sai da lista com
 * a mensagem "Foto não encontrada." (tentar de novo não resolve); sessão renovada recarrega uma vez; rede/servidor
 * mostram "tentar de novo".
 */
function Thumbnail({
  seriesId,
  photo,
  seriesNumber,
  onOpen,
  onMissing,
}: {
  seriesId: string;
  photo: PhotoMeta;
  seriesNumber: number;
  onOpen: () => void;
  onMissing: (photo: PhotoMeta) => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  if (state === "error") {
    return (
      <button
        type="button"
        onClick={() => {
          setState("loading");
          setAttempt((n) => n + 1);
        }}
        aria-label={`Tentar de novo carregar a miniatura da foto do alvo da série ${seriesNumber}`}
        className="flex h-14 w-14 min-h-11 min-w-11 flex-col items-center justify-center rounded-md border border-border text-foreground-muted"
      >
        <IconPhotoOff size={20} stroke={1.5} aria-hidden="true" />
        <span className="text-[10px] leading-none">de novo</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir foto do alvo da série ${seriesNumber}`}
      className={`relative h-14 w-14 min-h-11 min-w-11 overflow-hidden rounded-md border border-border ${state === "loading" ? "animate-pulse bg-surface" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do BFF autenticado (no-store) */}
      <img
        key={attempt}
        src={`${photoUrl(seriesId, photo.id, "thumbnail")}${attempt ? `?t=${attempt}` : ""}`}
        alt={`Foto do alvo da série ${seriesNumber}`}
        onLoad={() => setState("ready")}
        onError={() => {
          void probePhoto(photoUrl(seriesId, photo.id, "thumbnail")).then((result) => {
            if (result === "missing") onMissing(photo);
            else if (result === "available" && attempt === 0) setAttempt(1);
            else setState("error");
          });
        }}
        className="h-full w-full object-cover"
      />
    </button>
  );
}

/**
 * FUC26: fotos de uma série existente — ícone de câmera com a contagem, até 5 miniaturas e o visualizador.
 * O ícone abre o painel de anexar (tirar foto / galeria, progresso e cancelar). A lista sempre vem do BFF
 * (no-store) depois de anexar ou excluir, então a contagem nunca fica obsoleta.
 * `refreshToken` muda quando a tela-mãe anexou uma foto por fora (registro rápido).
 */
export function SeriesPhotos({
  seriesId,
  seriesNumber,
  photoCount,
  refreshToken,
  onCountChange,
}: {
  seriesId: string;
  seriesNumber: number;
  photoCount: number;
  refreshToken: number;
  onCountChange: (count: number) => void;
}) {
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [listState, setListState] = useState<"idle" | "loading" | "error">(photoCount > 0 ? "loading" : "idle");
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [job, setJob] = useState<Job>({ phase: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  });

  const load = useCallback(async () => {
    setListState("loading");
    const result = await callApi<PhotoMeta[]>(`/api/series/${seriesId}/photos`, { fallback: "Não foi possível carregar as fotos" });
    if (!result.ok) {
      setListState("error");
      return null;
    }
    const sorted = [...result.data].sort((a, b) => a.position - b.position);
    setPhotos(sorted);
    setListState("idle");
    onCountChangeRef.current(sorted.length);
    return sorted;
  }, [seriesId]);

  useEffect(() => {
    // só ao montar e quando a tela-mãe pede atualização (mesmo padrão do loadSeries do SeriesAccordion)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (photoCount > 0 || refreshToken > 0) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, refreshToken]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const count = listState === "idle" ? photos.length : photoCount;
  const limitReached = count >= MAX_PHOTOS_PER_SERIES;
  const busy = job.phase === "reducing" || job.phase === "uploading";

  /** 404 numa imagem: a foto foi excluída em outro lugar. Sai da lista na hora e a lista do servidor é relida. */
  function handleMissing(photo: PhotoMeta) {
    const remaining = photos.filter((p) => p.id !== photo.id);
    setPhotos(remaining);
    setNotice(PHOTO_NOT_FOUND_MESSAGE);
    if (remaining.length === 0) setViewerIndex(null);
    void load();
  }

  async function sendBlob(blob: Blob) {
    setNotice(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setJob({ phase: "uploading", fraction: 0 });
    const result = await uploadSeriesPhoto(seriesId, blob, {
      signal: controller.signal,
      onProgress: (fraction) => setJob({ phase: "uploading", fraction }),
    });
    abortRef.current = null;

    if (result.ok) {
      setJob({ phase: "idle" });
      await load();
      return;
    }
    if (result.aborted) {
      setJob({ phase: "idle" });
      return;
    }
    // limite/validação não melhoram tentando de novo com a mesma foto
    const retryable = result.status === 0 || result.status === 429 || result.status >= 500;
    setJob({ phase: "failed", message: result.message, blob: retryable ? blob : null });
    if (result.code === "PHOTO_LIMIT_PER_SERIES_REACHED") await load();
  }

  async function handleFile(file: File) {
    setJob({ phase: "reducing" });
    try {
      const { blob } = await reducePhoto(file);
      await sendBlob(blob);
    } catch (error) {
      const message = error instanceof PhotoReduceError ? error.message : photoErrorMessage(null, 0, "Não foi possível preparar a foto.");
      setJob({ phase: "failed", message, blob: null });
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setJob({ phase: "idle" });
  }

  async function deletePhoto(photo: PhotoMeta): Promise<string | null> {
    const result = await callApi(`/api/series/${seriesId}/photos/${photo.id}`, { method: "DELETE", fallback: "Não foi possível excluir a foto" });
    if (!result.ok && result.status !== 404) return photoErrorMessage(result.code, result.status, result.message);
    const remaining = await load();
    if (remaining) {
      if (remaining.length === 0) setViewerIndex(null);
      else setViewerIndex((i) => Math.min(i ?? 0, remaining.length - 1));
    } else {
      setViewerIndex(null);
    }
    return null;
  }

  return (
    <div className="pb-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-label={`Fotos do alvo da série ${seriesNumber}: ${count}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <IconCamera size={18} stroke={1.75} aria-hidden="true" />
          <span data-testid={`photo-count-${seriesNumber}`}>{count}</span>
        </button>

        {listState === "loading" && photoCount > 0 && photos.length === 0 &&
          Array.from({ length: Math.min(photoCount, MAX_PHOTOS_PER_SERIES) }, (_, i) => (
            <div key={i} className="h-14 w-14 animate-pulse rounded-md bg-surface" aria-hidden="true" />
          ))}
        {photos.slice(0, MAX_PHOTOS_PER_SERIES).map((photo, i) => (
          <Thumbnail
            key={photo.id}
            seriesId={seriesId}
            photo={photo}
            seriesNumber={seriesNumber}
            onOpen={() => {
              setNotice(null);
              setViewerIndex(i);
            }}
            onMissing={handleMissing}
          />
        ))}
      </div>

      {notice && viewerIndex === null && (
        <p className="text-sm text-accent-target" role="alert">{notice}</p>
      )}

      {listState === "error" && (
        <p className="flex items-center gap-2 text-sm text-accent-target" role="alert">
          Não foi possível carregar as fotos.
          <button type="button" onClick={() => void load()} className="min-h-11 px-2 underline">Tentar de novo</button>
        </p>
      )}

      {panelOpen && (
        <div className="mt-1 space-y-2">
          {job.phase === "idle" || job.phase === "failed" ? (
            <PhotoPicker onFile={handleFile} limitReached={limitReached} />
          ) : (
            <PhotoProgress
              label={job.phase === "reducing" ? "Preparando a foto..." : `Enviando foto... ${Math.round(job.fraction * 100)}%`}
              fraction={job.phase === "uploading" ? job.fraction : null}
              onCancel={cancel}
            />
          )}
          {job.phase === "failed" && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-accent-target" role="alert">
              {job.message}
              {job.blob && (
                <button type="button" onClick={() => void sendBlob(job.blob!)} disabled={busy} className="min-h-11 px-2 underline">
                  Tentar de novo
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {viewerIndex !== null && photos.length > 0 && (
        <PhotoViewer
          seriesId={seriesId}
          seriesNumber={seriesNumber}
          photos={photos}
          index={Math.min(viewerIndex, photos.length - 1)}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          onDelete={deletePhoto}
          onPhotoMissing={handleMissing}
          notice={notice}
        />
      )}
    </div>
  );
}
