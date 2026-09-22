import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF de login: recebe email/senha do formulário, chama o backend, e
 * guarda o access/refresh token num cookie httpOnly — o navegador nunca
 * vê o JWT (ver ADR-0001 do backend, pendência de armazenamento resolvida
 * aqui).
 */
export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const { status, body } = await backendFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "LOGIN_FAILED", message: "Não foi possível entrar" } },
      { status: status === 200 ? 401 : status }
    );
  }

  const { accessToken, refreshToken } = body.data;
  const response = NextResponse.json({ ok: true, landing: await resolveLanding(accessToken) });

  response.cookies.set("shottrack_access", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1h, alinhado ao access token (ADR-0001)
  });
  response.cookies.set("shottrack_refresh", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });

  return response;
}

/**
 * FUC15: com visita em andamento, o atleta cai direto em Visitas (onde a
 * visita ativa aparece no topo); sem visita — ou se a consulta falhar —
 * cai no Dashboard, como antes. Resolvido aqui porque o token recém-emitido
 * já está em mãos, sem ida e volta extra do navegador.
 */
async function resolveLanding(accessToken: string): Promise<string> {
  const { status, body } = await backendFetch("/api/visits", { accessToken });
  const hasActiveVisit =
    status === 200 && body.data?.some((visit: { status: string }) => visit.status === "IN_PROGRESS");
  return hasActiveVisit ? "/treinos/visitas" : "/dashboard";
}
