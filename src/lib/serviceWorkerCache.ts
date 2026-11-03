/**
 * Logout apaga os caches do app (auditoria A12). Com o service worker no controle, pede a ele
 * (`CLEAR_CACHES`: apaga `shottrack-*` e refaz só o pré-cache público, para o /offline seguir
 * funcionando); sem worker (desenvolvimento, navegador sem suporte), apaga direto. Nunca lança.
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  try {
    const controller = navigator.serviceWorker?.controller;
    if (controller) {
      controller.postMessage({ type: "CLEAR_CACHES" });
      return;
    }
    if (typeof caches === "undefined") return;
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("shottrack-")).map((key) => caches.delete(key)));
  } catch {
    // limpar cache é um extra: o logout segue de qualquer jeito
  }
}
