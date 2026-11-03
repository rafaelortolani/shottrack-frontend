import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { readJsonObject } from "@/lib/requestBody";

/**
 * BFF de solicitação de troca de email: repassa o cookie de sessão como
 * Bearer pro backend, que envia o código de verificação pro email novo
 * (login continua com o email antigo até a confirmação — ver FUC04).
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
  const { email } = input;

  const { status, body } = await backendFetch("/api/users/me/email", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ email }),
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "EMAIL_CHANGE_REQUEST_FAILED", message: "Não foi possível solicitar a troca de email" } },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
