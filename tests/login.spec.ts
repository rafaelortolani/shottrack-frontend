import { test, expect } from "@playwright/test";
import { createUser, randomEmail } from "./helpers";

test.describe("Login", () => {
  test("entra com credenciais válidas e chega em boas-vindas", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/boas-vindas/);
  });

  test("entra com o e-mail digitado em maiúsculas (o backend normaliza para minúsculas)", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    for (const typed of [email.toUpperCase(), email.replace(/^(.)/, (c) => c.toUpperCase())]) {
      await page.goto("/login");
      await page.getByLabel("Email").fill(typed);
      await page.getByLabel("Senha").fill("senha12345");
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/boas-vindas/);
      await page.request.post("/api/auth/logout");
    }
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

  test("o olho mostra e oculta a senha digitada", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel("Senha");
    await expect(async () => {
      await page.getByLabel("Senha").fill("senha12345");
      await expect(password).toHaveAttribute("type", "password");
    }).toPass();

    await page.getByRole("button", { name: "Mostrar caracteres" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("senha12345");

    await page.getByRole("button", { name: "Ocultar caracteres" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("bloqueia acesso ao dashboard sem estar logado", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});