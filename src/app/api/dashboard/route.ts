import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF do dashboard (UC42): repassa o cookie de sessão como Bearer pro
 * backend. Atleta sem dados recebe zeros/nulos e lista vazia — não é erro.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { status, body } = await backendFetch("/api/dashboard", { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "DASHBOARD_FETCH_FAILED", message: "Não foi possível carregar o dashboard" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
