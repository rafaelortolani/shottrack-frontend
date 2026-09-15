import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF do catálogo de modalidades: repassa o cookie de sessão como Bearer
 * pro backend (catálogo fixo, mas exige autenticação — ver FUC06/ADR-0005).
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { status, body } = await backendFetch("/api/modality-catalog", { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "MODALITY_CATALOG_FETCH_FAILED", message: "Não foi possível carregar o catálogo de modalidades" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
