/**
 * FUC26: o navegador não informa o status quando uma `<img>` da foto falha. Esta sondagem pede a mesma URL e
 * descobre o motivo, só pelo status (o corpo é descartado):
 *  - "missing": 404, a foto não existe mais (excluída em outro aparelho). Não adianta tentar de novo.
 *  - "available": a imagem veio (ex.: a sessão foi renovada pelo `fetch` do app). Vale recarregar a `<img>`.
 *  - "failed": rede ou erro do servidor. "Tentar de novo" faz sentido.
 * O `fetch` do app renova a sessão sozinho SÓ num 401 de sessão (code UNAUTHORIZED/UNAUTHENTICATED); um 404 de foto
 * inexistente nunca passa por esse fluxo (sem refresh, sem logout, sem redirecionamento).
 */
export type PhotoProbe = "missing" | "available" | "failed";

export const PHOTO_NOT_FOUND_MESSAGE = "Foto não encontrada.";

export async function probePhoto(url: string): Promise<PhotoProbe> {
  const controller = new AbortController();
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    controller.abort();
    if (response.status === 404) return "missing";
    return response.ok ? "available" : "failed";
  } catch {
    return "failed";
  }
}
