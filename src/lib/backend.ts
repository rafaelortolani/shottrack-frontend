/**
 * Cliente do backend ShotTrack, usado apenas dentro das Route Handlers
 * (o "BFF") — nunca chamado direto do navegador. O JWT nunca sai do servidor.
 */
const LOCAL_BACKEND_URL = "http://localhost:8080";

/**
 * URL do backend. Em produção a variável é obrigatória: sem ela o BFF falha na primeira chamada em
 * vez de tentar `localhost` em silêncio (auditoria A13). Fora de produção (dev local, testes) o
 * padrão é o backend local. Lida a cada chamada — não no carregamento do módulo — porque o
 * `next build` também roda com NODE_ENV=production e não precisa do backend.
 */
export function resolveBackendUrl(env: Record<string, string | undefined> = process.env): string {
  const url = env.BACKEND_URL?.trim();
  if (url) return url;
  if (env.NODE_ENV === "production") {
    throw new Error("BACKEND_URL não está configurada: defina a URL do backend do ShotTrack no ambiente de produção.");
  }
  return LOCAL_BACKEND_URL;
}

type BackendRequestInit = RequestInit & { accessToken?: string };

/** Chamada crua ao backend: devolve a Response (usada quando a resposta não é o envelope JSON, ex.: download). */
export function backendRawFetch(path: string, options: BackendRequestInit = {}) {
  const { accessToken, headers, ...rest } = options;

  return fetch(`${resolveBackendUrl()}${path}`, {
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
