import { test, expect, type Page } from "@playwright/test";
import { createUser, randomEmail } from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Navegação — hub e breadcrumb", () => {
  test("hub do Acervo mostra os cards e navega pra Armas", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await page.goto("/acervo");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Acervo" })).toBeVisible();
    await expect(main.getByRole("link", { name: /Armas/ })).toBeVisible();
    await expect(main.getByRole("link", { name: /Munições/ })).toBeVisible();
    await expect(main.getByRole("link", { name: /Acessórios/ })).toBeVisible();

    await main.getByRole("link", { name: /Armas/ }).click();
    await expect(page).toHaveURL(/\/acervo\/armas$/);
    await expect(page.getByRole("heading", { name: "Armas" })).toBeVisible();
  });

  test("hub do Usuário mostra os cards e navega pra Perfil", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await page.goto("/usuario");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Usuário" })).toBeVisible();
    await expect(main.getByRole("link", { name: /Perfil/ })).toBeVisible();
    await expect(main.getByRole("link", { name: /Modalidades/ })).toBeVisible();

    await main.getByRole("link", { name: /Perfil/ }).click();
    await expect(page).toHaveURL(/\/usuario\/perfil$/);
    await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
  });

  test("breadcrumb volta pro hub do Acervo", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await page.goto("/acervo/armas");
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Acervo" }).click();

    await expect(page).toHaveURL(/\/acervo$/);
    await expect(page.getByRole("heading", { name: "Acervo" })).toBeVisible();
  });

  test("hub de Treinos mostra os cards e navega pra Visitas", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await page.goto("/treinos");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Treinos" })).toBeVisible();
    await expect(main.getByRole("link", { name: /Visitas/ })).toBeVisible();
    await expect(main.getByRole("link", { name: /Locais/ })).toBeVisible();

    await main.getByRole("link", { name: /Visitas/ }).click();
    await expect(page).toHaveURL(/\/treinos\/visitas$/);
    await expect(page.getByRole("heading", { name: "Visitas" })).toBeVisible();
  });

  test("breadcrumb volta pro hub de Treinos", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await page.goto("/treinos/locais");
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Treinos" }).click();

    await expect(page).toHaveURL(/\/treinos$/);
    await expect(page.getByRole("heading", { name: "Treinos" })).toBeVisible();
  });
});
