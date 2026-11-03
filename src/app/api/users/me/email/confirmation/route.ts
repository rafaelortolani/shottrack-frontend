import { NextRequest, NextResponse } from "next/server";
import { backendFetch, retryAfterHeaders } from "@/lib/backend";
import { readJsonObject } from "@/lib/requestBody";
import { clearSessionCookies } from "@/lib/sessionCookies";

/**
 * BFF de confirmação de troca de email: repassa o cookie de sessão como
 * Bearer pro backend, que valida o código de 6 dígitos e efetiva a troca.
 * Ao efetivar, o backend revoga todas as sessões (como na troca de senha):
 * o BFF limpa os cookies também, e a tela leva o atleta ao login.
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
  const { code } = input;

  const { status, body, retryAfter } = await backendFetch("/api/users/me/email/confirmation", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ code }),
  });

  if (status >= 300 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "EMAIL_CHANGE_CONFIRMATION_FAILED", message: "Não foi possível confirmar a troca de email" } },
      { status: status >= 300 ? status : 422, headers: retryAfterHeaders(status, retryAfter) }
    );
  }

  const response = NextResponse.json({ data: body.data });
  clearSessionCookies(response);
  return response;
}
