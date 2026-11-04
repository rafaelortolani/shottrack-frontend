import { NextRequest, NextResponse } from "next/server";
import { backendRawFetch } from "@/lib/backend";

/**
 * Limite do corpo do upload de foto (FUC26): o backend aceita 10 MB de arquivo; os 1 MB a mais cobrem o
 * envelope multipart. Acima disso o BFF recusa sem repassar nada ao backend.
 */
export const MAX_UPLOAD_BYTES = 11 * 1024 * 1024;

export function unauthenticated() {
  return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } }, { status: 401 });
}

export function photoTooLarge() {
  return NextResponse.json(
    { error: { code: "PHOTO_TOO_LARGE", message: "A foto é grande demais" } },
    { status: 413 }
  );
}

export function accessTokenOf(request: NextRequest): string | null {
  return request.cookies.get("shottrack_access")?.value ?? null;
}

/** Repassa o erro do backend (`{ error }`) com o mesmo status; corpo ilegível vira o erro de `fallback`. */
export async function backendErrorResponse(response: Response, fallback: { code: string; message: string }) {
  const body = await response.json().catch(() => null);
  const headers = response.status === 429 && response.headers.get("Retry-After")
    ? { "Retry-After": response.headers.get("Retry-After")! }
    : undefined;
  return NextResponse.json({ error: body?.error ?? fallback }, { status: response.status, headers });
}

/**
 * Imagem do backend em streaming, sem carregar na memória: só `image/jpeg` passa (o tipo é fixo, nunca o do
 * backend às cegas), nunca em cache (foto é dado pessoal) e com `nosniff`.
 */
export async function streamJpeg(request: NextRequest, path: string): Promise<NextResponse> {
  const accessToken = accessTokenOf(request);
  if (!accessToken) return unauthenticated();

  let response: Response;
  try {
    response = await backendRawFetch(path, { accessToken, headers: { Accept: "image/jpeg" } });
  } catch {
    return NextResponse.json({ error: { code: "PHOTO_LOAD_FAILED", message: "Não foi possível carregar a foto" } }, { status: 502 });
  }

  if (!response.ok) {
    return backendErrorResponse(response, { code: "PHOTO_LOAD_FAILED", message: "Não foi possível carregar a foto" });
  }
  if (!/^image\/jpeg\s*(;|$)/i.test(response.headers.get("Content-Type") ?? "") || !response.body) {
    await response.body?.cancel();
    return NextResponse.json({ error: { code: "PHOTO_LOAD_FAILED", message: "Não foi possível carregar a foto" } }, { status: 502 });
  }

  const length = response.headers.get("Content-Length");
  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(length ? { "Content-Length": length } : {}),
    },
  });
}

/** Conta os bytes que passam e aborta o fluxo ao passar do limite: protege contra `Content-Length` mentiroso ou ausente. */
export function limitBytes(source: ReadableStream<Uint8Array>, limit: number): ReadableStream<Uint8Array> {
  let total = 0;
  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > limit) controller.error(new Error("PHOTO_TOO_LARGE"));
        else controller.enqueue(chunk);
      },
    })
  );
}
