import { NextRequest, NextResponse } from "next/server";

/**
 * Protege as rotas autenticadas: sem cookie de sessão, redireciona pro login.
 * A validação real do token acontece no backend a cada chamada — isso aqui
 * é só a primeira barreira, pra não renderizar a tela antes de checar.
 */
const PROTECTED_PATHS = ["/dashboard", "/usuario", "/acervo"];

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("shottrack_access");
  const isProtected = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!hasSession && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/usuario/:path*", "/acervo/:path*"],
};
