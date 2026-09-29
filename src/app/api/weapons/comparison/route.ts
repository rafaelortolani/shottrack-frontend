import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

const PARAMS = ["modalityId", "resultTypeId", "startDate", "endDate"] as const;

/**
 * BFF da comparação entre armas (UC48): no backend é
 * GET /api/dashboard/weapon-comparison. weaponIds vai repetido na query
 * (weaponIds=a&weaponIds=b); o backend exige 2+ armas distintas e valida
 * modalidade, tipo de resultado e posse das armas.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const query = new URLSearchParams();
  for (const name of PARAMS) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) query.set(name, value);
  }
  for (const weaponId of request.nextUrl.searchParams.getAll("weaponIds")) {
    query.append("weaponIds", weaponId);
  }

  const { status, body } = await backendFetch(`/api/dashboard/weapon-comparison?${query}`, { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "WEAPON_COMPARISON_FAILED", message: "Não foi possível comparar as armas" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
