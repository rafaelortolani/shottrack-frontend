import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF de confirmação de troca de email: repassa o cookie de sessão como
 * Bearer pro backend, que valida o código de 6 dígitos e efetiva a troca.
 */
export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { code } = await request.json();

  const { status, body } = await backendFetch("/api/users/me/email/confirmation", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ code }),
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "EMAIL_CHANGE_CONFIRMATION_FAILED", message: "Não foi possível confirmar a troca de email" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
