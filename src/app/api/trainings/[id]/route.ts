import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { requireUuidParams } from "@/lib/routeParams";

/**
 * UC43: exclui o treino e, em cascata, as séries dele — sem bloqueio por
 * status (pode excluir treino em andamento).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
  const { id } = ids;

  const { status, body } = await backendFetch(`/api/trainings/${id}`, {
    method: "DELETE",
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "TRAINING_DELETE_FAILED", message: "Não foi possível excluir o treino" } },
      { status }
    );
  }

  return NextResponse.json({ data: null });
}
