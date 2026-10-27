import { test, expect } from "@playwright/test";
import { createUser, randomEmail } from "./helpers";

/**
 * Sem conexão (FUC22): banner de aviso e botões de envio desabilitados. Não
 * depende do service worker (que só existe em produção) — usa os eventos
 * online/offline do navegador.
 */
const BANNER = "Você está sem conexão. Para registrar, é preciso internet.";

test.describe("Sem conexão (FUC22)", () => {
  test("mostra o banner e desabilita o envio do formulário; ao voltar a conexão, tudo volta", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
    await expect(page.getByText(BANNER)).toHaveCount(0);

    await context.setOffline(true);
    await expect(page.getByRole("status").filter({ hasText: BANNER })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeDisabled();

    // Enter no campo também não envia (nenhuma chamada ao BFF)
    let loginCalls = 0;
    page.on("request", (request) => request.url().includes("/api/auth/login") && loginCalls++);
    await page.getByLabel("Email").fill("alguem@shottrack.com");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByLabel("Senha").press("Enter");
    expect(loginCalls).toBe(0);

    await context.setOffline(false);
    await expect(page.getByText(BANNER)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  test("o envio que estava desabilitado antes de ficar offline continua desabilitado depois", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email);
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    // Cadastro de arma: o botão nasce desabilitado (sem modelo/calibre escolhidos)
    await page.goto("/acervo/armas/nova");
    const submit = page.getByRole("button", { name: "Cadastrar" });
    await expect(submit).toBeDisabled();

    await context.setOffline(true);
    await expect(page.getByText(BANNER)).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText(BANNER)).toHaveCount(0);
    await expect(submit).toBeDisabled();
  });

  test("em desenvolvimento não registra service worker nem cria cache (só produção)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

    const state = await page.evaluate(async () => ({
      registrations: (await navigator.serviceWorker.getRegistrations()).length,
      caches: (await caches.keys()).filter((key) => key.startsWith("shottrack-")),
    }));
    expect(state.registrations).toBe(0);
    expect(state.caches).toEqual([]);
  });

  test("manifest, ícones e /offline são públicos (sem login)", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
    expect(manifest.status()).toBe(200);
    for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
      const response = await request.get(`/icons/${icon}`, { maxRedirects: 0 });
      expect(response.status(), icon).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
    expect((await request.get("/offline", { maxRedirects: 0 })).status()).toBe(200);
    expect((await request.get("/sw.js", { maxRedirects: 0 })).status()).toBe(200);
  });
});
