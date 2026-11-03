import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";
import { requireUuidParams } from "@/lib/routeParams";

/** Edita a regra, inclusive ativar/desativar (UC54). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  const { id } = ids;
  return proxyToBackend(request, {
    method: "PUT",
    path: `/api/admin/habituality/rules/${encodeURIComponent(id)}`,
    admin: true,
    forwardBody: true,
    failure: { code: "HABITUALITY_RULE_UPDATE_FAILED", message: "Não foi possível salvar a regra" },
  });
}
