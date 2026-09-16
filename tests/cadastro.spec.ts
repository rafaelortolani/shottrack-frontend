import { test, expect } from "@playwright/test";
import { createUser, randomEmail, getLatestRegistrationToken } from "./helpers";

/**
 * Os seletores (getByLabel, getByRole) assumem os rótulos usados no FUC01
 * revisado (docs/use-cases/FUC01-cadastro.md). Se o Claude Code implementou
 * com texto ligeiramente diferente, ajuste os textos abaixo pra bater com o
 * que existe de fato na tela — não force a tela a se adequar ao teste.
 */
test.describe("Cadastro (FUC01)", () => {
  test("solicita cadastro e reenvia o link de confirmação", async ({ page }) => {
    const email = randomEmail();

    await page.goto("/cadastro");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText(/verifique seu email/i)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    const firstToken = await getLatestRegistrationToken(email);
    expect(firstToken).toBeTruthy();

    await page.getByRole("button", { name: "Reenviar" }).click();
    await expect(page.getByText("Link reenviado")).toBeVisible();

    const secondToken = await getLatestRegistrationToken(email);
    expect(secondToken).toBeTruthy();
    expect(secondToken).not.toBe(firstToken);
  });

  test("mostra erro ao solicitar cadastro com email já existente", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/cadastro");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText(/já existe uma conta/i)).toBeVisible();
    await expect(page).toHaveURL(/\/cadastro$/);
  });
});
