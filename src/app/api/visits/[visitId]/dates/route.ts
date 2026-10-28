import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

/** UC59: edita início e/ou fim da visita (em andamento, só o início). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  return proxyToBackend(request, {
    method: "PATCH",
    path: `/api/visits/${visitId}/dates`,
    forwardBody: true,
    failure: { code: "VISIT_DATES_UPDATE_FAILED", message: "Não foi possível salvar as datas da visita" },
  });
}
