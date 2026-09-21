import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF do catálogo de tipos de resultado (UC29): repassa o cookie de sessão
 * como Bearer pro backend.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { status, body } = await backendFetch("/api/result-type-catalog", { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "RESULT_TYPE_CATALOG_FETCH_FAILED", message: "Não foi possível carregar o catálogo de tipos de resultado" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
