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

/**
 * Precisão, três armas:
 * - Pistola Alfa: 2 séries — Agrupamento 3 e 4 (média 3,5; melhor 3, menor
 *   é melhor), Pontuação 90 e 94 (média 92; melhor 94)
 * - Pistola Bravo: 1 série — Agrupamento 5, Pontuação 80
 * - Pistola Charlie: nenhuma série
 * Trap praticada sem série nenhuma, pro seletor encadeado ter o que trocar.
 */
async function seedComparison(token: string) {
  const location = await registerTrainingLocation(token, { name: "Clube de Tiro Alvorada", city: "Curitiba", state: "PR" });
  const catalog = await getModalityCatalog(token);
  const precisao = catalog.find((m) => m.name === "Precisão")!;
  const trap = catalog.find((m) => m.name === "Trap")!;
  await addPracticedModality(token, precisao.id);
  await addPracticedModality(token, trap.id);
  const configured = await getConfiguredResultTypes(token, precisao.id);
  const agrupamento = configured.find((r) => r.name === "Agrupamento")!;
  const pontuacao = configured.find((r) => r.name === "Pontuação")!;

  const { model, caliber } = await getValidWeaponCombo(token);
  const weapons: Record<string, { id: string }> = {};
  for (const nickname of ["Pistola Alfa", "Pistola Bravo", "Pistola Charlie"]) {
    const weapon = await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });
    await updateWeapon(token, weapon.id, { modelId: model.id, caliberId: caliber.id, nickname });
    weapons[nickname] = weapon;
  }

  const visit = await startVisit(token, location.id);
  const training = await openTraining(token, visit.id, precisao.id);
  const seeds = [
    { weapon: weapons["Pistola Alfa"], agrupamento: "3", pontuacao: "90" },
    { weapon: weapons["Pistola Alfa"], agrupamento: "4", pontuacao: "94" },
    { weapon: weapons["Pistola Bravo"], agrupamento: "5", pontuacao: "80" },
  ];
  for (const seed of seeds) {
    const series = await registerSeries(token, { trainingId: training.id, weaponId: seed.weapon.id, shotCount: 10 });
    await registerSeriesResult(token, series.id, agrupamento.id, seed.agrupamento);
    await registerSeriesResult(token, series.id, pontuacao.id, seed.pontuacao);
  }
  await closeTraining(token, training.id);
  await closeVisit(token, visit.id);

  return { precisao, trap };
}

async function setupAndOpen(page: Page) {
  const email = randomEmail();
  await createUser(email);
  const token = await loginAndGetToken(email);
  const seeded = await seedComparison(token);
  await login(page, email);

  // Entrada pela lista de Armas (FUC07)
  await page.goto("/acervo/armas");
  await page.getByRole("link", { name: "Comparar armas" }).click();
  await expect(page).toHaveURL(/\/acervo\/comparar$/);
  await expect(page.getByRole("heading", { name: "Comparar armas" })).toBeVisible();

  await page.getByLabel("Modalidade").selectOption(seeded.precisao.id);
  await page.getByLabel("Tipo de resultado").selectOption({ label: "Agrupamento" });
  return seeded;
}

function resultRow(page: Page, weapon: string) {
  return page.getByRole("region", { name: "Resultado" }).getByRole("row", { name: new RegExp(weapon) });
}

test.describe("Comparação entre armas (FUC19)", () => {
  test("Comparar só habilita com 2 armas e compara as duas com dado", async ({ page }) => {
    await setupAndOpen(page);
    const compare = page.getByRole("button", { name: "Comparar" });

    await expect(compare).toBeDisabled();
    await page.getByRole("checkbox", { name: /Pistola Alfa/ }).check();
    await expect(compare).toBeDisabled();
    await page.getByRole("checkbox", { name: /Pistola Bravo/ }).check();
    await expect(compare).toBeEnabled();
    await compare.click();

    const alfa = resultRow(page, "Pistola Alfa");
    await expect(alfa.getByRole("cell")).toHaveText(["2", "3,5 cm", "3 cm"]);
    await expect(resultRow(page, "Pistola Bravo").getByRole("cell")).toHaveText(["1", "5 cm", "5 cm"]);

    // Desmarcar uma volta a desabilitar e esconde o resultado
    await page.getByRole("checkbox", { name: /Pistola Bravo/ }).uncheck();
    await expect(compare).toBeDisabled();
    await expect(page.getByRole("region", { name: "Resultado" })).toHaveCount(0);
  });

  test("compara 3 armas, com a sem dado aparecendo com mensagem em vez de zero", async ({ page }) => {
    await setupAndOpen(page);

    for (const name of ["Pistola Alfa", "Pistola Bravo", "Pistola Charlie"]) {
      await page.getByRole("checkbox", { name: new RegExp(name) }).check();
    }
    await page.getByRole("button", { name: "Comparar" }).click();

    await expect(page.getByRole("region", { name: "Resultado" }).getByRole("row")).toHaveCount(4); // cabeçalho + 3
    await expect(resultRow(page, "Pistola Alfa").getByRole("cell")).toHaveText(["2", "3,5 cm", "3 cm"]);
    await expect(resultRow(page, "Pistola Bravo").getByRole("cell")).toHaveText(["1", "5 cm", "5 cm"]);
    const charlie = resultRow(page, "Pistola Charlie");
    await expect(charlie.getByRole("cell")).toHaveText(["Sem dados nesse período/modalidade"]);
    await expect(charlie).not.toContainText("0");
  });

  test("trocar tipo de resultado e modalidade recalcula a comparação", async ({ page }) => {
    const { trap } = await setupAndOpen(page);

    await page.getByRole("checkbox", { name: /Pistola Alfa/ }).check();
    await page.getByRole("checkbox", { name: /Pistola Bravo/ }).check();
    await page.getByRole("button", { name: "Comparar" }).click();
    await expect(resultRow(page, "Pistola Alfa").getByRole("cell")).toHaveText(["2", "3,5 cm", "3 cm"]);

    // Pontuação: maior é melhor
    await page.getByLabel("Tipo de resultado").selectOption({ label: "Pontuação" });
    await expect(page.getByRole("region", { name: "Resultado" })).toContainText("Pontuação — Precisão");
    await expect(resultRow(page, "Pistola Alfa").getByRole("cell")).toHaveText(["2", "92", "94"]);
    await expect(resultRow(page, "Pistola Bravo").getByRole("cell")).toHaveText(["1", "80", "80"]);

    // Encadeado: trocar a modalidade troca os tipos disponíveis
    await page.getByLabel("Modalidade").selectOption(trap.id);
    await expect(page.getByLabel("Tipo de resultado").locator("option", { hasText: "Agrupamento" })).toHaveCount(0);
    await expect(page.getByLabel("Tipo de resultado").locator("option", { hasText: "Acertos" })).toHaveCount(1);
    await expect(resultRow(page, "Pistola Alfa").getByRole("cell")).toHaveText(["Sem dados nesse período/modalidade"]);
  });
});
