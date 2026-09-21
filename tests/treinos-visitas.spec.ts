import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getModalityCatalog,
  addPracticedModality,
  registerTrainingLocation,
} from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Treinos > Visitas (FUC13)", () => {
  test("inicia visita, abre 2 treinos, encerra 1 manualmente e encerra a visita com o outro em cascata", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const location = await registerTrainingLocation(token, {
      name: "Clube de Tiro Alvorada",
      city: "Curitiba",
      state: "PR",
    });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);

    await login(page, email);
    await page.goto("/treinos");

    await expect(page.getByText("Nenhuma visita em andamento.")).toBeVisible();

    await page.getByRole("link", { name: "Iniciar visita" }).click();
    await expect(page).toHaveURL(/\/treinos\/nova/);
    await page.getByLabel("Local de treino").selectOption({ label: `${location.name} · ${location.city}/${location.state}` });
    await page.getByRole("button", { name: "Iniciar" }).click();

    await expect(page).toHaveURL(/\/treinos$/);
    await expect(page.getByText("Visita em andamento", { exact: true })).toBeVisible();
    await expect(page.getByText(location.name)).toBeVisible();

    // Abre o primeiro treino
    await page.getByRole("button", { name: "+ Abrir novo treino" }).click();
    await page.getByLabel("Modalidade").selectOption({ label: modality.name });
    await page.getByRole("button", { name: "Abrir" }).click();
    await expect(page.locator("li", { hasText: modality.name })).toHaveCount(1);

    // Abre o segundo treino, mesma modalidade
    await page.getByRole("button", { name: "+ Abrir novo treino" }).click();
    await page.getByLabel("Modalidade").selectOption({ label: modality.name });
    await page.getByRole("button", { name: "Abrir" }).click();
    await expect(page.locator("li", { hasText: modality.name })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Encerrar", exact: true })).toHaveCount(2);

    // Encerra o primeiro treino manualmente
    await page.getByRole("button", { name: "Encerrar", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Encerrar", exact: true })).toHaveCount(1);

    // Encerra a visita com o outro treino ainda aberto — confirma a cascata
    await page.getByRole("button", { name: "Encerrar visita" }).click();
    const dialog = page.getByRole("dialog", { name: "Encerrar visita" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/você tem 1 treino em andamento/i)).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog).not.toBeVisible();

    await expect(page.getByText("Visita em andamento", { exact: true })).not.toBeVisible();
    await expect(page.getByText("Nenhuma visita em andamento.")).toBeVisible();

    // Confere a visita no histórico
    await expect(page.getByText("Histórico")).toBeVisible();
    const historyItem = page.locator("li", { hasText: location.name });
    await expect(historyItem).toBeVisible();
    await expect(historyItem.getByText(modality.name)).toBeVisible();
  });
});
