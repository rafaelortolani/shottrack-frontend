import { test, expect } from "@playwright/test";
import { BASE_URL, createUser, randomEmail, refreshSession } from "./helpers";

test.describe("Usuário > Perfil (FUC03)", () => {
  test("carrega dados existentes e edita nome e nível com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    await page.goto("/usuario/perfil");
    await expect(page.getByLabel("Nome")).toHaveValue("Usuário de Teste");
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("Nenhuma modalidade selecionada")).toBeVisible();

    await page.getByLabel("Nome").fill("Atleta Atualizado");
    await page.getByLabel("Nível de experiência").selectOption("ADVANCED");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText(/perfil atualizado/i)).toBeVisible();
    await expect(page.getByLabel("Nome")).toHaveValue("Atleta Atualizado");
    await expect(page.getByLabel("Nível de experiência")).toHaveValue("ADVANCED");
  });

  test("bloqueia acesso ao usuário sem estar logado", async ({ page }) => {
    await page.goto("/usuario");
    await expect(page).toHaveURL(/\/login/);
  });

  test("chega no usuário pelo link do menu", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    await page.getByRole("link", { name: "Usuário" }).click();
    await expect(page).toHaveURL(/\/usuario$/);
  });

  test("link Editar do resumo de modalidades leva pra aba Modalidades", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    await page.goto("/usuario/perfil");
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page).toHaveURL(/\/usuario\/modalidades/);
  });

  test("faz logout e bloqueia acesso subsequente às rotas autenticadas", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    await page.goto("/usuario");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout revoga o refresh token no backend: o refresh antigo deixa de funcionar", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    const refresh = (await context.cookies()).find((c) => c.name === "shottrack_refresh")!.value;

    await page.goto("/usuario");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);

    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("shottrack_refresh");
    expect((await refreshSession(refresh)).status).toBe(401);
  });

  test("logout com refresh token inválido ainda limpa os cookies e responde 200", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    // O backend é chamado pelo servidor Next, então não dá pra derrubá-lo daqui;
    // com o cookie adulterado o logout do backend é idempotente e a sessão local
    // termina do mesmo jeito.
    await context.addCookies([
      { name: "shottrack_refresh", value: "token-invalido", url: BASE_URL },
    ]);
    const response = await page.request.post("/api/auth/logout");
    expect(response.status()).toBe(200);

    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("shottrack_access");
    expect(names).not.toContain("shottrack_refresh");
  });
});
