import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

/** UC66: o plano do próprio atleta, os limites efetivos e o uso. */
export function GET(request: NextRequest) {
  return proxyToBackend(request, {
    method: "GET",
    path: "/api/users/me/plan",
    failure: { code: "MY_PLAN_FETCH_FAILED", message: "Não foi possível carregar o seu plano" },
  });
}
