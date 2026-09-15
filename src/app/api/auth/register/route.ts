import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF de cadastro: cria o usuário no backend. Diferente do login, não há
 * token pra guardar — só confirma sucesso ou repassa o erro do backend
 * (ex: EMAIL_ALREADY_REGISTERED).
 */
export async function POST(request: NextRequest) {
  const { name, email, password } = await request.json();

  const { status, body } = await backendFetch("/api/users", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });

  if (status !== 201 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "REGISTER_FAILED", message: "Não foi possível criar a conta" } },
      { status: status === 201 ? 422 : status }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
