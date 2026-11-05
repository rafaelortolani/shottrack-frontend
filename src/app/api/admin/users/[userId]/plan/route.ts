import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";
import { requireUuidParams } from "@/lib/routeParams";

/** UC65: altera o plano do atleta. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  return proxyToBackend(request, {
    method: "PUT",
    path: `/api/admin/users/${ids.userId}/plan`,
    admin: true,
    forwardBody: true,
    failure: { code: "USER_PLAN_UPDATE_FAILED", message: "Não foi possível alterar o plano" },
  });
}
