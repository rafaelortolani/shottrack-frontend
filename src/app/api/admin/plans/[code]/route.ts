import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";
import { requirePlanCode } from "@/lib/routeParams";

/** UC69: nome, ativo e padrão (edição parcial). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = requirePlanCode((await params).code);
  if (code instanceof NextResponse) return code;
  return proxyToBackend(request, {
    method: "PATCH",
    path: `/api/admin/plans/${code}`,
    admin: true,
    forwardBody: true,
    failure: { code: "PLAN_UPDATE_FAILED", message: "Não foi possível salvar o plano" },
  });
}
