import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

const PARAMS = ["modalityId", "resultTypeId", "period", "mode"] as const;

/**
 * BFF da evolução (UC46): repassa só os parâmetros conhecidos pro backend,
 * que valida período/modo e se modalidade/tipo pertencem ao atleta.
 * Período sem dado → lista vazia, não é erro.
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

  const { status, body } = await backendFetch(`/api/dashboard/evolution?${query}`, { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "EVOLUTION_FETCH_FAILED", message: "Não foi possível carregar a evolução" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
