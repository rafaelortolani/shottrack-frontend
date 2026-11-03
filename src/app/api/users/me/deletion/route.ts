import { NextRequest, NextResponse } from "next/server";
import { backendFetch, retryAfterHeaders } from "@/lib/backend";
import { readJsonObject } from "@/lib/requestBody";
import { clearSessionCookies } from "@/lib/sessionCookies";

/**
 * BFF da exclusão de conta (FUC21/UC52): confirma com a senha atual. Em
 * sucesso o backend já apagou tudo e revogou as sessões — o BFF só limpa os
 * cookies. INVALID_CURRENT_PASSWORD e o 429 (com Retry-After) são repassados.
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
  const { password } = input;

  const { status, body, retryAfter } = await backendFetch("/api/users/me/deletion", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ password }),
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "ACCOUNT_DELETION_FAILED", message: "Não foi possível excluir a conta" } },
      { status: status === 200 ? 422 : status, headers: retryAfterHeaders(status, retryAfter) }
    );
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
