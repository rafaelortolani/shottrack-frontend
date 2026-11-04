import { NextRequest, NextResponse } from "next/server";
import { backendRawFetch } from "@/lib/backend";
import { accessTokenOf, backendErrorResponse, unauthenticated } from "@/lib/photoProxy";
import { requireUuidParams } from "@/lib/routeParams";

/** UC62: remove a foto (o backend responde 204 sem corpo). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const accessToken = accessTokenOf(request);
  if (!accessToken) return unauthenticated();

  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;

  try {
    const response = await backendRawFetch(`/api/series/${ids.id}/photos/${ids.photoId}`, { method: "DELETE", accessToken });
    if (!response.ok) {
      return backendErrorResponse(response, { code: "PHOTO_DELETE_FAILED", message: "Não foi possível excluir a foto" });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: { code: "PHOTO_DELETE_FAILED", message: "Não foi possível excluir a foto" } }, { status: 502 });
  }
}
