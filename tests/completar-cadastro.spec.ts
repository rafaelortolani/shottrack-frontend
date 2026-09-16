import { test, expect } from "@playwright/test";
import { randomEmail, getLatestRegistrationToken, expireRegistrationToken } from "./helpers";

/**
 * Os seletores assumem os rótulos usados no FUC10
 * (docs/use-cases/FUC10-completar-cadastro.md). Ajuste os textos abaixo pra
 * bater com o que existe de fato na tela, se necessário.
 */
test.describe("Completar cadastro (FUC10)", () => {
  test("fluxo completo: solicita, pega o link no Mailpit, completa e loga", async ({ page }) => {
    const email = randomEmail();

    await page.goto("/cadastro");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText(/verifique seu email/i)).toBeVisible();

    const token = await getLatestRegistrationToken(email);

    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/conta criada com sucesso/i)).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("mostra erro claro quando o token já foi usado", async ({ page }) => {
    const email = randomEmail();

    await fetch("http://localhost:3000/api/users/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const token = await getLatestRegistrationToken(email);

    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Concluir cadastro" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Outra Tentativa");
    await page.getByLabel("Senha").fill("outrasenha123");
    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(page.getByText(/cadastro já foi concluído/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o login" })).toBeVisible();
  });

  test("mostra erro claro quando o token expirou", async ({ page }) => {
    const email = randomEmail();

    await fetch("http://localhost:3000/api/users/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const token = await getLatestRegistrationToken(email);
    expireRegistrationToken(token);

    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(page.getByText(/link expirou/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitar novo cadastro" })).toBeVisible();
  });

  test("mostra erro claro quando o token é inválido ou inexistente", async ({ page }) => {
    await page.goto("/cadastro/completar?token=token-que-nunca-existiu");
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(page.getByText(/link de cadastro é inválido/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitar novo cadastro" })).toBeVisible();
  });
});
