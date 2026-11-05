import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

/** UC63: planos e limites. */
export function GET(request: NextRequest) {
  return proxyToBackend(request, {
    method: "GET",
    path: "/api/admin/plans",
    admin: true,
    failure: { code: "PLANS_FETCH_FAILED", message: "Não foi possível carregar os planos" },
  });
}

/** UC68: criar plano. */
export function POST(request: NextRequest) {
  return proxyToBackend(request, {
    method: "POST",
    path: "/api/admin/plans",
    admin: true,
    forwardBody: true,
    failure: { code: "PLAN_CREATE_FAILED", message: "Não foi possível criar o plano" },
  });
}
