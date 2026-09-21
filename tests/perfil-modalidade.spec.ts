import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getModalityCatalog,
  getResultTypeCatalog,
  getConfiguredResultTypes,
} from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Usuário > Perfil de modalidade — tipos de resultado (FUC12)", () => {
  test("configura tipos de resultado de uma modalidade recém-praticada", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const modalityCatalog = await getModalityCatalog(token);
    const [modality] = modalityCatalog;
    const resultTypeCatalog = await getResultTypeCatalog(token);

    await login(page, email);
    await page.goto("/usuario/modalidades");

    const chip = page.getByRole("button", { name: modality.name, exact: true });
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");

    const configureButton = page.getByRole("button", {
      name: `Configurar tipos de resultado de ${modality.name}`,
    });
    await expect(configureButton).toBeVisible();
    await configureButton.click();

    const dialog = page.getByRole("dialog", { name: `${modality.name} — tipos de resultado` });
    await expect(dialog).toBeVisible();

    const configured = await getConfiguredResultTypes(token, modality.id);
    expect(configured.length).toBeGreaterThan(0);
    const [defaultType] = configured;
    const defaultChip = dialog.getByRole("button", { name: defaultType.name });
    await expect(defaultChip).toHaveAttribute("aria-pressed", "true");

    const newType = resultTypeCatalog.find((t) => !configured.some((c) => c.id === t.id));
    expect(newType).toBeTruthy();
    const newChip = dialog.getByRole("button", { name: newType!.name });
    await expect(newChip).toHaveAttribute("aria-pressed", "false");
    await newChip.click();
    await expect(newChip).toHaveAttribute("aria-pressed", "true");

    await defaultChip.click();
    await expect(defaultChip).toHaveAttribute("aria-pressed", "false");
    await expect(newChip).toHaveAttribute("aria-pressed", "true");
  });
});
