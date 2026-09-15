import { test, expect } from "@playwright/test";
import { createUser, randomEmail, getLatestVerificationCode } from "./helpers";

async function loginAndGoToEmailChange(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/perfil");
  await page.getByRole("link", { name: "Alterar" }).first().click();
  await expect(page).toHaveURL(/\/perfil\/email/);
}

async function fillCode(page: import("@playwright/test").Page, code: string) {
  for (let i = 0; i < code.length; i++) {
    await page.getByLabel(`Dígito ${i + 1} do código`).fill(code[i]);
  }
}

test.describe("Trocar email (FUC04)", () => {
  test("solicita e confirma a troca de email com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAndGoToEmailChange(page, email);

    const newEmail = randomEmail();
    await page.getByLabel("Novo email").fill(newEmail);
    await page.getByRole("button", { name: "Enviar código" }).click();

    await expect(page.getByText(newEmail)).toBeVisible();

    const code = await getLatestVerificationCode(newEmail);
    await fillCode(page, code);
    await page.getByRole("button", { name: "Confirmar" }).click();

    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByText(newEmail)).toBeVisible();
  });

  test("mostra erro ao tentar trocar pra um email já cadastrado", async ({ page }) => {
    const email = randomEmail();
    const otherEmail = randomEmail();
    await createUser(email);
    await createUser(otherEmail);
    await loginAndGoToEmailChange(page, email);

    await page.getByLabel("Novo email").fill(otherEmail);
    await page.getByRole("button", { name: "Enviar código" }).click();

    await expect(page.getByText(/já está em uso/i)).toBeVisible();
    await expect(page).toHaveURL(/\/perfil\/email/);
  });

  test("mostra erro ao confirmar com código incorreto", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAndGoToEmailChange(page, email);

    const newEmail = randomEmail();
    await page.getByLabel("Novo email").fill(newEmail);
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByText(newEmail)).toBeVisible();

    await fillCode(page, "000000");
    await page.getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByText(/código incorreto/i)).toBeVisible();
    await expect(page).toHaveURL(/\/perfil\/email/);
  });
});
