import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ modalityId: string }> }
) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { modalityId } = await params;

  const { status, body } = await backendFetch(`/api/practiced-modalities/${modalityId}`, {
    method: "DELETE",
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PRACTICED_MODALITY_REMOVE_FAILED", message: "Não foi possível remover a modalidade" } },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
