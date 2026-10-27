import { test, expect } from "@playwright/test";
import { createUser, randomEmail, refreshSession } from "./helpers";

test.describe("Usuário > Alterar senha (FUC05)", () => {
  test("troca a senha, é levado ao login com aviso, a sessão é encerrada e só a nova senha funciona", async ({
    page,
    context,
  }) => {
    const email = randomEmail();
    const currentPassword = "senha12345";
    const newPassword = "novaSenha456";
    await createUser(email, currentPassword);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(currentPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    const oldRefresh = (await context.cookies()).find((c) => c.name === "shottrack_refresh")!.value;

    await page.goto("/usuario/perfil");
    await page.getByRole("link", { name: "Alterar" }).nth(1).click();
    await expect(page).toHaveURL(/\/usuario\/senha/);

    await page.getByLabel("Senha atual").fill(currentPassword);
    await page.getByLabel("Nova senha").fill(newPassword);
    await page.getByRole("button", { name: "Alterar senha" }).click();

    await expect(page).toHaveURL(/\/login\?senha=alterada/);
    await expect(page.getByText("Senha alterada. Entre novamente.")).toBeVisible();

    // cookies limpos e o refresh antigo revogado no backend (ADR-0018)
    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("shottrack_access");
    expect(names).not.toContain("shottrack_refresh");
    expect((await refreshSession(oldRefresh)).status).toBe(401);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(currentPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Senha").fill(newPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);
  });

  test("mostra erro ao informar a senha atual incorreta", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    await page.goto("/usuario/senha");
    await page.getByLabel("Senha atual").fill("senhaErrada999");
    await page.getByLabel("Nova senha").fill("outraSenha456");
    await page.getByRole("button", { name: "Alterar senha" }).click();

    await expect(page.getByText(/senha atual incorreta/i)).toBeVisible();
    await expect(page).toHaveURL(/\/usuario\/senha/);
  });
});
