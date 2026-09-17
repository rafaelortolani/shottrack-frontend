import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF de conclusão de cadastro (FUC10): troca o token do link (nome + senha)
 * por uma conta de verdade. Login continua sendo uma etapa separada — aqui
 * não há token de sessão pra guardar.
 */
export async function POST(request: NextRequest) {
  const { token, name, password } = await request.json();

  const { status, body } = await backendFetch("/api/users/registration/completion", {
    method: "POST",
    body: JSON.stringify({ token, name, password }),
  });

  if (status !== 201 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "REGISTRATION_COMPLETION_FAILED", message: "Não foi possível concluir o cadastro" } },
      { status: status === 201 ? 422 : status }
    );
  }

  return NextResponse.json({ data: body.data }, { status: 201 });
}
