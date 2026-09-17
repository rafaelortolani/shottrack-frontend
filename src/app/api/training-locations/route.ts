import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { status, body } = await backendFetch("/api/training-locations", { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "TRAINING_LOCATIONS_FETCH_FAILED", message: "Não foi possível carregar os locais de treino" } },
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

  const { name, city, state } = await request.json();

  const { status, body } = await backendFetch("/api/training-locations", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ name, city, state }),
  });

  if (status !== 201 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "TRAINING_LOCATION_REGISTER_FAILED", message: "Não foi possível cadastrar o local de treino" } },
      { status: status === 201 ? 422 : status }
    );
  }

  return NextResponse.json({ data: body.data }, { status: 201 });
}
