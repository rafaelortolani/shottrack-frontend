import { NextRequest, NextResponse } from "next/server";
import { backendFetch, retryAfterHeaders } from "@/lib/backend";
import { readJsonObject } from "@/lib/requestBody";

/**
 * BFF do pedido de redefinição de senha (FUC20): pública, não exige sessão.
 * O backend responde 202 exista a conta ou não — o 429 (rate limit,
 * ADR-0018) é repassado com o Retry-After.
 */
export async function POST(request: NextRequest) {
  const input = await readJsonObject(request);
  if (input instanceof NextResponse) return input;
  const { email } = input;

  const { status, body, retryAfter } = await backendFetch("/api/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  if (status !== 202 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PASSWORD_RESET_REQUEST_FAILED", message: "Não foi possível enviar o link" } },
      { status: status === 202 ? 422 : status, headers: retryAfterHeaders(status, retryAfter) }
    );
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
