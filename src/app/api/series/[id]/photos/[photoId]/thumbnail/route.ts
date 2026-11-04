import { NextRequest, NextResponse } from "next/server";
import { streamJpeg } from "@/lib/photoProxy";
import { requireUuidParams } from "@/lib/routeParams";

/** UC61: imagem (thumbnail) em streaming, sempre no-store. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  return streamJpeg(request, `/api/series/${ids.id}/photos/${ids.photoId}/thumbnail`);
}
