import { NextRequest, NextResponse } from "next/server";
import { backendRawFetch, retryAfterHeaders } from "@/lib/backend";
import { readJsonObject } from "@/lib/requestBody";

/**
 * BFF da exportação de dados (FUC21/UC53): a exportação exige a senha atual
 * (POST, `currentPassword` repassada e nunca logada). Repassa o arquivo JSON do
 * backend com o Content-Disposition, pro navegador baixar, sempre `no-store`.
 * Em erro, devolve o envelope de erro (INVALID_CURRENT_PASSWORD, 429 com Retry-After).
 */
export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const input = await readJsonObject(request);
  if (input instanceof NextResponse) return input;
  const { currentPassword } = input;

  const backendResponse = await backendRawFetch("/api/users/me/export", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ currentPassword }),
  });

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
