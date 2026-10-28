import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

/** Progresso de habitualidade do atleta (UC57). */
export function GET(request: NextRequest) {
  return proxyToBackend(request, {
    method: "GET",
    path: "/api/habituality/progress",
    failure: { code: "HABITUALITY_PROGRESS_FETCH_FAILED", message: "Não foi possível carregar a habitualidade" },
  });
}
