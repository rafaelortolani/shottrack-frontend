import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { createAdmin, createUser, randomEmail } from "./helpers";

/**
 * Lote 3 da auditoria de segurança do frontend: cabeçalhos de segurança (A03) e cache (A06).
 * A CSP está em modo somente relatório: aqui conferimos o cabeçalho e que a navegação real
 * pelas telas não gera nenhuma violação da política (o que seria bloqueado no modo bloqueante).
 */
const SENHA = "senha12345";

async function loginApi(request: APIRequestContext) {
  const email = randomEmail();
  await createUser(email);
  const response = await request.post("/api/auth/login", { data: { email, password: SENHA } });
  expect(response.status()).toBe(200);
}

async function loginUi(page: Page, email: string, password = SENHA) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas|\/treinos\/visitas/);
}

function expectNoSharedCache(value: string | undefined) {
  expect(value ?? "").toMatch(/no-store/);
  expect(value ?? "").not.toMatch(/s-maxage|max-age=[1-9]|public/);
}

const nonceOf = (policy: string | undefined) => /script-src[^;]*'nonce-([^']+)'/.exec(policy ?? "")?.[1];

/** Registra `securitypolicyviolation` (disparado também no modo relatório) e mensagens de CSP do console. */
async function collectViolations(page: Page) {
  const found = new Set<string>();
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) found.add(`console | ${message.text()}`);
  });
  await page.exposeFunction("reportCspViolation", (entry: string) => found.add(entry));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { reportCspViolation: (entry: string) => void }).reportCspViolation(
        `${location.pathname} | ${event.effectiveDirective} | ${event.blockedURI} | ${event.sample}`
      );
    });
  });
  return () => [...found];
}

test.describe("A03 — cabeçalhos de segurança", () => {
  const SECURITY_HEADERS = {
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(self), microphone=(), geolocation=()",
  };

  test("páginas, API, arquivos estáticos e redirecionamentos levam os cabeçalhos e não anunciam o Next", async ({ request }) => {
    const paths = ["/login", "/offline", "/cadastro", "/api/users/me", "/boas-vindas", "/sw.js", "/manifest.webmanifest"];
    for (const path of paths) {
      const response = await request.get(path, { maxRedirects: 0 });
      const headers = response.headers();
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        expect(headers[name], `${path} ${name}`).toBe(value);
      }
      expect(headers["x-powered-by"], `${path} x-powered-by`).toBeUndefined();
    }
  });

  test("CSP em modo relatório: política esperada, nonce novo a cada requisição e nada bloqueante", async ({ request }) => {
    const first = (await request.get("/login")).headers();
    const second = (await request.get("/login")).headers();

    // somente relatório: o cabeçalho que bloqueia não pode estar presente neste lote
    expect(first["content-security-policy"]).toBeUndefined();
    const policy = first["content-security-policy-report-only"];
    expect(policy).toBeTruthy();
    for (const directive of [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "connect-src 'self'",
      "form-action 'self'",
    ]) {
      expect(policy, directive).toContain(directive);
    }
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");

    expect(nonceOf(policy)).toBeTruthy();
    expect(nonceOf(second["content-security-policy-report-only"])).not.toBe(nonceOf(policy));
  });

  test("o nonce da CSP chega aos scripts da página", async ({ request }) => {
    const response = await request.get("/login");
    const nonce = nonceOf(response.headers()["content-security-policy-report-only"]);
    expect(await response.text()).toContain(`nonce="${nonce}"`);
  });

  test("a API e o /sw.js não recebem CSP de página", async ({ request }) => {
    expect((await request.get("/api/users/me")).headers()["content-security-policy-report-only"]).toBeUndefined();
    expect((await request.get("/sw.js")).headers()["content-security-policy-report-only"]).toBeUndefined();
  });

  test("o coletor enxerga violações: estilo sem nonce, imagem e conexão externos são acusados", async ({ page }) => {
    const violations = await collectViolations(page);
    await page.goto("/login");
    await expect(page.locator("main").first()).toBeVisible();
    expect(violations()).toEqual([]);

    await page.evaluate(() => {
      // <style> sem nonce, imagem e conexão para fora da origem
      const style = document.createElement("style");
      style.textContent = "body { outline: 3px solid red; }";
      document.head.append(style);
      new Image().src = "http://example.invalid/i.png";
      void fetch("http://example.invalid/x").catch(() => undefined);
    });
    await expect.poll(() => violations().join("\n")).toMatch(/style-src/);
    await expect.poll(() => violations().join("\n")).toMatch(/img-src/);
    await expect.poll(() => violations().join("\n")).toMatch(/connect-src/);
    // modo relatório: o estilo sem nonce foi aplicado mesmo assim (nada foi bloqueado)
    expect(await page.evaluate(() => getComputedStyle(document.body).outlineStyle)).toBe("solid");
  });

  test("navegar pelas telas públicas não gera violação da política", async ({ page }) => {
    const violations = await collectViolations(page);
    for (const path of [
      "/login",
      "/cadastro",
      "/esqueci-senha",
      "/redefinir-senha?token=x",
      "/cadastro/completar?token=x",
      "/offline",
      "/termos",
      "/privacidade",
    ]) {
      await page.goto(path);
      await expect(page.locator("main").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
    }
    expect(violations()).toEqual([]);
  });

  test("navegar pelas telas autenticadas não gera violação da política", async ({ page }) => {
    test.setTimeout(90_000); // 21 telas em sequência: sob carga o limite padrão de 30 s estoura
    const email = randomEmail();
    await createUser(email);
    const violations = await collectViolations(page);
    await loginUi(page, email);

    const athletePages = [
      "/boas-vindas",
      "/dashboard",
      "/dashboard?aba=evolucao",
      "/dashboard?aba=habitualidade",
      "/treinos/visitas",
      "/treinos/historico",
      "/treinos/locais",
      "/treinos/locais/novo",
      "/treinos/nova",
      "/acervo/armas",
      "/acervo/armas/nova",
      "/acervo/municoes",
      "/acervo/municoes/nova",
      "/acervo/acessorios",
      "/acervo/acessorios/novo",
      "/acervo/comparar",
      "/usuario/perfil",
      "/usuario/modalidades",
      "/usuario/privacidade",
      "/usuario/senha",
      "/usuario/email",
    ];
    for (const path of athletePages) {
      await page.goto(path);
      await expect(page.locator("main").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
    }
    expect(violations()).toEqual([]);
  });

  test("telas de administração não geram violação da política", async ({ page }) => {
    const admin = await createAdmin();
    const violations = await collectViolations(page);
    await loginUi(page, admin.email);

    await page.goto("/admin/habitualidade");
    await expect(page.locator("main").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(violations()).toEqual([]);
  });
});

test.describe("A06 — cache de respostas autenticadas", () => {
  test("a API nunca é guardada em cache (com e sem sessão) e varia por cookie", async ({ request }) => {
    const paths = ["/api/users/me", "/api/dashboard", "/api/weapons"];
    for (const path of paths) {
      const response = await request.get(path);
      expect(response.headers()["cache-control"], path).toBe("no-store");
      expect(response.headers()["vary"], path).toMatch(/Cookie/i);
    }

    await loginApi(request);
    for (const path of paths) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["cache-control"], path).toBe("no-store");
      expect(response.headers()["vary"], path).toMatch(/Cookie/i);
    }
    // respostas de erro também
    const error = await request.post("/api/auth/login", { data: { email: "x@y.com", password: "z" } });
    expect(error.headers()["cache-control"]).toBe("no-store");
  });

  test("HTML das telas autenticadas: private, no-store, sem s-maxage (com sessão e no redirecionamento)", async ({ request }) => {
    for (const path of ["/boas-vindas", "/treinos/visitas", "/dashboard", "/acervo/armas", "/usuario/perfil", "/admin"]) {
      const redirect = await request.get(path, { maxRedirects: 0 });
      expect(redirect.status(), path).toBe(307);
      expectNoSharedCache(redirect.headers()["cache-control"]);
      expect(redirect.headers()["vary"], path).toMatch(/Cookie/i);
    }

    await loginApi(request);
    for (const path of ["/boas-vindas", "/treinos/visitas", "/dashboard", "/acervo/armas", "/usuario/perfil"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
      // (o Next reescreve o Vary das páginas renderizadas; private + no-store já impede qualquer cache)
      expectNoSharedCache(response.headers()["cache-control"]);
      expect(response.headers()["cache-control"], path).toMatch(/private/);
    }
  });

  test("páginas públicas também não ficam em cache compartilhado", async ({ request }) => {
    for (const path of ["/login", "/cadastro", "/offline", "/termos"]) {
      expectNoSharedCache((await request.get(path)).headers()["cache-control"]);
    }
  });

  test("cache longo só em /_next/static; o service worker segue sendo revalidado", async ({ request }) => {
    const html = await (await request.get("/login")).text();
    const asset = /\/_next\/static\/[^"']+\.(?:js|css)/.exec(html)?.[0];
    expect(asset).toBeTruthy();
    const staticResponse = await request.get(asset!);
    expect(staticResponse.status()).toBe(200);
    expect(staticResponse.headers()["cache-control"]).toMatch(/max-age=31536000.*immutable/);

    const sw = await request.get("/sw.js");
    expect(sw.headers()["cache-control"]).toBe("no-cache");
    expect(sw.headers()["service-worker-allowed"]).toBe("/");

    for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
      expect((await request.get(`/icons/${icon}`)).status(), icon).toBe(200);
    }
  });
});
