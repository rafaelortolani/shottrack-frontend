import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";
import { requirePlanCode } from "@/lib/routeParams";

/** UC64: edição parcial e atômica dos limites do plano. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = requirePlanCode((await params).code);
  if (code instanceof NextResponse) return code;
  return proxyToBackend(request, {
    method: "PATCH",
    path: `/api/admin/plans/${code}/limits`,
    admin: true,
    forwardBody: true,
    failure: { code: "PLAN_LIMITS_UPDATE_FAILED", message: "Não foi possível salvar os limites" },
  });
}
