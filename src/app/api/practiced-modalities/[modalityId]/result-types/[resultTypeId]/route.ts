import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ modalityId: string; resultTypeId: string }> }
) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { modalityId, resultTypeId } = await params;

  const { status, body } = await backendFetch(
    `/api/practiced-modalities/${modalityId}/result-types/${resultTypeId}`,
    { method: "DELETE", accessToken }
  );

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PRACTICED_MODALITY_RESULT_TYPE_REMOVE_FAILED", message: "Não foi possível remover o tipo de resultado" } },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
