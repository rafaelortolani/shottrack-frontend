import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  updateProfile,
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
  getWeaponCatalog,
  getWeaponModels,
  registerWeapon,
} from "./helpers";

async function submitLogin(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function registerAnyWeapon(token: string, nickname?: string) {
  const catalog = await getWeaponCatalog(token);
  const brand = catalog.brands[0];
  const [model] = await getWeaponModels(token, brand.id);
  await registerWeapon(token, {
    typeId: catalog.types[0].id,
    brandId: brand.id,
    modelId: model.id,
    caliberId: catalog.calibers[0].id,
    ...(nickname ? { nickname } : {}),
  });
}

function onboardingItem(page: Page, label: string) {
  return page.getByRole("region", { name: "Configuração inicial" }).getByRole("listitem").filter({ hasText: label });
}

test.describe("Dashboard Onda 1 e landing condicional (FUC15)", () => {
  test("atleta novo vê onboarding completo, convite pra treinar e seções vazias sem indicador artificial", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/dashboard/);

    const onboarding = page.getByRole("region", { name: "Configuração inicial" });
    await expect(onboarding).toBeVisible();
    await expect(onboarding.getByText("0 de 3 concluídos")).toBeVisible();
    for (const label of ["Criar perfil", "Configurar modalidades", "Cadastrar arma"]) {
      await expect(onboardingItem(page, label)).toBeVisible();
    }

    const mainAction = page.getByRole("region", { name: "Ação principal" });
    await expect(mainAction.getByText("Pronto pra treinar?")).toBeVisible();

    // Sem resultado registrado, nenhum recorde "vazio"
    await expect(page.getByRole("region", { name: "Recordes" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Treinos esse mês" }).getByText("0", { exact: true })).toBeVisible();
    await expect(page.getByText("NaN")).toHaveCount(0);

    await expect(page.getByRole("region", { name: "Últimos treinos" }).getByText(/Ainda não há treinos/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Modalidades" }).getByText(/Nenhum treino registrado/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Acervo" }).getByText("Nenhuma arma cadastrada ainda.")).toBeVisible();

    // "Continuar configuração" leva pra primeira pendência
    await onboarding.getByRole("link", { name: "Continuar configuração" }).click();
    await expect(page).toHaveURL(/\/usuario\/perfil/);
  });

  test("completar uma pendência tira ela da lista, e o onboarding some quando completo", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(onboardingItem(page, "Configurar modalidades")).toBeVisible();

    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);
    await page.reload();

    await expect(onboardingItem(page, "Configurar modalidades")).toHaveCount(0);
    await expect(onboardingItem(page, "Criar perfil")).toBeVisible();
    await expect(onboardingItem(page, "Cadastrar arma")).toBeVisible();
    await expect(page.getByRole("region", { name: "Configuração inicial" }).getByText("1 de 3 concluídos")).toBeVisible();

    // Perfil ainda pendente → continua sendo o primeiro destino
    await expect(page.getByRole("link", { name: "Continuar configuração" })).toHaveAttribute("href", "/usuario/perfil");

    await updateProfile(token, { name: "Atleta Teste", experienceLevel: "INTERMEDIATE" });
    await page.reload();
    await expect(onboardingItem(page, "Criar perfil")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Continuar configuração" })).toHaveAttribute("href", "/acervo/armas/nova");

    await registerAnyWeapon(token);
    await page.reload();

    await expect(page.getByRole("region", { name: "Ação principal" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Configuração inicial" })).toHaveCount(0);
  });

  test("ação principal muda pra 'Continuar treino' ao iniciar uma visita", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, { name: "Estande Sul", city: "Porto Alegre", state: "RS" });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/dashboard/);
    const mainAction = page.getByRole("region", { name: "Ação principal" });
    await expect(mainAction.getByText("Pronto pra treinar?")).toBeVisible();

    const visit = await startVisit(token, location.id);
    await openTraining(token, visit.id, modality.id);
    await page.reload();

    await expect(mainAction.getByText("Visita em andamento")).toBeVisible();
    await expect(mainAction.getByText(location.name)).toBeVisible();
    await expect(mainAction.getByText(modality.name)).toBeVisible();
    await expect(mainAction.getByText("Pronto pra treinar?")).toHaveCount(0);

    await mainAction.getByRole("link", { name: "Continuar treino" }).click();
    await expect(page).toHaveURL(/\/treinos\/visitas/);
  });

  test("recordes em lista, últimos treinos com e sem métrica, resumo de modalidades e de acervo", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const location = await registerTrainingLocation(token, { name: "Clube de Tiro Alvorada", city: "Curitiba", state: "PR" });
    const catalog = await getModalityCatalog(token);
    const precisao = catalog.find((m) => m.name === "Precisão")!;
    const outra = catalog.find((m) => m.name !== "Precisão")!;
    await addPracticedModality(token, precisao.id);
    await addPracticedModality(token, outra.id);
    const configured = await getConfiguredResultTypes(token, precisao.id);
    const agrupamento = configured.find((r) => r.name === "Agrupamento")!;
    const pontuacao = configured.find((r) => r.name === "Pontuação")!;
    await registerAnyWeapon(token, "Minha pistola");

    const visit = await startVisit(token, location.id);
    // Treino com resultado: melhor agrupamento = menor = 3,2 cm
    const comMetrica = await openTraining(token, visit.id, precisao.id);
    const serieA = await registerSeries(token, { trainingId: comMetrica.id, shotCount: 10 });
    await registerSeriesResult(token, serieA.id, agrupamento.id, "4.4");
    const serieB = await registerSeries(token, { trainingId: comMetrica.id, shotCount: 15 });
    await registerSeriesResult(token, serieB.id, agrupamento.id, "3.2");
    await registerSeriesResult(token, serieB.id, pontuacao.id, "92");
    await closeTraining(token, comMetrica.id);
    // Treino sem nenhum resultado
    const semMetrica = await openTraining(token, visit.id, outra.id);
    await registerSeries(token, { trainingId: semMetrica.id, shotCount: 5 });
    await closeTraining(token, semMetrica.id);
    await closeVisit(token, visit.id);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/dashboard/);

    // Recordes: um por tipo com registro, cada um com o melhor valor
    const records = page.getByRole("region", { name: "Recordes" }).getByRole("listitem");
    await expect(records).toHaveCount(2);
    await expect(records.filter({ hasText: "Agrupamento" })).toContainText("3,2");
    await expect(records.filter({ hasText: "Agrupamento" })).toContainText("cm");
    await expect(records.filter({ hasText: "Pontuação" })).toContainText("92");
    await expect(page.getByRole("group", { name: "Disparos esse mês" }).getByText("30", { exact: true })).toBeVisible();

    // Últimos treinos: um com métrica, outro só com data/local/modalidade
    const recent = page.getByRole("region", { name: "Últimos treinos" });
    const rowComMetrica = recent.getByRole("link", { name: new RegExp(precisao.name) });
    await expect(rowComMetrica).toContainText("Agrupamento: 3,2 cm");
    await expect(rowComMetrica).toContainText(location.name);
    const rowSemMetrica = recent.getByRole("link", { name: new RegExp(outra.name) });
    await expect(rowSemMetrica).toContainText(location.name);
    await expect(rowSemMetrica).not.toContainText(":");
    await expect(recent.getByRole("link", { name: "Ver todos" })).toHaveCount(0);

    // Resumo de modalidades: contagem e melhor valor por modalidade
    const modalities = page.getByRole("region", { name: "Modalidades" });
    const precisaoRow = modalities.getByRole("listitem").filter({ hasText: precisao.name });
    await expect(precisaoRow).toContainText("1 treino");
    await expect(precisaoRow).toContainText("Melhor Agrupamento: 3,2 cm");
    await expect(modalities.getByRole("listitem").filter({ hasText: outra.name })).not.toContainText("Melhor");
    await expect(modalities.getByRole("link", { name: "Ver modalidades" })).toHaveAttribute("href", "/usuario/modalidades");

    // Resumo de acervo
    const acervo = page.getByRole("region", { name: "Acervo" });
    await expect(acervo.getByText("1 arma", { exact: true })).toBeVisible();
    await expect(acervo.getByText("Minha pistola")).toBeVisible();
    await expect(acervo.getByRole("link", { name: "Gerenciar acervo" })).toHaveAttribute("href", "/acervo");

    // Linha do treino leva pro detalhe da visita
    await rowComMetrica.click();
    await expect(page).toHaveURL(new RegExp(`/treinos/${visit.id}`));
  });

  test("login com visita ativa cai em Treinos > Visitas, e o Dashboard segue acessível", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, { name: "Estande Sul", city: "Porto Alegre", state: "RS" });
    await startVisit(token, location.id);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/treinos\/visitas/);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Sua evolução" })).toBeVisible();
  });

  test("sessão inválida no carregamento manda pro login", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/dashboard/);

    // Cookie presente (o proxy deixa passar) mas token inválido: o backend
    // responde 401 e a tela precisa tratar como sessão expirada.
    await context.addCookies([{ name: "shottrack_access", value: "token-invalido", url: "http://localhost:3000" }]);
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
  });
});
