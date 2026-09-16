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

  const { status, body } = await backendFetch("/api/ammunition-catalog/manufacturers", { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "AMMUNITION_MANUFACTURERS_FETCH_FAILED", message: "Não foi possível carregar os fabricantes" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
