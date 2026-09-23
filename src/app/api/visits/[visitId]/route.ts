import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * UC44: exclui a visita e, em cascata, os treinos dela e as séries de
 * cada um — sem bloqueio por status (pode excluir visita em andamento).
 */
export async function DELETE(
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

  const { visitId } = await params;

  const { status, body } = await backendFetch(`/api/visits/${visitId}`, {
    method: "DELETE",
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "VISIT_DELETE_FAILED", message: "Não foi possível excluir a visita" } },
      { status }
    );
  }

  return NextResponse.json({ data: null });
}
