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

test.describe("Usuário > Modalidades (FUC06)", () => {
  test("mostra o estado inicial sem nenhuma modalidade marcada", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await page.goto("/usuario/modalidades");

    await expect(page.getByText(/toque numa modalidade/i)).toBeVisible();
    await expect(page.getByText("0 modalidades selecionadas")).toBeVisible();

    const chips = page.getByRole("button", { pressed: false });
    expect(await chips.count()).toBeGreaterThanOrEqual(2);
  });

  test("marca um chip e reflete no contador imediatamente", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const catalog = await getModalityCatalog(token);
    const [first] = catalog;

    await login(page, email);
    await page.goto("/usuario/modalidades");

    const chip = page.getByRole("button", { name: first.name, exact: true });
    await expect(chip).toHaveAttribute("aria-pressed", "false");

    await chip.click();

    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1 modalidade selecionada")).toBeVisible();
  });

  test("desmarca um chip sem afetar os demais", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const catalog = await getModalityCatalog(token);
    const [first, second] = catalog;
    await addPracticedModality(token, first.id);
    await addPracticedModality(token, second.id);

    await login(page, email);
    await page.goto("/usuario/modalidades");

    const firstChip = page.getByRole("button", { name: first.name, exact: true });
    const secondChip = page.getByRole("button", { name: second.name, exact: true });
    await expect(firstChip).toHaveAttribute("aria-pressed", "true");
    await expect(secondChip).toHaveAttribute("aria-pressed", "true");

    await firstChip.click();

    await expect(firstChip).toHaveAttribute("aria-pressed", "false");
    await expect(secondChip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1 modalidade selecionada")).toBeVisible();
  });
});
