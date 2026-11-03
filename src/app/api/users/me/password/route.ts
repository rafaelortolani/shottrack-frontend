import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { readJsonObject } from "@/lib/requestBody";
import { clearSessionCookies } from "@/lib/sessionCookies";

/**
 * BFF de troca de senha: repassa o cookie de sessão como Authorization
 * Bearer pro backend, que valida a senha atual antes de aceitar a nova.
 */
export async function PATCH(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const input = await readJsonObject(request);
  if (input instanceof NextResponse) return input;
  const { currentPassword, newPassword } = input;

  const { status, body } = await backendFetch("/api/users/me/password", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PASSWORD_CHANGE_FAILED", message: "Não foi possível alterar a senha" } },
      { status }
    );
  }

  // O backend revogou todas as sessões (ADR-0018): limpa os cookies também.
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
