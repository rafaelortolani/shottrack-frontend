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
  const { name, city, state } = await request.json();

  const { status, body } = await backendFetch(`/api/training-locations/${id}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify({ name, city, state }),
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "TRAINING_LOCATION_UPDATE_FAILED", message: "Não foi possível salvar as alterações" } },
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

  const { status, body } = await backendFetch(`/api/training-locations/${id}`, {
    method: "DELETE",
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "TRAINING_LOCATION_DELETE_FAILED", message: "Não foi possível excluir o local de treino" } },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
