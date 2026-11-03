import { NextRequest, NextResponse } from "next/server";

/**
 * Lê o corpo JSON de uma requisição ao BFF. Corpo ausente, malformado ou que
 * não seja um objeto vira 400 (auditoria A10) — nunca 500:
 *
 *   const input = await readJsonObject(request);
 *   if (input instanceof NextResponse) return input;
 *   const { email } = input;
 */
export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  const parsed: unknown = await request.json().catch(() => null);

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Corpo da requisição inválido" } },
      { status: 400 }
    );
  }
  return parsed as Record<string, unknown>;
}
