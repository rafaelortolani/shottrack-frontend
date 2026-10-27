/**
 * Cliente do backend ShotTrack, usado apenas dentro das Route Handlers
 * (o "BFF") — nunca chamado direto do navegador. O JWT nunca sai do servidor.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

type BackendRequestInit = RequestInit & { accessToken?: string };

/** Chamada crua ao backend: devolve a Response (usada quando a resposta não é o envelope JSON, ex.: download). */
export function backendRawFetch(path: string, options: BackendRequestInit = {}) {
  const { accessToken, headers, ...rest } = options;

  return fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });
}

export async function backendFetch(path: string, options: BackendRequestInit = {}) {
  const response = await backendRawFetch(path, options);
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
