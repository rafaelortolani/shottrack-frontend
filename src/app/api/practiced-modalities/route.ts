import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF das modalidades praticadas: repassa o cookie de sessão como Bearer
 * pro backend.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { status, body } = await backendFetch("/api/practiced-modalities", { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PRACTICED_MODALITIES_FETCH_FAILED", message: "Não foi possível carregar as modalidades praticadas" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { modalityId } = await request.json();

  const { status, body } = await backendFetch("/api/practiced-modalities", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ modalityId }),
  });

  if (status !== 201 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PRACTICED_MODALITY_ADD_FAILED", message: "Não foi possível adicionar a modalidade" } },
      { status: status === 201 ? 422 : status }
    );
  }

  return NextResponse.json({ data: body.data }, { status: 201 });
}
