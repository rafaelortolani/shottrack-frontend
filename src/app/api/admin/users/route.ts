import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

/** UC65: busca de atleta por trecho do e-mail (mínimo de 3 caracteres, no máximo 10 resultados — regra do backend). */
export function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email") ?? "";
  if (email.length > 254) {
    return NextResponse.json(
      { error: { code: "INVALID_PARAMETER", message: "E-mail inválido" } },
      { status: 400 }
    );
  }
  return proxyToBackend(request, {
    method: "GET",
    path: `/api/admin/users?email=${encodeURIComponent(email)}`,
    admin: true,
    failure: { code: "ADMIN_USER_SEARCH_FAILED", message: "Não foi possível buscar o atleta" },
  });
}
