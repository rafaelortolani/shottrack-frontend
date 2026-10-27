/**
 * Cliente do backend ShotTrack, usado apenas dentro das Route Handlers
 * (o "BFF") — nunca chamado direto do navegador. O JWT nunca sai do servidor.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function backendFetch(
  path: string,
  options: RequestInit & { accessToken?: string } = {}
) {
  const { accessToken, headers, ...rest } = options;

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  const body = await response.json();
  return { status: response.status, body, retryAfter: response.headers.get("Retry-After") };
}

/**
 * Cabeçalhos extras da resposta de erro do BFF: repassa o Retry-After do
 * backend no 429 (ADR-0018) pra tela poder dizer quanto esperar.
 */
export function retryAfterHeaders(status: number, retryAfter: string | null): HeadersInit | undefined {
  return status === 429 && retryAfter ? { "Retry-After": retryAfter } : undefined;
}
