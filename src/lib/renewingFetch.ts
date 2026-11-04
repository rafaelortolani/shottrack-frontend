/**
 * `fetch` que renova a sessão sozinho (A07): se uma chamada ao BFF (`/api/**`) volta 401, tenta
 * `POST /api/auth/refresh` UMA vez e repete a chamada original. 401 significa que a requisição não foi
 * executada, então repetir é seguro também em POST/PATCH/DELETE. Renovações simultâneas do navegador viram uma só.
 * Se a renovação falha, devolve o 401 original e cada tela segue o seu tratamento (voltar ao login).
 */
type FetchFn = typeof fetch;

const AUTH_PREFIX = "/api/auth/";

/**
 * Só o 401 de sessão (JWT ausente/vencido/inválido) pede renovação. Outros 401 são de negócio (ex.: "senha atual
 * incorreta" na exportação, exclusão e troca de e-mail) e NÃO podem ser repetidos: contariam em dobro no limite de tentativas.
 */
const SESSION_ERROR_CODES = new Set(["UNAUTHORIZED", "UNAUTHENTICATED"]);

async function isSessionExpired(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const body = await response.clone().json();
    return SESSION_ERROR_CODES.has(body?.error?.code);
  } catch {
    return false;
  }
}

function sameOriginApiPath(input: RequestInfo | URL, origin: string): string | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    const url = new URL(raw, origin);
    return url.origin === origin && url.pathname.startsWith("/api/") ? url.pathname : null;
  } catch {
    return null;
  }
}

export function createRenewingFetch(baseFetch: FetchFn, origin: string): FetchFn {
  let renewal: Promise<boolean> | null = null;
  /** Renovações concluídas com sucesso: uma chamada que já saiu antes de uma delas e só agora volta 401 não renova de novo. */
  let renewed = 0;

  const renew = () => {
    renewal ??= baseFetch("/api/auth/refresh", { method: "POST" })
      .then((response) => {
        if (response.ok) renewed++;
        return response.ok;
      })
      .catch(() => false)
      .finally(() => {
        renewal = null;
      });
    return renewal;
  };

  return async (input, init) => {
    const path = sameOriginApiPath(input, origin);
    if (!path || path.startsWith(AUTH_PREFIX)) return baseFetch(input, init);

    // o corpo de um Request só pode ser lido uma vez: guarda um clone para a repetição
    const retryInput = input instanceof Request ? input.clone() : input;
    const renewedBefore = renewed;
    const response = await baseFetch(input, init);
    if (!(await isSessionExpired(response))) return response;
    const sessionRenewed = renewal ? await renewal : renewed !== renewedBefore || (await renew());
    if (!sessionRenewed) return response;
    return baseFetch(retryInput, init);
  };
}
