import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

const PARAMS = ["startDate", "endDate", "modalityId", "weaponId", "minDistanceMeters", "maxDistanceMeters"] as const;

/**
 * BFF do histórico de séries (UC47): no backend é GET /api/series com
 * filtros opcionais e combináveis. Repassa só os parâmetros conhecidos —
 * o backend valida período e se modalidade/arma pertencem ao atleta.
 * Nenhuma série com esses filtros → lista vazia, não é erro.
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

  const { status, body } = await backendFetch(`/api/series?${query}`, { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "SERIES_HISTORY_FETCH_FAILED", message: "Não foi possível carregar o histórico" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
