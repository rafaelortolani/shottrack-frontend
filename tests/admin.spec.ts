import { test, expect, type Page } from "@playwright/test";
import { createUser, randomEmail, loginAndGetToken, setUserRole } from "./helpers";

/**
 * Papel de administrador (ADR-0021). Pra criar um admin, o teste faz um
 * UPDATE direto em `users.role` no Postgres (helper `setUserRole`) — é assim
 * que o papel muda em produção, não há endpoint nem tela de promoção.
 */
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas/);
}

const navAdminLink = (page: Page) => page.locator("aside").getByRole("link", { name: "Admin", exact: true });

test.describe("Administração (ADR-0021)", () => {
  test("atleta comum não vê o item Admin e é redirecionado ao dashboard ao abrir /admin", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await expect(page.locator("aside").getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(navAdminLink(page)).toHaveCount(0);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Administração" })).toHaveCount(0);

    // também em subcaminhos
    await page.goto("/admin/qualquer-coisa");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("o redirecionamento do atleta comum acontece no servidor, antes de renderizar a página", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    const response = await page.request.get("/admin", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers()["location"], response.url()).pathname).toBe("/dashboard");
  });

  test("admin vê o item no menu e abre /admin com o cartão desabilitado", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    setUserRole(email, "ADMIN");
    await login(page, email);

    await expect(navAdminLink(page)).toBeVisible();
    await navAdminLink(page).click();
    await expect(page).toHaveURL(/\/admin$/);

    await expect(page.getByRole("heading", { name: "Administração", level: 1 })).toBeVisible();
    const card = page.getByText("Regras de habitualidade — em breve");
    await expect(card).toBeVisible();
    await expect(page.locator('[aria-disabled="true"]').filter({ has: card })).toHaveCount(1);
    // só o cartão: nenhum link nem outra tela
    await expect(page.getByRole("main").getByRole("link")).toHaveCount(0);
  });

  test("sem login, /admin leva ao /login (no servidor)", async ({ page, request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers()["location"], response.url()).pathname).toBe("/login");

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("o papel vale na hora: admin rebaixado perde o acesso sem esperar o token expirar", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    setUserRole(email, "ADMIN");
    await login(page, email);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();

    setUserRole(email, "USER");

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(navAdminLink(page)).toHaveCount(0);
  });

  test("o BFF de /api/admin responde 401 sem sessão, 403 para atleta comum e 200 para admin", async ({ page, request }) => {
    expect((await request.get("/api/admin/session")).status()).toBe(401);

    const athlete = randomEmail();
    await createUser(athlete);
    await login(page, athlete);
    const forbidden = await page.request.get("/api/admin/session");
    expect(forbidden.status()).toBe(403);
    expect((await forbidden.json()).error.code).toBe("FORBIDDEN");

    setUserRole(athlete, "ADMIN");
    const allowed = await page.request.get("/api/admin/session");
    expect(allowed.status()).toBe(200);
    expect((await allowed.json()).data.role).toBe("ADMIN");
  });

  test("o backend é a autoridade: /api/admin/** devolve 401 sem token e 403 FORBIDDEN para atleta comum", async () => {
    const backend = "http://localhost:8080/api/admin/qualquer-rota";
    expect((await fetch(backend)).status).toBe(401);

    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const response = await fetch(backend, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  test("/api/users/me devolve o papel (USER por padrão, ADMIN depois de promovido)", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);
    expect((await (await page.request.get("/api/users/me")).json()).data.role).toBe("USER");

    setUserRole(email, "ADMIN");
    expect((await (await page.request.get("/api/users/me")).json()).data.role).toBe("ADMIN");
  });
});
