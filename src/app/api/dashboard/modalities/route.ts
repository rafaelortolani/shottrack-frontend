import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF da aba Modalidades e do filtro global do dashboard (UC42 v7):
 * modalidades em que o atleta já treinou, com nº de treinos e o melhor valor
 * do tipo de resultado mais registrado. Não aceita filtro.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { status, body } = await backendFetch("/api/dashboard/modalities", { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "DASHBOARD_MODALITIES_FETCH_FAILED", message: "Não foi possível carregar as modalidades" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
