import { NextRequest, NextResponse } from "next/server";
import { backendFetch, retryAfterHeaders } from "@/lib/backend";
import { clearSessionCookies, setSessionCookies } from "@/lib/sessionCookies";
import { renewSession } from "@/lib/sessionRefresh";

/**
 * Renovação de sessão (A07): troca o refresh token do cookie (que só chega aqui, Path=/api/auth) por um novo
 * par e regrava os dois cookies. Nunca devolve token no corpo nem em erro. Refresh recusado pelo backend
 * (401) encerra a sessão local; falha de rede/backend mantém os cookies, para tentar de novo depois.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("shottrack_refresh")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } }, { status: 401 });
  }

  let retryAfter: string | null = null;
  const outcome = await renewSession(refreshToken, async (token) => {
    const result = await backendFetch("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: token }) });
    retryAfter = result.retryAfter;
    return { status: result.status, body: result.body };
  });

  if (!outcome.ok) {
    const status = outcome.unauthorized ? 401 : outcome.status === 429 ? 429 : 502;
    const response = NextResponse.json(
      { error: { code: outcome.unauthorized ? "UNAUTHENTICATED" : "REFRESH_FAILED", message: outcome.unauthorized ? "Sessão expirada" : "Não foi possível renovar a sessão" } },
      { status, headers: retryAfterHeaders(status, retryAfter) }
    );
    if (outcome.unauthorized) clearSessionCookies(response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  setSessionCookies(response, outcome.accessToken, outcome.refreshToken);
  return response;
}
