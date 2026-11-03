export const NETWORK_ERROR_MESSAGE = "Sem conexão com o servidor. Verifique sua internet e tente de novo.";

/**
 * `fetch` do navegador pro BFF que nunca lança (auditoria A10): falha de rede vira
 * uma resposta 503 com o envelope de erro do projeto (`NETWORK_ERROR`), que cai nos
 * mesmos ramos de erro (`!response.ok`, `error.message`) que a tela já trata — em vez de
 * rejeitar a promessa e deixar a tela presa em "carregando". Telas novas usam `callApi`.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    return Response.json({ error: { code: "NETWORK_ERROR", message: NETWORK_ERROR_MESSAGE } }, { status: 503 });
  }
}
