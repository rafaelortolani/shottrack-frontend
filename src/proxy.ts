import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * Protege as rotas autenticadas: sem cookie de sessão, redireciona pro login.
 * A validação real do token acontece no backend a cada chamada — isso aqui
 * é só a primeira barreira, pra não renderizar a tela antes de checar.
 *
 * `/admin/**` vai além (ADR-0021): quem está logado mas não é ADMIN volta pro
 * dashboard, sem ver a página. O papel só é conferido nessas rotas — consulta
 * o backend a cada navegação ao módulo, o que não pesa nas demais telas.
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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

  return NextResponse.next();
}

export const config = {
  // Deve listar os mesmos prefixos de PROTECTED_PATHS (o matcher precisa ser literal).
  matcher: [
    "/dashboard/:path*",
    "/boas-vindas/:path*",
    "/usuario/:path*",
    "/acervo/:path*",
    "/treinos/:path*",
    "/admin/:path*",
  ],
};
