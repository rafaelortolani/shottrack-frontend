import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/**
 * BFF do perfil: repassa o cookie de sessão como Authorization Bearer pro
 * backend. Sem cookie, nem chama o backend — o cliente trata o 401
 * redirecionando pro /login (ver FUC03).
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { status, body } = await backendFetch("/api/users/me", { accessToken });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PROFILE_FETCH_FAILED", message: "Não foi possível carregar o perfil" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}

export async function PATCH(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const { name, experienceLevel } = await request.json();

  const { status, body } = await backendFetch("/api/users/me", {
    method: "PATCH",
    accessToken,
    // o backend exige name e experienceLevel juntos, mesmo editando só um
    body: JSON.stringify({ name, experienceLevel }),
  });

  if (status !== 200 || body.error) {
    return NextResponse.json(
      { error: body.error ?? { code: "PROFILE_UPDATE_FAILED", message: "Não foi possível atualizar o perfil" } },
      { status }
    );
  }

  return NextResponse.json({ data: body.data });
}
