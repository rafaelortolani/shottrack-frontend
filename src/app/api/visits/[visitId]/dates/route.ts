import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";
import { requireUuidParams } from "@/lib/routeParams";

/** UC59: edita início e/ou fim da visita (em andamento, só o início). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  const { visitId } = ids;
  return proxyToBackend(request, {
    method: "PATCH",
    path: `/api/visits/${visitId}/dates`,
    forwardBody: true,
    failure: { code: "VISIT_DATES_UPDATE_FAILED", message: "Não foi possível salvar as datas da visita" },
  });
}
