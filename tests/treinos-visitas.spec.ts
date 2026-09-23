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
  deleteTraining,
  registerSeries,
} from "./helpers";

// Landing pós-login depende de ter visita em andamento (FUC15)
async function login(page: Page, email: string, landing: RegExp = /\/dashboard/) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(landing);
}

test.describe("Treinos > Visitas (FUC13)", () => {
  test("inicia visita, abre 3 treinos, encerra 1, exclui 1 e encerra a visita com o outro em cascata", async ({ page }) => {
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

    // Visita sem treino: estado vazio com CTA em destaque, sem o botão secundário
    const emptyState = page.getByRole("group", { name: "Nenhum treino aberto ainda" });
    await expect(emptyState).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir novo treino" })).not.toBeVisible();

    // Abre o primeiro treino pelo CTA do estado vazio
    await emptyState.getByRole("button", { name: "Abrir treino" }).click();
    await page.getByLabel("Modalidade").selectOption({ label: modality.name });
    await page.getByRole("button", { name: "Abrir", exact: true }).click();
    await expect(page.locator("li", { hasText: modality.name })).toHaveCount(1);
    await expect(emptyState).not.toBeVisible();

    // Treino recém-aberto já mostra o estado vazio de série, sem expandir nada
    await expect(page.getByRole("group", { name: "Nenhuma série registrada ainda" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar série", exact: true })).toBeVisible();

    // Com treino aberto, aparece o botão "Abrir novo treino" — abre mais dois, mesma modalidade
    for (const expectedCount of [2, 3]) {
      await page.getByRole("button", { name: "Abrir novo treino" }).click();
      await page.getByLabel("Modalidade").selectOption({ label: modality.name });
      await page.getByRole("button", { name: "Abrir", exact: true }).click();
      await expect(page.locator("li", { hasText: modality.name })).toHaveCount(expectedCount);
    }
    await expect(page.getByRole("button", { name: "Encerrar", exact: true })).toHaveCount(3);

    // Encerra o primeiro treino manualmente
    await page.getByRole("button", { name: "Encerrar", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Encerrar", exact: true })).toHaveCount(2);

    // Exclui um dos treinos em andamento — confirmação avisa das séries
    await page.getByRole("button", { name: "Excluir", exact: true }).last().click();
    const deleteDialog = page.getByRole("dialog", { name: "Excluir treino" });
    await expect(deleteDialog.getByText(/todas as séries dele serão excluídos/i)).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(deleteDialog).not.toBeVisible();
    await expect(page.locator("li", { hasText: modality.name })).toHaveCount(2);
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

  test("exclui a visita em andamento com treinos, avisando da cascata", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const location = await registerTrainingLocation(token, { name: "Estande Sul", city: "Curitiba", state: "PR" });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);
    const visit = await startVisit(token, location.id);
    await openTraining(token, visit.id, modality.id);
    await openTraining(token, visit.id, modality.id);

    await login(page, email, /\/treinos\/visitas/);
    await expect(page.getByText("Visita em andamento", { exact: true })).toBeVisible();

    // Cancelar não exclui nada
    await page.getByRole("button", { name: "Excluir visita" }).click();
    const dialog = page.getByRole("dialog", { name: "Excluir visita" });
    await expect(dialog.getByText(/os 2 treinos dela e todas as séries serão excluídos/i)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("Visita em andamento", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Excluir visita" }).click();
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog).not.toBeVisible();

    await expect(page.getByText("Visita em andamento", { exact: true })).not.toBeVisible();
    await expect(page.getByText("Nenhuma visita em andamento.")).toBeVisible();
    // Excluída de verdade: não vai pro histórico, nem volta ao recarregar
    await expect(page.getByText("Nenhuma visita encerrada ainda.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Nenhuma visita em andamento.")).toBeVisible();
    await expect(page.getByText(location.name)).not.toBeVisible();
  });

  test("no detalhe de uma visita encerrada, exclui série, treino e a própria visita", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const location = await registerTrainingLocation(token, { name: "Clube Norte", city: "Manaus", state: "AM" });
    const [modalityA, modalityB] = await getModalityCatalog(token);
    await addPracticedModality(token, modalityA.id);
    await addPracticedModality(token, modalityB.id);
    const visit = await startVisit(token, location.id);
    const trainingA = await openTraining(token, visit.id, modalityA.id);
    await openTraining(token, visit.id, modalityB.id);
    await registerSeries(token, { trainingId: trainingA.id });
    await closeVisit(token, visit.id);

    await login(page, email);
    await page.goto("/treinos/visitas");
    await page.getByRole("link", { name: new RegExp(location.name) }).click();
    await expect(page).toHaveURL(new RegExp(`/treinos/${visit.id}`));
    await expect(page.getByText("Encerrada", { exact: true })).toBeVisible();

    const trainingItemA = page.locator("li", { hasText: modalityA.name });

    // Série de treino encerrado: excluir direto na linha, sem abrir a edição
    await trainingItemA.getByRole("button", { name: "Séries" }).click();
    await trainingItemA.getByRole("button", { name: "Excluir série 1" }).click();
    await page.getByRole("dialog", { name: "Excluir série" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(trainingItemA.getByText("Nenhuma série registrada ainda.")).toBeVisible();

    // Treino encerrado
    await trainingItemA.getByRole("button", { name: "Excluir", exact: true }).click();
    const trainingDialog = page.getByRole("dialog", { name: "Excluir treino" });
    await expect(trainingDialog.getByText(`O treino de ${modalityA.name} e todas as séries dele`)).toBeVisible();
    await trainingDialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(trainingItemA).toHaveCount(0);
    await expect(page.locator("li", { hasText: modalityB.name })).toHaveCount(1);

    // Visita encerrada: volta pra Visitas, e some do histórico
    await page.getByRole("button", { name: "Excluir visita" }).click();
    const visitDialog = page.getByRole("dialog", { name: "Excluir visita" });
    await expect(visitDialog.getByText(/o treino dela e todas as séries serão excluídos/i)).toBeVisible();
    await visitDialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(page).toHaveURL(/\/treinos\/visitas$/);
    await expect(page.getByText("Nenhuma visita encerrada ainda.")).toBeVisible();
  });

  test("mostra erro ao excluir treino que já não existe mais", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const location = await registerTrainingLocation(token, { name: "Estande Sul", city: "Curitiba", state: "PR" });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);
    const visit = await startVisit(token, location.id);
    const training = await openTraining(token, visit.id, modality.id);

    await login(page, email, /\/treinos\/visitas/);
    await expect(page.locator("li", { hasText: modality.name })).toHaveCount(1);

    // Excluído por fora (ex: outra aba) depois que a tela já carregou
    await deleteTraining(token, training.id);

    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await page.getByRole("dialog", { name: "Excluir treino" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Excluir treino" })).not.toBeVisible();
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

    // Data local (não UTC): o filtro compara com o dia local do navegador —
    // toISOString() viraria o dia depois das 21h em UTC-3.
    const toDateInput = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
