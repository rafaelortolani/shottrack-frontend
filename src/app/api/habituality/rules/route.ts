import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

/** Regras ativas com a versão vigente (UC56). */
export function GET(request: NextRequest) {
  return proxyToBackend(request, {
    method: "GET",
    path: "/api/habituality/rules",
    failure: { code: "HABITUALITY_RULES_FETCH_FAILED", message: "Não foi possível carregar as regras de habitualidade" },
  });
}
