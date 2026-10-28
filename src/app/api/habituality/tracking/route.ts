import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

/** Escolher ou trocar a regra e o nível acompanhados (UC56). */
export function PUT(request: NextRequest) {
  return proxyToBackend(request, {
    method: "PUT",
    path: "/api/habituality/tracking",
    forwardBody: true,
    failure: { code: "HABITUALITY_TRACKING_FAILED", message: "Não foi possível salvar o acompanhamento" },
  });
}

/** Parar de acompanhar (UC56). */
export function DELETE(request: NextRequest) {
  return proxyToBackend(request, {
    method: "DELETE",
    path: "/api/habituality/tracking",
    failure: { code: "HABITUALITY_TRACKING_DELETE_FAILED", message: "Não foi possível remover o acompanhamento" },
  });
}
