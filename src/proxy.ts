import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { buildCsp, createNonce, CSP_HEADER } from "@/lib/csp";
import { rejectUnsafeCrossOrigin } from "@/lib/sameOrigin";

/**
 * Protege as rotas autenticadas: sem cookie de sessão, redireciona pro login.
 * A validação real do token acontece no backend a cada chamada — isso aqui
 * é só a primeira barreira, pra não renderizar a tela antes de checar.
 *
 * `/admin/**` vai além (ADR-0021): quem está logado mas não é ADMIN volta pro
 * dashboard, sem ver a página. O papel só é conferido nessas rotas — consulta
 * o backend a cada navegação ao módulo, o que não pesa nas demais telas.
 *
 * `/api/**` passa só pela checagem de origem dos métodos de escrita (A05, ver
 * `sameOrigin.ts`); a sessão continua sendo conferida em cada Route Handler.
 * Toda página recebe a CSP em modo relatório com nonce (A03, ver `csp.ts`).
 */
const PROTECTED_PATHS = ["/dashboard", "/boas-vindas", "/usuario", "/acervo", "/treinos", "/admin"];

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** "admin" | "anonymous" (sessão inválida/expirada) | "denied" (logado, mas não é admin ou não deu pra checar) */
async function checkAdmin(accessToken: string): Promise<"admin" | "anonymous" | "denied"> {
  try {
    const { status, body } = await backendFetch("/api/users/me", { accessToken });
    if (status === 401) return "anonymous";
    return status === 200 && body.data?.role === "ADMIN" ? "admin" : "denied";
  } catch {
    return "denied"; // na dúvida, nega — o backend continua sendo a autoridade
  }
}

/** Segue a requisição com a CSP (modo relatório) e o nonce que o Next aplica nos scripts. */
function nextWithCsp(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // O Next extrai o nonce do cabeçalho de CSP da requisição (inclusive o de relatório)
  requestHeaders.set(CSP_HEADER, csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) return rejectUnsafeCrossOrigin(request) ?? NextResponse.next();

  const accessToken = request.cookies.get("shottrack_access")?.value;
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (!accessToken && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (accessToken && isAdminPath(pathname)) {
    const access = await checkAdmin(accessToken);
    if (access === "anonymous") return NextResponse.redirect(new URL("/login", request.url));
    if (access === "denied") return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return nextWithCsp(request);
}

export const config = {
  // /api: checagem de origem (A05). Páginas: CSP com nonce (A03) e proteção de sessão. Ficam de fora
  // arquivos estáticos, o service worker, o manifest e o túnel do Sentry (/monitoring), que não
  // devem passar por aqui.
  matcher: [
    "/api/:path*",
    "/((?!api|monitoring|_next/static|_next/image|icons/|sw\\.js|favicon\\.ico|icon\\.svg|manifest\\.webmanifest).*)",
  ],
};
