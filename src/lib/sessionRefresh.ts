/**
 * Renovação de sessão no BFF (auditoria A07). O backend troca o refresh token por um novo par e REVOGA o
 * antigo (ADR-0001): usar o mesmo token duas vezes derruba a sessão inteira. Por isso renovações simultâneas
 * com o mesmo refresh token compartilham uma única chamada ao backend (`single-flight`), e o resultado fica
 * guardado por alguns segundos para as que chegarem logo depois.
 */
export type RefreshOutcome =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; status: number; unauthorized: boolean };

type BackendRefresh = (refreshToken: string) => Promise<{ status: number; body: { data?: { accessToken?: string; refreshToken?: string } } | null }>;

const RESULT_TTL_MS = 10_000;
const inFlight = new Map<string, Promise<RefreshOutcome>>();

export function renewSession(refreshToken: string, callBackend: BackendRefresh): Promise<RefreshOutcome> {
  const existing = inFlight.get(refreshToken);
  if (existing) return existing;

  const promise = callBackend(refreshToken)
    .then((result): RefreshOutcome => {
      const data = result.body?.data;
      if (result.status === 200 && data?.accessToken && data.refreshToken) {
        return { ok: true, accessToken: data.accessToken, refreshToken: data.refreshToken };
      }
      return { ok: false, status: result.status, unauthorized: result.status === 401 };
    })
    .catch((): RefreshOutcome => ({ ok: false, status: 502, unauthorized: false }));

  inFlight.set(refreshToken, promise);
  setTimeout(() => inFlight.delete(refreshToken), RESULT_TTL_MS).unref?.();
  return promise;
}
