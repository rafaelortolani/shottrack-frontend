import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function POST(
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

  const { id: accessoryId } = await params;
  const { weaponId } = await request.json();

  const { status, body } = await backendFetch(`/api/accessories/${accessoryId}/weapons`, {
    method: "POST",
    accessToken,
    body: JSON.stringify({ weaponId }),
  });

  if (status !== 201 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "ACCESSORY_WEAPON_ASSOCIATE_FAILED", message: "Não foi possível associar a arma" } },
      { status: status === 201 ? 422 : status }
    );
  }

  return NextResponse.json({ data: body.data }, { status: 201 });
}
