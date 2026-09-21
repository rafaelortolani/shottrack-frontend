import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF do perfil de modalidade (UC30): repassa o cookie de sessão como
 * Bearer pro backend. O GET já reflete a sugestão padrão aplicada
 * automaticamente pelo backend na primeira consulta (ADR-0011) — esta
 * Route Handler não decide nada, só repassa.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ modalityId: string }> }
) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { modalityId } = await params;

  const { status, body } = await backendFetch(`/api/practiced-modalities/${modalityId}/result-types`, {
    accessToken,
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PRACTICED_MODALITY_RESULT_TYPES_FETCH_FAILED", message: "Não foi possível carregar os tipos de resultado configurados" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ modalityId: string }> }
) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { modalityId } = await params;
  const { resultTypeId } = await request.json();

  const { status, body } = await backendFetch(`/api/practiced-modalities/${modalityId}/result-types`, {
    method: "POST",
    accessToken,
    body: JSON.stringify({ resultTypeId }),
  });

  if (status !== 201 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PRACTICED_MODALITY_RESULT_TYPE_ADD_FAILED", message: "Não foi possível adicionar o tipo de resultado" } },
      { status: status === 201 ? 422 : status }
    );
  }

  return NextResponse.json({ data: body.data }, { status: 201 });
}
