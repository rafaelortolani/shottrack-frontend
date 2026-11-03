import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { requireUuidParams } from "@/lib/routeParams";
import { readJsonObject } from "@/lib/requestBody";

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

  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  const { id: accessoryId } = ids;
  const input = await readJsonObject(request);
  if (input instanceof NextResponse) return input;
  const { weaponId } = input;

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
