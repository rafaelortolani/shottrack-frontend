import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

/** Edita a regra, inclusive ativar/desativar (UC54). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, {
    method: "PUT",
    path: `/api/admin/habituality/rules/${encodeURIComponent(id)}`,
    admin: true,
    forwardBody: true,
    failure: { code: "HABITUALITY_RULE_UPDATE_FAILED", message: "Não foi possível salvar a regra" },
  });
}
