import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/bffProxy";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, {
    method: "GET",
    path: `/api/admin/habituality/rules/${encodeURIComponent(id)}/versions`,
    admin: true,
    failure: { code: "HABITUALITY_VERSIONS_FETCH_FAILED", message: "Não foi possível carregar as versões" },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, {
    method: "POST",
    path: `/api/admin/habituality/rules/${encodeURIComponent(id)}/versions`,
    admin: true,
    forwardBody: true,
    failure: { code: "HABITUALITY_VERSION_CREATE_FAILED", message: "Não foi possível criar a versão" },
  });
}
