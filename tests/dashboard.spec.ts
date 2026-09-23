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

async function submitLogin(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("Dashboard com dados reais e landing condicional (FUC15)", () => {
  test("login sem visita ativa cai no Dashboard, com convite pra primeira visita", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByRole("group", { name: "Destaque" }).getByText("—", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Treinos esse mês" }).getByText("0", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Disparos esse mês" }).getByText("0", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Modalidades praticadas" }).getByText("—", { exact: true })).toBeVisible();
    await expect(page.getByText("NaN")).toHaveCount(0);

    await page.getByRole("link", { name: "Iniciar primeira visita" }).click();
    await expect(page).toHaveURL(/\/treinos\/visitas/);
  });

  test("login com visita ativa cai em Treinos > Visitas", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, {
      name: "Estande Sul",
      city: "Porto Alegre",
      state: "RS",
    });
    await startVisit(token, location.id);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/treinos\/visitas/);

    // Dashboard continua acessível pelo menu a qualquer momento
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Sua evolução" })).toBeVisible();
  });

  test("números do dashboard batem com os dados registrados", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const location = await registerTrainingLocation(token, {
      name: "Clube de Tiro Alvorada",
      city: "Curitiba",
      state: "PR",
    });
    const precisao = (await getModalityCatalog(token)).find((m) => m.name === "Precisão")!;
    await addPracticedModality(token, precisao.id);
    const agrupamento = (await getConfiguredResultTypes(token, precisao.id)).find((r) => r.name === "Agrupamento")!;

    const visit = await startVisit(token, location.id);
    const training = await openTraining(token, visit.id, precisao.id);
    const serieA = await registerSeries(token, { trainingId: training.id, shotCount: 10 });
    await registerSeriesResult(token, serieA.id, agrupamento.id, "3.2");
    const serieB = await registerSeries(token, { trainingId: training.id, shotCount: 15 });
    await registerSeriesResult(token, serieB.id, agrupamento.id, "4.4");
    await closeTraining(token, training.id);
    await closeVisit(token, visit.id);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/dashboard/);

    // destaque = Agrupamento (único tipo registrado), melhor = menor = 3,2; disparos 10 + 15 = 25
    const destaque = page.getByRole("group", { name: "Destaque" });
    await expect(destaque).toContainText("Melhor Agrupamento");
    await expect(destaque.getByText("3,2", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Treinos esse mês" }).getByText("1", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Disparos esse mês" }).getByText("25", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Modalidades praticadas" }).getByText("Precisão", { exact: true })).toBeVisible();

    const recentVisit = page.getByRole("link", { name: /Clube de Tiro Alvorada/ });
    await expect(recentVisit).toContainText("Precisão");
    await expect(page.getByRole("link", { name: "Iniciar primeira visita" })).not.toBeVisible();
  });
});
