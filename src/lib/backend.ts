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
  return { status: response.status, body };
}
