import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

/**
 * Confirma que a sessão atual é de administrador (ADR-0021). Não expõe dado
 * nenhum: é o handler mínimo que exercita o `requireAdmin` — 401 sem sessão,
 * 403 pra atleta comum, 200 pra ADMIN. Os handlers de administração de
 * verdade seguem o mesmo começo.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  return NextResponse.json({ data: { role: "ADMIN" } });
}
