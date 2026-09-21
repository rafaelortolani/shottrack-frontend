import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function PATCH(
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

  const { id } = await params;

  // O backend expõe isso como POST /api/trainings/{id}/closure (UC33) —
  // essa Route Handler usa PATCH .../close pro cliente, mas repassa pro
  // endpoint real do backend.
  const { status, body } = await backendFetch(`/api/trainings/${id}/closure`, {
    method: "POST",
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "TRAINING_CLOSE_FAILED", message: "Não foi possível encerrar o treino" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
