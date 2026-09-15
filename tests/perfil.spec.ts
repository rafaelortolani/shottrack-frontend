import { test, expect } from "@playwright/test";
import { createUser, randomEmail } from "./helpers";

test.describe("Perfil (FUC03)", () => {
  test("carrega dados existentes e edita nome e nível com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/perfil");
    await expect(page.getByLabel("Nome")).toHaveValue("Usuário de Teste");
    await expect(page.getByText(email)).toBeVisible();

    await page.getByLabel("Nome").fill("Atleta Atualizado");
    await page.getByLabel("Nível de experiência").selectOption("ADVANCED");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText(/perfil atualizado/i)).toBeVisible();
    await expect(page.getByLabel("Nome")).toHaveValue("Atleta Atualizado");
    await expect(page.getByLabel("Nível de experiência")).toHaveValue("ADVANCED");
  });

  test("bloqueia acesso ao perfil sem estar logado", async ({ page }) => {
    await page.goto("/perfil");
    await expect(page).toHaveURL(/\/login/);
  });
});
