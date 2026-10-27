/*
 * Service worker mínimo do ShotTrack (FUC22 / ADR-0020), escrito à mão.
 *
 * Regras (não relaxar sem decisão explícita — dados pessoais, ADR-0019):
 * - só cacheia ARQUIVOS ESTÁTICOS (/_next/static, /icons, fontes, imagens);
 * - NUNCA intercepta /api/* nem qualquer requisição que não seja GET;
 * - navegação vai à rede; se falhar, devolve a página /offline (pré-cacheada).
 *   Páginas autenticadas nunca são guardadas nem servidas do cache.
 * Mudou a estratégia ou a lista de pré-cache? Suba CACHE_VERSION.
 */
const CACHE_VERSION = 1;
const CACHE_NAME = `shottrack-static-v${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const STATIC_PATH = /^\/(_next\/static|icons)\//;

/** Arquivos estáticos referenciados por um texto (HTML ou CSS) da própria origem. */
function staticAssetsIn(text) {
  const found = new Set();
  for (const match of text.matchAll(/\/(?:_next\/static|icons)\/[^"'()\s\\<>]+/g)) {
    found.add(match[0]);
  }
  return [...found];
}

/** Pré-cacheia /offline e o que ela precisa pra renderizar sem rede (JS, CSS, fontes). */
async function precacheOfflinePage() {
  const cache = await caches.open(CACHE_NAME);
  const page = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!page.ok) throw new Error(`/offline respondeu ${page.status}`);
  const html = await page.clone().text();
  await cache.put(OFFLINE_URL, page);

  const assets = staticAssetsIn(html);
  await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));

  // fontes e imagens citadas pelos CSS da página
  for (const url of assets.filter((asset) => asset.endsWith(".css"))) {
    const css = await (await cache.match(url))?.text();
    if (css) {
      await Promise.all(staticAssetsIn(css).map((asset) => cache.add(asset).catch(() => undefined)));
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("shottrack-static-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableStatic(request, url) {
  if (url.pathname.startsWith("/api/")) return false;
  return STATIC_PATH.test(url.pathname) || request.destination === "font" || request.destination === "image";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só GET da própria origem; /api/* (BFF) nunca passa por aqui.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL, { cacheName: CACHE_NAME })) ?? Response.error())
    );
    return;
  }

  if (isCacheableStatic(request, url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
  }
  // qualquer outra coisa segue direto pra rede, sem cache
});
