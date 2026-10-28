import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

/** Definir a meta pessoal de treinos no ano (UC58). */
export function PUT(request: NextRequest) {
  return proxyToBackend(request, {
    method: "PUT",
    path: "/api/habituality/personal-goal",
    forwardBody: true,
    failure: { code: "PERSONAL_GOAL_FAILED", message: "Não foi possível salvar a meta" },
  });
}

/** Remover a meta pessoal (UC58). */
export function DELETE(request: NextRequest) {
  return proxyToBackend(request, {
    method: "DELETE",
    path: "/api/habituality/personal-goal",
    failure: { code: "PERSONAL_GOAL_DELETE_FAILED", message: "Não foi possível remover a meta" },
  });
}
