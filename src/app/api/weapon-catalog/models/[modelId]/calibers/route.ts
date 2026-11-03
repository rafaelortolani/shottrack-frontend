import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { requireUuidParams } from "@/lib/routeParams";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
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
  const { modelId } = ids;

  const { status, body } = await backendFetch(`/api/weapon-catalog/models/${modelId}/calibers`, { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "WEAPON_MODEL_CALIBERS_FETCH_FAILED", message: "Não foi possível carregar os calibres" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
