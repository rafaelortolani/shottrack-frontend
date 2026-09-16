import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; weaponId: string }> }
) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { id: accessoryId, weaponId } = await params;

  const { status, body } = await backendFetch(`/api/accessories/${accessoryId}/weapons/${weaponId}`, {
    method: "DELETE",
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "ACCESSORY_WEAPON_DISSOCIATE_FAILED", message: "Não foi possível desassociar a arma" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
