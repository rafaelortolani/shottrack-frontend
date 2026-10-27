import { test, expect, type Page } from "@playwright/test";
import { createUser, randomEmail, loginAndGetToken, getValidWeaponCombo, registerWeapon } from "./helpers";

/**
 * PWA (FUC22 / ADR-0020) — roda no projeto "pwa", contra o BUILD DE PRODUÇÃO
 * (o service worker só é registrado em produção):
 *   npm run build && npm run start -- -p 3100
 */
test.beforeAll(async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/offline`).catch(() => null);
  if (!response?.ok) {
    throw new Error(`Servidor de produção fora do ar em ${baseURL}. Rode: npm run build && npm run start -- -p 3100`);
  }
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas/);
}

async function serviceWorkerReady(page: Page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      // 1ª visita: o worker só assume a página depois do clients.claim()
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
        if (registration.active && navigator.serviceWorker.controller) resolve();
      });
    }
  });
}

/** Tudo que há em todos os caches do app: URL e tipo de conteúdo. */
async function cachedEntries(page: Page) {
  return page.evaluate(async () => {
    const entries: { cache: string; url: string; contentType: string | null }[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        entries.push({ cache: name, url: new URL(request.url).pathname, contentType: response?.headers.get("content-type") ?? null });
      }
    }
    return entries;
  });
}

test.describe("PWA em produção (FUC22)", () => {
  test("manifest acessível sem login, com os campos esperados", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("manifest+json");

    const manifest = await response.json();
    expect(manifest).toMatchObject({
      name: "ShotTrack",
      short_name: "ShotTrack",
      lang: "pt-BR",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#232323",
      theme_color: "#232323",
    });
    expect(manifest.description).toContain("Treine. Registre. Evolua.");

    const sizes = (purpose: string) =>
      manifest.icons.filter((icon: { purpose: string }) => icon.purpose === purpose).map((icon: { sizes: string }) => icon.sizes);
    expect(sizes("any")).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(sizes("maskable")).toEqual(["512x512"]);

    expect(manifest.shortcuts.map((s: { name: string; url: string }) => [s.name, s.url])).toEqual([
      ["Treinos", "/treinos"],
      ["Dashboard", "/dashboard"],
    ]);
  });

  test("todos os ícones do manifest e o apple-touch-icon respondem 200 como PNG, sem login", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    const urls = [...manifest.icons.map((i: { src: string }) => i.src), ...manifest.shortcuts.flatMap((s: { icons: { src: string }[] }) => s.icons.map((i) => i.src)), "/icons/apple-touch-icon.png"];
    for (const url of new Set(urls)) {
      const response = await request.get(url, { maxRedirects: 0 });
      expect(response.status(), url).toBe(200);
      expect(response.headers()["content-type"], url).toContain("image/png");
    }
  });

  test("cabeçalho da página: theme-color, viewport-fit=cover, manifest e apple-touch-icon", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#232323");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "ShotTrack");
  });

  test("/offline abre sem login e /sw.js é servido sem cache HTTP", async ({ page, request }) => {
    await page.goto("/offline");
    await expect(page).toHaveURL(/\/offline$/);
    await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();

    const sw = await request.get("/sw.js", { maxRedirects: 0 });
    expect(sw.status()).toBe(200);
    expect(sw.headers()["cache-control"]).toBe("no-cache");
    expect(sw.headers()["content-type"]).toContain("javascript");
  });

  test("o service worker registra, controla a página e pré-cacheia só /offline e arquivos estáticos", async ({ page }) => {
    await page.goto("/login");
    await serviceWorkerReady(page);

    const registration = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { scope: new URL(r.scope).pathname, script: new URL(r.active!.scriptURL).pathname, controlled: !!navigator.serviceWorker.controller };
    });
    expect(registration).toEqual({ scope: "/", script: "/sw.js", controlled: true });

    const entries = await cachedEntries(page);
    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((e) => e.cache))).toEqual(new Set(["shottrack-static-v1"]));
    expect(entries.some((e) => e.url === "/offline")).toBe(true);
    expect(entries.some((e) => e.url.startsWith("/_next/static/"))).toBe(true);
    // A única página (HTML) guardada é a /offline
    const documents = entries.filter((e) => e.contentType?.includes("text/html"));
    expect(documents.map((e) => e.url)).toEqual(["/offline"]);
  });

  test("usando o app autenticado, nenhuma resposta de /api nem página autenticada vai pro cache", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { model, caliber } = await getValidWeaponCombo(token);
    await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });

    await page.goto("/login");
    await serviceWorkerReady(page);
    await login(page, email);

    // Navega por telas com dados pessoais (cada uma chama o BFF)
    for (const route of ["/dashboard", "/acervo/armas", "/usuario/perfil", "/usuario/privacidade"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    // e uma chamada ao BFF direto, de dentro da página controlada pelo worker
    const status = await page.evaluate(async () => (await fetch("/api/weapons")).status);
    expect(status).toBe(200);

    const entries = await cachedEntries(page);
    expect(entries.filter((e) => e.url.startsWith("/api/")), "respostas do BFF em cache").toEqual([]);
    expect(entries.filter((e) => e.contentType?.includes("json")), "JSON em cache").toEqual([]);
    for (const authenticated of ["/dashboard", "/acervo", "/usuario", "/treinos", "/boas-vindas"]) {
      expect(entries.filter((e) => e.url.startsWith(authenticated)), `página ${authenticated} em cache`).toEqual([]);
    }
    expect(entries.filter((e) => e.contentType?.includes("text/html")).map((e) => e.url)).toEqual(["/offline"]);
  });

  test("sem conexão a navegação cai na página /offline; ao voltar a conexão, o app abre normal", async ({ page, context }) => {
    await page.goto("/login");
    await serviceWorkerReady(page);

    await context.setOffline(true);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible();

    // nem uma rota autenticada vira conteúdo do cache: é a mesma tela de aviso
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sua evolução" })).toHaveCount(0);

    await context.setOffline(false);
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page).toHaveURL(/\/login|\/dashboard/);
    await expect(page.getByRole("heading", { name: "Sem conexão" })).toHaveCount(0);
  });

  test("o app é instalável: o Chrome não aponta erros de instalabilidade", async ({ page, context }) => {
    await page.goto("/login");
    await serviceWorkerReady(page);
    await page.reload();

    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors" as never)) as {
      installabilityErrors: { errorId: string }[];
    };
    expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);

    const { url, errors } = (await cdp.send("Page.getAppManifest" as never)) as { url: string; errors: { message: string }[] };
    expect(url).toContain("/manifest.webmanifest");
    expect(errors.map((e) => e.message)).toEqual([]);
  });
});
