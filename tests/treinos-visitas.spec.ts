import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getModalityCatalog,
  addPracticedModality,
  registerTrainingLocation,
  startVisit,
  openTraining,
  closeVisit,
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
    await page.goto("/treinos/visitas");

    await expect(page.getByText("Nenhuma visita em andamento.")).toBeVisible();

    await page.getByRole("link", { name: "Iniciar visita" }).click();
    await expect(page).toHaveURL(/\/treinos\/nova/);
    await page.getByLabel("Local de treino").selectOption({ label: `${location.name} · ${location.city}/${location.state}` });
    await page.getByRole("button", { name: "Iniciar" }).click();

    await expect(page).toHaveURL(/\/treinos\/visitas$/);
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

  test("filtra o histórico por local e por modalidade", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const locationA = await registerTrainingLocation(token, { name: "Estande Sul", city: "Curitiba", state: "PR" });
    const locationB = await registerTrainingLocation(token, { name: "Clube Norte", city: "Manaus", state: "AM" });
    const modalityCatalog = await getModalityCatalog(token);
    const [modalityA, modalityB] = modalityCatalog;
    await addPracticedModality(token, modalityA.id);
    await addPracticedModality(token, modalityB.id);

    const visitA = await startVisit(token, locationA.id);
    await openTraining(token, visitA.id, modalityA.id);
    await closeVisit(token, visitA.id);

    const visitB = await startVisit(token, locationB.id);
    await openTraining(token, visitB.id, modalityB.id);
    await closeVisit(token, visitB.id);

    await login(page, email);
    await page.goto("/treinos/visitas");

    await expect(page.getByText(locationA.name)).toBeVisible();
    await expect(page.getByText(locationB.name)).toBeVisible();

    // Busca por local
    await page.getByLabel("Buscar visita por local").fill("sul");
    await expect(page.getByText(locationA.name)).toBeVisible();
    await expect(page.getByText(locationB.name)).not.toBeVisible();

    // Filtra por modalidade
    await page.getByLabel("Buscar visita por local").fill("");
    await page.getByLabel("Filtrar por modalidade").selectOption({ label: modalityB.name });
    await expect(page.getByText(locationB.name)).toBeVisible();
    await expect(page.getByText(locationA.name)).not.toBeVisible();

    await page.getByLabel("Filtrar por modalidade").selectOption("");
    await expect(page.getByText(locationA.name)).toBeVisible();
    await expect(page.getByText(locationB.name)).toBeVisible();
  });

  test("filtra o histórico por data inicial e final", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const location = await registerTrainingLocation(token, {
      name: "Clube de Tiro Alvorada",
      city: "Curitiba",
      state: "PR",
    });
    const visit = await startVisit(token, location.id);
    await closeVisit(token, visit.id);

    // Os filtros só aparecem com mais de uma visita no histórico (mesmo
    // padrão do Acervo) — essa segunda visita só serve pra isso.
    const otherLocation = await registerTrainingLocation(token, { name: "Outro local", city: "Curitiba", state: "PR" });
    const otherVisit = await startVisit(token, otherLocation.id);
    await closeVisit(token, otherVisit.id);

    await login(page, email);
    await page.goto("/treinos/visitas");

    await expect(page.getByText(location.name)).toBeVisible();

    const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Fora do período: data final antes de hoje
    await page.getByLabel("Até", { exact: true }).fill(toDateInput(yesterday));
    await expect(page.getByText("Nenhuma visita encontrada com esses filtros.")).toBeVisible();

    // Fora do período: data inicial depois de hoje
    await page.getByLabel("Até", { exact: true }).fill("");
    await page.getByLabel("De", { exact: true }).fill(toDateInput(tomorrow));
    await expect(page.getByText("Nenhuma visita encontrada com esses filtros.")).toBeVisible();

    // Dentro do período: hoje está entre ontem e amanhã
    await page.getByLabel("De", { exact: true }).fill(toDateInput(yesterday));
    await page.getByLabel("Até", { exact: true }).fill(toDateInput(tomorrow));
    await expect(page.getByText(location.name)).toBeVisible();
  });
});
