import { NextResponse } from "next/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parâmetro de rota que vai para o caminho do backend precisa ser UUID: o Next
 * decodifica `..%2F` e `%3F` antes de entregar o parâmetro, e colado cru no
 * caminho ele faria o BFF chamar qualquer rota do backend (auditoria A02).
 * Devolve o valor já codificado (`encodeURIComponent`) ou a resposta 400.
 */
export function requireUuid(value: string): string | NextResponse {
  if (!UUID.test(value)) {
    return NextResponse.json(
      { error: { code: "INVALID_PARAMETER", message: "Identificador inválido" } },
      { status: 400 }
    );
  }
  return encodeURIComponent(value);
}

/**
 * Valida todos os parâmetros de uma rota de uma vez:
 *
 *   const ids = requireUuidParams(await params);
 *   if (ids instanceof NextResponse) return ids;
 *   const { id } = ids; // pode ser colado no caminho do backend
 */
export function requireUuidParams<T extends Record<string, string>>(params: T): T | NextResponse {
  const validated: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    const uuid = requireUuid(value);
    if (uuid instanceof NextResponse) return uuid;
    validated[name] = uuid;
  }
  return validated as T;
}
