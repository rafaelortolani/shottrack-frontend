import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";
import { requireUuidParams } from "@/lib/routeParams";

type Context = { params: Promise<{ versionId: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  const { versionId } = ids;
  return proxyToBackend(request, {
    method: "PUT",
    path: `/api/admin/habituality/versions/${encodeURIComponent(versionId)}`,
    admin: true,
    forwardBody: true,
    failure: { code: "HABITUALITY_VERSION_UPDATE_FAILED", message: "Não foi possível salvar a versão" },
  });
}

/** Só versão futura pode ser removida (o backend confere). */
export async function DELETE(request: NextRequest, { params }: Context) {
  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  const { versionId } = ids;
  return proxyToBackend(request, {
    method: "DELETE",
    path: `/api/admin/habituality/versions/${encodeURIComponent(versionId)}`,
    admin: true,
    failure: { code: "HABITUALITY_VERSION_DELETE_FAILED", message: "Não foi possível remover a versão" },
  });
}
