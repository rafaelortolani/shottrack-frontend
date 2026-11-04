import { NextRequest, NextResponse } from "next/server";
import { backendRawFetch } from "@/lib/backend";
import { proxyToBackend } from "@/lib/bffProxy";
import {
  accessTokenOf,
  backendErrorResponse,
  limitBytes,
  MAX_UPLOAD_BYTES,
  photoTooLarge,
  unauthenticated,
} from "@/lib/photoProxy";
import { requireUuidParams } from "@/lib/routeParams";
import { rejectUnsafeCrossOrigin } from "@/lib/sameOrigin";

type Context = { params: Promise<{ id: string }> };

/** UC61: metadados das fotos da série. */
export async function GET(request: NextRequest, { params }: Context) {
  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  return proxyToBackend(request, {
    method: "GET",
    path: `/api/series/${ids.id}/photos`,
    failure: { code: "PHOTOS_LOAD_FAILED", message: "Não foi possível carregar as fotos" },
  });
}

/**
 * UC60: anexa uma foto. O corpo multipart é repassado em streaming (esta rota fica fora do matcher do
 * `proxy.ts`, que guardaria o corpo em memória); por isso a checagem de origem é feita aqui.
 */
export async function POST(request: NextRequest, { params }: Context) {
  const blocked = rejectUnsafeCrossOrigin(request);
  if (blocked) return blocked;

  const accessToken = accessTokenOf(request);
  if (!accessToken) return unauthenticated();

  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;

  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !request.body) {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Envie a foto como multipart/form-data" } },
      { status: 415 }
    );
  }

  const declared = request.headers.get("content-length");
  if (declared === null) {
    return NextResponse.json({ error: { code: "LENGTH_REQUIRED", message: "Tamanho do envio não informado" } }, { status: 411 });
  }
  if (!/^\d+$/.test(declared) || Number(declared) > MAX_UPLOAD_BYTES) return photoTooLarge();

  try {
    const response = await backendRawFetch(`/api/series/${ids.id}/photos`, {
      method: "POST",
      accessToken,
      headers: { "Content-Type": contentType, "Content-Length": declared },
      body: limitBytes(request.body, MAX_UPLOAD_BYTES),
      // corpo em stream exige `duplex` (undici); não está nos tipos do RequestInit do DOM
      duplex: "half",
    } as RequestInit & { accessToken: string });

    if (!response.ok) {
      return backendErrorResponse(response, { code: "PHOTO_UPLOAD_FAILED", message: "Não foi possível enviar a foto" });
    }
    const body = await response.json().catch(() => null);
    return NextResponse.json({ data: body?.data ?? null }, { status: response.status });
  } catch (error) {
    if (error instanceof Error && (error.message === "PHOTO_TOO_LARGE" || error.cause instanceof Error && error.cause.message === "PHOTO_TOO_LARGE")) {
      return photoTooLarge();
    }
    return NextResponse.json({ error: { code: "PHOTO_UPLOAD_FAILED", message: "Não foi possível enviar a foto" } }, { status: 502 });
  }
}
