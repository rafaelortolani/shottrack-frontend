import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

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

  const { id } = await params;
  const { modelId, caliberId, nickname } = await request.json();

  const { status, body } = await backendFetch(`/api/weapons/${id}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify({ modelId, caliberId, nickname }),
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "WEAPON_UPDATE_FAILED", message: "Não foi possível salvar as alterações" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
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

  const { id } = await params;

  const { status, body } = await backendFetch(`/api/weapons/${id}`, {
    method: "DELETE",
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "WEAPON_DELETE_FAILED", message: "Não foi possível excluir a arma" } },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
