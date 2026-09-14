import { NextRequest, NextResponse } from "next/server";

/**
 * Protege as rotas autenticadas: sem cookie de sessão, redireciona pro login.
 * A validação real do token acontece no backend a cada chamada — isso aqui
 * é só a primeira barreira, pra não renderizar a tela antes de checar.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("shottrack_access");

  if (!hasSession && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
