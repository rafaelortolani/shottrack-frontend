import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { requireUuidParams } from "@/lib/routeParams";
import { readJsonObject } from "@/lib/requestBody";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  const { id } = ids;
  const input = await readJsonObject(request);
  if (input instanceof NextResponse) return input;
  const body = input;

  const { status, body: responseBody } = await backendFetch(`/api/series/${id}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });

  if (status !== 200 || responseBody.error) {
    return NextResponse.json(
      { error: responseBody.error ?? { code: "SERIES_UPDATE_FAILED", message: "Não foi possível salvar as alterações" } },
      { status }
    );
  }

  return NextResponse.json({ data: responseBody.data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const ids = requireUuidParams(await params);
  if (ids instanceof NextResponse) return ids;
  const { id } = ids;

  const { status, body } = await backendFetch(`/api/series/${id}`, {
    method: "DELETE",
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "SERIES_DELETE_FAILED", message: "Não foi possível excluir a série" } },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
