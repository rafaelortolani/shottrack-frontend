import { test, expect } from "@playwright/test";
import { createUser, randomEmail } from "./helpers";

test.describe("Usuário > Alterar senha (FUC05)", () => {
  test("troca a senha, faz logout e confirma que só a nova senha funciona", async ({ page }) => {
    const email = randomEmail();
    const currentPassword = "senha12345";
    const newPassword = "novaSenha456";
    await createUser(email, currentPassword);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(currentPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/usuario/perfil");
    await page.getByRole("link", { name: "Alterar" }).nth(1).click();
    await expect(page).toHaveURL(/\/usuario\/senha/);

    await page.getByLabel("Senha atual").fill(currentPassword);
    await page.getByLabel("Nova senha").fill(newPassword);
    await page.getByRole("button", { name: "Alterar senha" }).click();

    await expect(page).toHaveURL(/\/usuario\/perfil\?senha=alterada/);
    await expect(page.getByText(/senha alterada com sucesso/i)).toBeVisible();

    // sem botão de logout na UI ainda — desloga direto pela rota do BFF
    await page.request.post("/api/auth/logout");

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(currentPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Senha").fill(newPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("mostra erro ao informar a senha atual incorreta", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/usuario/senha");
    await page.getByLabel("Senha atual").fill("senhaErrada999");
    await page.getByLabel("Nova senha").fill("outraSenha456");
    await page.getByRole("button", { name: "Alterar senha" }).click();

    await expect(page.getByText(/senha atual incorreta/i)).toBeVisible();
    await expect(page).toHaveURL(/\/usuario\/senha/);
  });
});
