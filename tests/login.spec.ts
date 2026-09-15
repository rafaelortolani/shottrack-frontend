import { test, expect } from "@playwright/test";
import { createUser, randomEmail } from "./helpers";

test.describe("Login", () => {
  test("entra com credenciais válidas e chega no dashboard", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("mostra erro com senha incorreta", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senhaErrada123");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("bloqueia acesso ao dashboard sem estar logado", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});