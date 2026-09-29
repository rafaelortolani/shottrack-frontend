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
  getValidWeaponCombo,
  registerWeapon,
  updateWeapon,
} from "./helpers";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas/);
}

// Dia do treino no backend é UTC — o filtro de período usa o mesmo critério
function utcDate(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Três séries num treino encerrado cada:
 * - Precisão, Pistola Alfa, 10 m, Agrupamento 3.2
 * - Precisão, Pistola Bravo, 25 m, Agrupamento 5.1
 * - Trap, Pistola Alfa, 25 m, Acertos 20
 */
async function seedHistory(token: string) {
  const location = await registerTrainingLocation(token, { name: "Clube de Tiro Alvorada", city: "Curitiba", state: "PR" });
  const catalog = await getModalityCatalog(token);
  const precisao = catalog.find((m) => m.name === "Precisão")!;
  const trap = catalog.find((m) => m.name === "Trap")!;
  await addPracticedModality(token, precisao.id);
  await addPracticedModality(token, trap.id);
  const agrupamento = (await getConfiguredResultTypes(token, precisao.id)).find((r) => r.name === "Agrupamento")!;
  const acertos = (await getConfiguredResultTypes(token, trap.id)).find((r) => r.name === "Acertos")!;

  const { model, caliber } = await getValidWeaponCombo(token);
  const alfa = await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });
  await updateWeapon(token, alfa.id, { modelId: model.id, caliberId: caliber.id, nickname: "Pistola Alfa" });
  const bravo = await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });
  await updateWeapon(token, bravo.id, { modelId: model.id, caliberId: caliber.id, nickname: "Pistola Bravo" });

  const visit = await startVisit(token, location.id);
  const seeds = [
    { modality: precisao, weapon: alfa, distanceMeters: 10, resultType: agrupamento, value: "3.2" },
    { modality: precisao, weapon: bravo, distanceMeters: 25, resultType: agrupamento, value: "5.1" },
    { modality: trap, weapon: alfa, distanceMeters: 25, resultType: acertos, value: "20" },
  ];
  for (const seed of seeds) {
    const training = await openTraining(token, visit.id, seed.modality.id);
    const series = await registerSeries(token, {
      trainingId: training.id,
      weaponId: seed.weapon.id,
      distanceMeters: seed.distanceMeters,
      shotCount: 25,
    });
    await registerSeriesResult(token, series.id, seed.resultType.id, seed.value);
    await closeTraining(token, training.id);
  }
  await closeVisit(token, visit.id);

  return { precisao, trap, alfa, bravo };
}

function seriesRows(page: Page) {
  return page.getByRole("list", { name: "Séries" }).getByRole("listitem");
}

async function setupAndOpen(page: Page) {
  const email = randomEmail();
  await createUser(email);
  const token = await loginAndGetToken(email);
  const seeded = await seedHistory(token);
  await login(page, email);
  await page.goto("/treinos/historico");
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
  await expect(seriesRows(page)).toHaveCount(3);
  return seeded;
}

test.describe("Histórico completo (FUC18)", () => {
  test("cada filtro funciona isoladamente", async ({ page }) => {
    const { trap, bravo } = await setupAndOpen(page);
    const clear = page.getByRole("group", { name: "Filtros" }).getByRole("button", { name: "Limpar filtros" });

    // Modalidade
    await page.getByLabel("Modalidade").selectOption(trap.id);
    await expect(seriesRows(page)).toHaveCount(1);
    await expect(seriesRows(page).first()).toContainText("Trap");
    await expect(seriesRows(page).first()).toContainText("Acertos: 20");
    await clear.click();
    await expect(seriesRows(page)).toHaveCount(3);

    // Arma
    await page.getByLabel("Arma").selectOption(bravo.id);
    await expect(seriesRows(page)).toHaveCount(1);
    await expect(seriesRows(page).first()).toContainText("Pistola Bravo");
    await clear.click();
    await expect(seriesRows(page)).toHaveCount(3);

    // Distância mínima e máxima
    await page.getByLabel("Distância mínima (m)").fill("20");
    await expect(seriesRows(page)).toHaveCount(2);
    await clear.click();
    await page.getByLabel("Distância máxima (m)").fill("15");
    await expect(seriesRows(page)).toHaveCount(1);
    await expect(seriesRows(page).first()).toContainText("Agrupamento: 3.2");
    await clear.click();
    await expect(seriesRows(page)).toHaveCount(3);

    // Período: até ontem não tem nada; o dia de hoje tem tudo
    await page.getByLabel("Até", { exact: true }).fill(utcDate(-1));
    await expect(page.getByText("Nenhuma série encontrada com esses filtros")).toBeVisible();
    await page.getByLabel("Até", { exact: true }).fill(utcDate());
    await page.getByLabel("De", { exact: true }).fill(utcDate());
    await expect(seriesRows(page)).toHaveCount(3);
  });

  test("combina filtros, cai no estado vazio e limpa por ele", async ({ page }) => {
    const { precisao, trap, alfa } = await setupAndOpen(page);

    await page.getByLabel("Modalidade").selectOption(precisao.id);
    await page.getByLabel("Arma").selectOption(alfa.id);
    await expect(seriesRows(page)).toHaveCount(1);
    await expect(seriesRows(page).first()).toContainText("Precisão · Pistola Alfa");

    // Trap + Alfa existe (25 m), mas não até 15 m
    await page.getByLabel("Modalidade").selectOption(trap.id);
    await expect(seriesRows(page)).toHaveCount(1);
    await page.getByLabel("Distância máxima (m)").fill("15");
    await expect(page.getByText("Nenhuma série encontrada com esses filtros")).toBeVisible();

    await page.getByRole("button", { name: "Limpar filtros" }).last().click();
    await expect(seriesRows(page)).toHaveCount(3);
    await expect(page.getByLabel("Modalidade")).toHaveValue("");
    await expect(page.getByLabel("Arma")).toHaveValue("");
    await expect(page.getByLabel("Distância máxima (m)")).toHaveValue("");
  });

  test("período com início depois do fim mostra erro e não filtra", async ({ page }) => {
    await setupAndOpen(page);

    await page.getByLabel("De", { exact: true }).fill(utcDate(1));
    await page.getByLabel("Até", { exact: true }).fill(utcDate());
    await expect(page.getByText("A data inicial não pode ser depois da data final")).toBeVisible();
    // a lista anterior continua, sem virar "nenhuma série"
    await expect(seriesRows(page)).toHaveCount(3);

    await page.getByLabel("De", { exact: true }).fill(utcDate());
    await expect(page.getByText("A data inicial não pode ser depois da data final")).toHaveCount(0);
    await expect(seriesRows(page)).toHaveCount(3);
  });

  test("abre o detalhe de uma série pela lista e edita mesmo com o treino encerrado", async ({ page }) => {
    await setupAndOpen(page);

    const row = seriesRows(page).filter({ hasText: "Agrupamento: 3.2" });
    await row.getByRole("button").first().click();
    const agrupamento = row.getByRole("spinbutton", { name: /Agrupamento/ });
    await expect(agrupamento).toHaveValue("3.2");
    await expect(row.getByLabel("Arma")).toHaveValue(/.+/);

    await agrupamento.fill("2.9");
    await row.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(row.getByRole("spinbutton", { name: /Agrupamento/ })).toHaveCount(0);
    await expect(seriesRows(page).filter({ hasText: "Agrupamento: 2.9" })).toHaveCount(1);

    // Persistiu no backend: recarregar mantém o valor novo
    await page.reload();
    await expect(seriesRows(page).filter({ hasText: "Agrupamento: 2.9" })).toHaveCount(1);
  });

  test("link Ver histórico completo do Dashboard leva pro histórico", async ({ page }) => {
    await setupAndOpen(page);
    await page.goto("/dashboard");

    await page.getByRole("region", { name: "Últimos treinos" }).getByRole("link", { name: "Ver histórico completo" }).click();
    await expect(page).toHaveURL(/\/treinos\/historico$/);
    await expect(seriesRows(page)).toHaveCount(3);
  });
});
