import { NextRequest, NextResponse } from "next/server";
import { backendFetch, retryAfterHeaders } from "@/lib/backend";
import { requireAdmin } from "@/lib/admin";

type ProxyOptions = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Caminho no backend. */
  path: string;
  /** Rotas de administração exigem `requireAdmin` (ADR-0021). */
  admin?: boolean;
  /** Repassa o corpo JSON da requisição ao backend. */
  forwardBody?: boolean;
  /** Mensagem usada quando o backend falha sem devolver um erro estruturado. */
  failure: { code: string; message: string };
};

/**
 * Handler "passa-prato" do BFF: confere a sessão (ou o papel de admin), repassa
 * a chamada ao backend com o token do cookie e devolve `{ data }` ou o `error`
 * do backend com o mesmo status — inclusive 403/409/429 —, sem expor o token.
 */
export async function proxyToBackend(request: NextRequest, options: ProxyOptions): Promise<NextResponse> {
  let accessToken: string;

  if (options.admin) {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    accessToken = admin.accessToken;
  } else {
    const token = request.cookies.get("shottrack_access")?.value;
    if (!token) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
        { status: 401 }
      );
    }
    accessToken = token;
  }

  const hasBody = options.forwardBody && options.method !== "GET" && options.method !== "DELETE";
  const payload = hasBody ? await request.json().catch(() => ({})) : undefined;

  const { status, body, retryAfter } = await backendFetch(options.path, {
    method: options.method,
    accessToken,
    ...(hasBody ? { body: JSON.stringify(payload) } : {}),
  });

  if (status >= 300 || body?.error) {
    return NextResponse.json(
      { error: body?.error ?? options.failure },
      { status: status >= 300 ? status : 422, headers: retryAfterHeaders(status, retryAfter) }
    );
  }

  return NextResponse.json({ data: body?.data ?? null }, { status });
}
