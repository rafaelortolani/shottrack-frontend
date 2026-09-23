import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getModalityCatalog,
  addPracticedModality,
  getConfiguredResultTypes,
  registerTrainingLocation,
  startVisit,
  closeVisit,
  openTraining,
  closeTraining,
  registerSeries,
  registerSeriesResult,
} from "./helpers";

async function loginToDashboard(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

// A tabela do gráfico (acessível, fora da tela) traz todos os pontos
function chartTable(page: Page) {
  return page.getByRole("region", { name: "Evolução" }).getByRole("table");
}

/**
 * Precisão: Agrupamento 3,2 e 4,4 no mesmo dia (média 3,8; melhor 3,2 —
 * menor é melhor). Trap: Acertos 20. Dois treinos de Precisão contra um de
 * Trap, pra Precisão ser a modalidade inicial.
 */
async function seedTwoModalities(token: string) {
  const location = await registerTrainingLocation(token, { name: "Clube de Tiro Alvorada", city: "Curitiba", state: "PR" });
  const catalog = await getModalityCatalog(token);
  const precisao = catalog.find((m) => m.name === "Precisão")!;
  const trap = catalog.find((m) => m.name === "Trap")!;
  await addPracticedModality(token, precisao.id);
  await addPracticedModality(token, trap.id);
  const agrupamento = (await getConfiguredResultTypes(token, precisao.id)).find((r) => r.name === "Agrupamento")!;
  const acertos = (await getConfiguredResultTypes(token, trap.id)).find((r) => r.name === "Acertos")!;

  const visit = await startVisit(token, location.id);
  for (const value of ["3.2", "4.4"]) {
    const training = await openTraining(token, visit.id, precisao.id);
    const series = await registerSeries(token, { trainingId: training.id, shotCount: 10 });
    await registerSeriesResult(token, series.id, agrupamento.id, value);
    await closeTraining(token, training.id);
  }
  const trapTraining = await openTraining(token, visit.id, trap.id);
  const trapSeries = await registerSeries(token, { trainingId: trapTraining.id, shotCount: 25 });
  await registerSeriesResult(token, trapSeries.id, acertos.id, "20");
  await closeTraining(token, trapTraining.id);
  await closeVisit(token, visit.id);

  return { precisao, trap };
}

test.describe("Evolução no dashboard (FUC16)", () => {
  test("troca modo, período e modalidade, recarregando o gráfico sem sair da tela", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { precisao, trap } = await seedTwoModalities(token);

    await loginToDashboard(page, email);
    const evolution = page.getByRole("region", { name: "Evolução" });
    await expect(evolution).toBeVisible();

    // Seleção inicial: modalidade mais treinada, tipo com recorde, 30 dias, Média
    await expect(evolution.getByLabel("Modalidade")).toHaveValue(precisao.id);
    await expect(evolution.getByLabel("Tipo de resultado").locator("option:checked")).toHaveText("Agrupamento");
    await expect(evolution.getByRole("tab", { name: "30 dias" })).toHaveAttribute("aria-selected", "true");
    await expect(evolution.getByRole("button", { name: "Média" })).toHaveAttribute("aria-pressed", "true");
    await expect(chartTable(page).getByRole("cell", { name: "3,8 cm" })).toBeVisible();

    // Modo Melhor: mesmo gráfico, menor valor do dia (Agrupamento: menor é melhor)
    await evolution.getByRole("button", { name: "Melhor" }).click();
    await expect(evolution.getByRole("button", { name: "Melhor" })).toHaveAttribute("aria-pressed", "true");
    await expect(chartTable(page).getByRole("cell", { name: "3,2 cm" })).toBeVisible();
    await expect(evolution.getByRole("table", { name: /Melhor diária de Agrupamento/ })).toHaveCount(1);

    // As 4 abas de período recarregam o gráfico (o dado de hoje entra em todas)
    for (const [label, code] of [["7 dias", "7d"], ["3 meses", "3m"], ["1 ano", "1a"], ["30 dias", "30d"]]) {
      const request = page.waitForRequest((r) => r.url().includes("/api/dashboard/evolution") && r.url().includes(`period=${code}`));
      await evolution.getByRole("tab", { name: label }).click();
      await request;
      await expect(evolution.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
      await expect(chartTable(page).getByRole("cell", { name: "3,2 cm" })).toBeVisible();
    }

    // Trocar modalidade reinicia o tipo pro da nova modalidade
    await evolution.getByLabel("Modalidade").selectOption(trap.id);
    await expect(evolution.getByLabel("Tipo de resultado").locator("option:checked")).toHaveText("Acertos");
    await expect(chartTable(page).getByRole("cell", { name: "20", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("combinação sem dado no período mostra estado vazio, sem gráfico solto", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { trap } = await seedTwoModalities(token);

    await loginToDashboard(page, email);
    const evolution = page.getByRole("region", { name: "Evolução" });
    await evolution.getByLabel("Modalidade").selectOption(trap.id);
    // "Erros" está configurado no Trap, mas nunca foi preenchido
    await evolution.getByLabel("Tipo de resultado").selectOption({ label: "Erros" });

    await expect(evolution.getByText("Nenhum registro nesse período")).toBeVisible();
    await expect(evolution.getByRole("img")).toHaveCount(0);
    await expect(evolution.getByRole("table")).toHaveCount(0);
  });

  test("seção ausente sem modalidade praticada", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await loginToDashboard(page, email);
    await expect(page.getByRole("region", { name: "Ação principal" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Evolução" })).toHaveCount(0);
  });
});
