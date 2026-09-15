import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

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

  const { currentPassword, newPassword } = await request.json();

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

  return NextResponse.json({ ok: true });
}
