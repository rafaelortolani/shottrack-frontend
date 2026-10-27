import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF da redefinição de senha (FUC20): pública, não exige sessão — a
 * autorização é o token de uso único do link. Repassa status e erro do
 * backend (PASSWORD_RESET_TOKEN_INVALID / _EXPIRED / _ALREADY_USED).
 */
export async function POST(request: NextRequest) {
  const { token, newPassword } = await request.json();

  const { status, body } = await backendFetch("/api/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PASSWORD_RESET_FAILED", message: "Não foi possível redefinir a senha" } },
      { status: status === 200 ? 422 : status }
    );
  }

  return NextResponse.json({ ok: true });
}
