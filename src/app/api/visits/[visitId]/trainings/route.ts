import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { requireUuidParams } from "@/lib/routeParams";
import { readJsonObject } from "@/lib/requestBody";

export async function POST(
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
  const input = await readJsonObject(request);
  if (input instanceof NextResponse) return input;
  const { modalityId } = input;

  // O backend expõe isso como POST /api/trainings (visitId vai no corpo,
  // UC32) — essa Route Handler aninha em /visits/{visitId}/trainings pro
  // cliente, mas repassa pro endpoint real do backend.
  const { status, body } = await backendFetch("/api/trainings", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ visitId, modalityId }),
  });

  if (status !== 201 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "TRAINING_OPEN_FAILED", message: "Não foi possível abrir o treino" } },
      { status: status === 201 ? 422 : status }
    );
  }

  return NextResponse.json({ data: body.data }, { status: 201 });
}
