import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resultTypeId: string }> }
) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { id, resultTypeId } = await params;

  const { status, body } = await backendFetch(`/api/series/${id}/results/${resultTypeId}`, {
    method: "DELETE",
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "SERIES_RESULT_REMOVE_FAILED", message: "Não foi possível remover o resultado" } },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
