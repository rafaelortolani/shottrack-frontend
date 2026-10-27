import { NextRequest, NextResponse } from "next/server";
import { backendRawFetch, retryAfterHeaders } from "@/lib/backend";

/**
 * BFF da exportação de dados (FUC21/UC53): repassa o arquivo JSON do
 * backend com o Content-Disposition, pro navegador baixar. Em erro, devolve
 * o envelope de erro (incluindo 429 com Retry-After).
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const backendResponse = await backendRawFetch("/api/users/me/export", { accessToken });

  if (!backendResponse.ok) {
    const body = await backendResponse.json().catch(() => null);
    return NextResponse.json(
      { error: body?.error ?? { code: "DATA_EXPORT_FAILED", message: "Não foi possível baixar seus dados" } },
      {
        status: backendResponse.status,
        headers: retryAfterHeaders(backendResponse.status, backendResponse.headers.get("Retry-After")),
      }
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const disposition = backendResponse.headers.get("Content-Disposition");
  if (disposition) headers["Content-Disposition"] = disposition;

  return new NextResponse(backendResponse.body, { status: 200, headers });
}
