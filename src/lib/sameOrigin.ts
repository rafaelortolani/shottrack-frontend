import { NextRequest, NextResponse } from "next/server";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function forbidden() {
  return NextResponse.json(
    { error: { code: "FORBIDDEN_ORIGIN", message: "Origem da requisição não permitida" } },
    { status: 403 }
  );
}

/**
 * Defesa em profundidade contra CSRF no BFF (auditoria A05), aplicada pelo
 * `proxy.ts` a toda `/api/**` — o único ponto, vale pros handlers novos e antigos.
 * Só métodos não seguros são conferidos; devolve a resposta de bloqueio ou `null`.
 *
 * - `Sec-Fetch-Site` presente e diferente de `same-origin`/`none` → 403 (
 *   `same-site`: outro subdomínio não é a nossa origem);
 * - `Origin` presente e com host diferente do da requisição → 403 (inclui `Origin: null`);
 * - corpo que não seja `application/json` → 415 (formulário/`text/plain` cross-site
 *   são as requisições que o navegador envia sem preflight).
 * Cliente sem esses cabeçalhos (curl, testes de API) passa: o cookie `SameSite=lax` e o
 * backend continuam sendo as demais barreiras.
 */
/** Cabeçalho que o cliente de upload de fotos envia (FUC26). Formulário HTML cross-site não consegue enviar cabeçalho próprio. */
export const UPLOAD_HEADER = "x-shottrack-upload";

/**
 * Único caminho que aceita corpo multipart: `POST /api/series/{id}/photos` (foto do alvo, FUC26), e só com o
 * cabeçalho próprio acima, que garante requisição feita por script da nossa origem (um `<form>` cross-site
 * é a razão de o 415 existir). Origin e Sec-Fetch-Site continuam conferidos antes.
 */
function isPhotoUpload(request: NextRequest, contentType: string): boolean {
  return (
    request.method === "POST" &&
    /^\/api\/series\/[^/]+\/photos$/.test(request.nextUrl.pathname) &&
    /^multipart\/form-data\s*;/i.test(contentType) &&
    request.headers.get(UPLOAD_HEADER) === "1"
  );
}

export function rejectUnsafeCrossOrigin(request: NextRequest): NextResponse | null {
  if (!UNSAFE_METHODS.has(request.method)) return null;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return forbidden();

  const origin = request.headers.get("origin");
  if (origin) {
    const allowedHosts = [request.headers.get("host"), request.headers.get("x-forwarded-host")];
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // Origin malformado ou "null": cai no bloqueio abaixo
    }
    if (!originHost || !allowedHosts.includes(originHost)) return forbidden();
  }

  const hasBody =
    request.headers.has("transfer-encoding") || Number(request.headers.get("content-length") ?? 0) > 0;
  const contentType = request.headers.get("content-type") ?? "";
  if (hasBody && !/^application\/json\s*(;|$)/i.test(contentType) && !isPhotoUpload(request, contentType)) {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "O corpo da requisição deve ser application/json" } },
      { status: 415 }
    );
  }

  return null;
}
