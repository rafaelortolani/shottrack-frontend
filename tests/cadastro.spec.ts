import { test, expect } from "@playwright/test";
import { createUser, randomEmail } from "./helpers";

/**
 * Os seletores (getByLabel, getByRole) assumem os rótulos usados no FUC01
 * (docs/use-cases/FUC01-cadastro.md). Se o Claude Code implementou com
 * texto ligeiramente diferente, ajuste os textos abaixo pra bater com o
 * que existe de fato na tela — não force a tela a se adequar ao teste.
 */
test.describe("Cadastro (FUC01)", () => {
  test("cria conta com dados válidos e redireciona pro login", async ({ page }) => {
    const email = randomEmail();

    await page.goto("/cadastro");
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test("mostra erro ao tentar cadastrar email já existente", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/cadastro");
    await page.getByLabel("Nome").fill("Outro Atleta");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page.getByText(/já existe uma conta/i)).toBeVisible();
    await expect(page).toHaveURL(/\/cadastro/);
  });

  test("mostra erro de validação com senha curta", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Email").fill(randomEmail());
    await page.getByLabel("Senha").fill("123");
    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page).toHaveURL(/\/cadastro/);
  });
});