import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { requireUuidParams } from "@/lib/routeParams";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  const { visitId } = ids;

  // O backend expõe isso como POST /api/visits/{id}/closure (UC34) — essa
  // Route Handler usa PATCH .../close pro cliente, mas repassa pro endpoint
  // real do backend.
  const { status, body } = await backendFetch(`/api/visits/${visitId}/closure`, {
    method: "POST",
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "VISIT_CLOSE_FAILED", message: "Não foi possível encerrar a visita" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
