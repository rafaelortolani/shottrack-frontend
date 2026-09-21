import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF de visitas (UC31/UC35): repassa o cookie de sessão como Bearer pro
 * backend.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { status, body } = await backendFetch("/api/visits", { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "VISITS_FETCH_FAILED", message: "Não foi possível carregar as visitas" } },
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

  const { trainingLocationId, observations } = await request.json();

  const { status, body } = await backendFetch("/api/visits", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ trainingLocationId, observations }),
  });

  if (status !== 201 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "VISIT_START_FAILED", message: "Não foi possível iniciar a visita" } },
      { status: status === 201 ? 422 : status }
    );
  }

  return NextResponse.json({ data: body.data }, { status: 201 });
}
