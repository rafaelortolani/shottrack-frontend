import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { brandId } = await params;

  const { status, body } = await backendFetch(`/api/weapon-catalog/brands/${brandId}/models`, { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "WEAPON_MODELS_FETCH_FAILED", message: "Não foi possível carregar os modelos" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
