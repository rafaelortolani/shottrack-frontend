import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF de séries (UC36/UC37): repassa o cookie de sessão como Bearer pro
 * backend.
 */
export async function GET(
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

  const { id: trainingId } = await params;

  const { status, body } = await backendFetch(`/api/trainings/${trainingId}/series`, { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "SERIES_FETCH_FAILED", message: "Não foi possível carregar as séries" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}

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

  const { id: trainingId } = await params;
  const { weaponId, ammunitionId, distanceMeters, target, shotCount, notes } = await request.json();

  // O backend expõe isso como POST /api/series, com trainingId no corpo
  // (UC36) — essa Route Handler aninha em /trainings/{trainingId}/series
  // pro cliente, mas repassa pro endpoint real do backend.
  const { status, body } = await backendFetch("/api/series", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ trainingId, weaponId, ammunitionId, distanceMeters, target, shotCount, notes }),
  });

  if (status !== 201 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "SERIES_REGISTER_FAILED", message: "Não foi possível registrar a série" } },
      { status: status === 201 ? 422 : status }
    );
  }

  return NextResponse.json({ data: body.data }, { status: 201 });
}
