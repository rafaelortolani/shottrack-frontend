import { test, expect } from "@playwright/test";
import { createUser, randomEmail } from "./helpers";

test.describe("Usuário > Perfil (FUC03)", () => {
  test("carrega dados existentes e edita nome e nível com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/usuario");
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

  test("chega no usuário pelo link do menu no dashboard", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

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
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/usuario");
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page).toHaveURL(/\/usuario\/modalidades/);
  });
});
