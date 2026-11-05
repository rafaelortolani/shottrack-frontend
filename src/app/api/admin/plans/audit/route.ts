import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

/** UC67: histórico de alterações. `limit` é repassado só se for um inteiro de 1 a 200. */
export function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("limit");
  let query = "";
  if (raw !== null) {
    const limit = Number(raw);
    if (!/^\d{1,3}$/.test(raw) || limit < 1 || limit > 200) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMETER", message: "Limite inválido" } },
        { status: 400 }
      );
    }
    query = `?limit=${limit}`;
  }
  return proxyToBackend(request, {
    method: "GET",
    path: `/api/admin/plans/audit${query}`,
    admin: true,
    failure: { code: "PLAN_AUDIT_FETCH_FAILED", message: "Não foi possível carregar o histórico" },
  });
}
