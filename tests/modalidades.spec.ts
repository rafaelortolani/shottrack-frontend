import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getModalityCatalog,
  addPracticedModality,
} from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Modalidades praticadas (FUC06)", () => {
  test("mostra o estado vazio quando não há modalidade praticada", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await page.goto("/modalidades");

    await expect(page.getByText(/ainda não registrou nenhuma modalidade/i)).toBeVisible();
  });

  test("adiciona uma modalidade e reflete na lista imediatamente", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await page.goto("/modalidades");

    const addButton = page.getByRole("button", { name: /^Adicionar /i }).first();
    const label = await addButton.getAttribute("aria-label");
    const name = label!.replace(/^Adicionar /, "");

    await addButton.click();

    await expect(page.getByRole("button", { name: `Remover ${name}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Adicionar ${name}` })).not.toBeVisible();
    await expect(page.getByText(/ainda não registrou nenhuma modalidade/i)).not.toBeVisible();
  });

  test("remove uma modalidade sem afetar as demais", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const catalog = await getModalityCatalog(token);
    const [first, second] = catalog;
    await addPracticedModality(token, first.id);
    await addPracticedModality(token, second.id);

    await login(page, email);
    await page.goto("/modalidades");

    await expect(page.getByText(first.name)).toBeVisible();
    await expect(page.getByText(second.name)).toBeVisible();

    await page.getByRole("button", { name: `Remover ${first.name}` }).click();

    await expect(page.getByRole("button", { name: `Remover ${first.name}` })).not.toBeVisible();
    await expect(page.getByText(second.name)).toBeVisible();
    await expect(page.getByRole("button", { name: `Remover ${second.name}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Adicionar ${first.name}` })).toBeVisible();
  });
});
