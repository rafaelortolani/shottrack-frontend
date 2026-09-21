import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * O backend tem dois endpoints pra registrar resultado (UC39): POST
 * .../results (valor de verdade) e POST .../results/not-applicable
 * (não aplicável). Essa Route Handler expõe só um POST pro cliente e
 * decide qual chamar internamente, com base em `notApplicable` no corpo.
 */
export async function POST(
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
  const { resultTypeId, value, notApplicable } = await request.json();

  const { status, body } = notApplicable
    ? await backendFetch(`/api/series/${id}/results/not-applicable`, {
        method: "POST",
        accessToken,
        body: JSON.stringify({ resultTypeId }),
      })
    : await backendFetch(`/api/series/${id}/results`, {
        method: "POST",
        accessToken,
        body: JSON.stringify({ resultTypeId, value }),
      });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "SERIES_RESULT_REGISTER_FAILED", message: "Não foi possível registrar o resultado" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
