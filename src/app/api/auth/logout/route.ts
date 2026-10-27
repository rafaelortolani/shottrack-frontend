import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * Logout (UC51/ADR-0018): revoga o refresh token no backend e SÓ DEPOIS
 * limpa os cookies. Se o backend falhar (fora do ar, resposta inesperada),
 * os cookies são limpos mesmo assim — o atleta sai normalmente.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("shottrack_refresh")?.value;

  if (refreshToken) {
    try {
      await backendFetch("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // sessão local encerra de qualquer jeito
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete("shottrack_access");
  response.cookies.delete("shottrack_refresh");
  return response;
}
