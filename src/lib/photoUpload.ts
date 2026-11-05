/**
 * Envio da foto ao BFF com progresso e cancelamento (FUC26). Usa XMLHttpRequest porque `fetch` não informa o
 * progresso do envio. O XHR não passa pelo `fetch` que renova a sessão (A07), então o 401 de sessão é tratado
 * aqui: renova uma vez e reenvia (o `Blob` é reutilizável).
 */
export type PhotoMeta = { id: string; position: number; widthPx: number; heightPx: number; sizeBytes: number; createdAt: string };

export type PhotoUploadResult =
  | { ok: true; photo: PhotoMeta }
  | { ok: false; aborted: boolean; status: number; code: string | null; message: string; retryAfter: number | null };

/** Mensagens na linguagem do atleta, por código de erro do backend (FUC26). */
const MESSAGES: Record<string, string> = {
  PHOTO_TOO_LARGE: "A foto é grande demais (máximo de 10 MB). Escolha outra ou tire de novo.",
  PHOTO_UNSUPPORTED_TYPE: "Formato não aceito. Use uma foto JPEG ou PNG.",
  PHOTO_INVALID_IMAGE: "Não foi possível ler essa imagem. Escolha outra foto.",
  PHOTO_DIMENSIONS_TOO_LARGE: "A imagem tem resolução alta demais. Escolha outra foto.",
  PHOTO_LIMIT_PER_SERIES_REACHED: "Você atingiu o limite de fotos por série do seu plano. Exclua uma foto para enviar outra.",
  PHOTO_LIMIT_PER_ATHLETE_REACHED: "Você chegou ao limite de fotos da conta. Exclua alguma para enviar outra.",
  PHOTO_STORAGE_LIMIT_REACHED: "Você atingiu o espaço do seu plano. Exclua fotos antigas para enviar novas.",
  PHOTO_PROCESSING_BUSY: "O servidor está processando outras fotos. Tente de novo em instantes.",
  RATE_LIMITED: "Muitos envios em pouco tempo. Aguarde um pouco e tente de novo.",
  SERIES_NOT_FOUND: "Série não encontrada.",
  PHOTO_NOT_FOUND: "Foto não encontrada.",
};

export const NETWORK_FAILURE = "Falha de rede ao enviar a foto. Tente de novo.";

export function photoErrorMessage(code: string | null, status: number, fallback: string): string {
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (status === 429) return MESSAGES.RATE_LIMITED;
  // erro do servidor sem código conhecido: mensagem do próprio componente, nunca texto técnico do backend
  if (status >= 500) return "Não foi possível enviar a foto. Tente de novo.";
  return fallback;
}

type Options = { onProgress?: (fraction: number) => void; signal?: AbortSignal };

function sendOnce(seriesId: string, blob: Blob, { onProgress, signal }: Options): Promise<PhotoUploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const failure = (aborted: boolean, status: number, code: string | null, message: string, retryAfter: number | null = null): PhotoUploadResult => ({
      ok: false, aborted, status, code, message, retryAfter,
    });

    if (signal?.aborted) return resolve(failure(true, 0, null, "Envio cancelado."));
    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const done = (result: PhotoUploadResult) => {
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    const form = new FormData();
    form.append("file", blob, "alvo.jpg");

    xhr.open("POST", `/api/series/${encodeURIComponent(seriesId)}/photos`);
    xhr.setRequestHeader("x-shottrack-upload", "1");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onabort = () => done(failure(true, 0, null, "Envio cancelado."));
    xhr.onerror = () => done(failure(false, 0, null, NETWORK_FAILURE));
    xhr.ontimeout = () => done(failure(false, 0, null, NETWORK_FAILURE));
    xhr.onload = () => {
      const body = xhr.response as { data?: PhotoMeta; error?: { code?: string; message?: string } } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.data) return done({ ok: true, photo: body.data });
      const code = body?.error?.code ?? null;
      const retry = Number(xhr.getResponseHeader("Retry-After"));
      done(
        failure(
          false,
          xhr.status,
          code,
          photoErrorMessage(code, xhr.status, body?.error?.message ?? "Não foi possível enviar a foto. Tente de novo."),
          Number.isFinite(retry) && retry > 0 ? retry : null
        )
      );
    };
    xhr.send(form);
  });
}

export async function uploadSeriesPhoto(seriesId: string, blob: Blob, options: Options = {}): Promise<PhotoUploadResult> {
  const first = await sendOnce(seriesId, blob, options);
  const sessionExpired = !first.ok && first.status === 401 && (first.code === "UNAUTHORIZED" || first.code === "UNAUTHENTICATED");
  if (!sessionExpired) return first;

  const renewed = await fetch("/api/auth/refresh", { method: "POST" }).then((r) => r.ok).catch(() => false);
  return renewed ? sendOnce(seriesId, blob, options) : first;
}
