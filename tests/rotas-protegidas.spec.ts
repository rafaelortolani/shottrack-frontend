import { test, expect } from "@playwright/test";

/**
 * Sem sessão, toda rota de página autenticada redireciona pro /login
 * (src/proxy.ts) e as rotas públicas continuam abertas. Uma rota nova sob
 * um prefixo que não esteja no matcher do proxy fica exposta — este spec
 * existe pra pegar isso.
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/boas-vindas",
  "/treinos",
  "/treinos/visitas",
  "/treinos/historico",
  "/treinos/locais",
  "/treinos/locais/novo",
  "/treinos/nova",
  "/treinos/00000000-0000-0000-0000-000000000000",
  "/acervo",
  "/acervo/armas",
  "/acervo/municoes",
  "/acervo/acessorios",
  "/acervo/comparar",
  "/acervo/armas/nova",
  "/usuario",
  "/usuario/perfil",
  "/usuario/modalidades",
  "/usuario/senha",
  "/usuario/email",
];

const PUBLIC_ROUTES = [
  "/login",
  "/cadastro",
  "/cadastro/completar?token=qualquer",
  "/esqueci-senha",
  "/redefinir-senha?token=qualquer",
  "/termos",
  "/privacidade",
];

test.describe("Rotas protegidas sem sessão", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redireciona para /login`, async ({ page, request }) => {
      // No servidor (proxy), antes de renderizar — as telas também se
      // redirecionam sozinhas ao receber 401 do BFF, o que mascararia a falha.
      const response = await request.get(route, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(new URL(response.headers()["location"], response.url()).pathname).toBe("/login");

      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    });
  }

  for (const route of PUBLIC_ROUTES) {
    test(`${route} continua pública`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.split("?")[0].replace("/", "\\/")));
    });
  }

  test("a raiz / redireciona para /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a API do BFF responde 401 sem sessão, sem depender do proxy", async ({ request }) => {
    for (const path of ["/api/weapons", "/api/visits", "/api/training-locations", "/api/series/history", "/api/dashboard"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
      expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
    }
  });
});
