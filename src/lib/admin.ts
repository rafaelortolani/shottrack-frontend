import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export type UserRole = "USER" | "ADMIN";

/**
 * Guarda dos Route Handlers de administração (ADR-0021). TODO handler em
 * `src/app/api/admin/**` começa por aqui:
 *
 *   const admin = await requireAdmin(request);
 *   if (admin instanceof NextResponse) return admin;
 *   // ...chama o backend com admin.accessToken e repassa status/erro, inclusive o 403
 *
 * Consulta `/api/users/me` e nega quando `role !== "ADMIN"`. É só pra evitar
 * chamada inútil: quem decide de verdade é o backend, que confere o papel no
 * banco a cada requisição a `/api/admin/**` e devolve 401/403 por conta própria.
 */
export async function requireAdmin(request: NextRequest): Promise<{ accessToken: string } | NextResponse> {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { status, body } = await backendFetch("/api/users/me", { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PROFILE_FETCH_FAILED", message: "Não foi possível verificar o acesso" } },
      { status: status === 200 ? 502 : status }
    );
  }

  if (body.data?.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Você não tem permissão para acessar este recurso" } },
      { status: 403 }
    );
  }

  return { accessToken };
}
