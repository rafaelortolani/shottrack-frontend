import { NextRequest, NextResponse } from "next/server";
import { backendFetch, retryAfterHeaders } from "@/lib/backend";
import { readJsonObject } from "@/lib/requestBody";

/**
 * BFF de solicitação de troca de email: repassa o cookie de sessão como
 * Bearer pro backend, que confere a senha atual (INVALID_CURRENT_PASSWORD, 401)
 * e envia o código de verificação pro email novo (login continua com o email
 * antigo até a confirmação — ver FUC04). A senha só é repassada, nunca logada.
 * O backend responde 202; o 429 (com Retry-After) também é repassado.
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
  const { email, currentPassword } = input;

  const { status, body, retryAfter } = await backendFetch("/api/users/me/email", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ email, currentPassword }),
  });

  if (status >= 300 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "EMAIL_CHANGE_REQUEST_FAILED", message: "Não foi possível solicitar a troca de email" } },
      { status: status >= 300 ? status : 422, headers: retryAfterHeaders(status, retryAfter) }
    );
  }

  return NextResponse.json({ ok: true });
}
