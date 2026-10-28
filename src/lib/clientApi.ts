export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string | null; message: string; retryAfter: number | null };

/**
 * Chamada ao BFF com o envelope `{ data } | { error }`. Nunca lança: falha de
 * rede vira `ok: false` com `status` 0 e a mensagem de `fallback`.
 */
export async function callApi<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown; fallback: string }
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      ...(options.body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) }
        : {}),
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const retry = Number(response.headers.get("Retry-After"));
      return {
        ok: false,
        status: response.status,
        code: json?.error?.code ?? null,
        message: json?.error?.message ?? options.fallback,
        retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null,
      };
    }
    return { ok: true, data: json.data as T };
  } catch {
    return { ok: false, status: 0, code: null, message: options.fallback, retryAfter: null };
  }
}
