import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF de solicitação de cadastro (FUC01): repassa só o email pro backend,
 * que envia o link de confirmação por email — não há token de sessão pra
 * guardar aqui ainda (só existe depois de completar o cadastro, FUC10).
 */
export async function POST(request: NextRequest) {
  const { email } = await request.json();

  const { status, body } = await backendFetch("/api/users/registration", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  if (status !== 202 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "REGISTRATION_REQUEST_FAILED", message: "Não foi possível solicitar o cadastro" } },
      { status: status === 202 ? 422 : status }
    );
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
