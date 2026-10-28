import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

export function GET(request: NextRequest) {
  return proxyToBackend(request, {
    method: "GET",
    path: "/api/admin/habituality/rules",
    admin: true,
    failure: { code: "HABITUALITY_RULES_FETCH_FAILED", message: "Não foi possível carregar as regras" },
  });
}

export function POST(request: NextRequest) {
  return proxyToBackend(request, {
    method: "POST",
    path: "/api/admin/habituality/rules",
    admin: true,
    forwardBody: true,
    failure: { code: "HABITUALITY_RULE_CREATE_FAILED", message: "Não foi possível criar a regra" },
  });
}
