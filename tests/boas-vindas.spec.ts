import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  updateProfile,
  getModalityCatalog,
  addPracticedModality,
  registerTrainingLocation,
  startVisit,
  closeVisit,
  openTraining,
  closeTraining,
  getValidWeaponCombo,
  registerWeapon,
} from "./helpers";

async function submitLogin(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function registerAnyWeapon(token: string) {
  const { model, caliber } = await getValidWeaponCombo(token);
  await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });
}

function onboardingItem(page: Page, label: string) {
  return page.getByRole("region", { name: "Configuração inicial" }).getByRole("listitem").filter({ hasText: label });
}

// Hoje, no horário local indicado — mesmo fuso do navegador do teste
function todayAt(hour: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
}

test.describe("Boas-vindas (FUC17)", () => {
  test("atleta novo cai em boas-vindas com a configuração pendente e o CTA pro primeiro item", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/boas-vindas/);

    await expect(page.getByRole("heading", { name: "Bem-vindo, Usuário de Teste" })).toBeVisible();
    const onboarding = page.getByRole("region", { name: "Configuração inicial" });
    await expect(onboarding.getByText("0 de 3 concluídos")).toBeVisible();
    for (const label of ["Criar perfil", "Configurar modalidades", "Cadastrar arma"]) {
      await expect(onboardingItem(page, label)).toContainText("(pendente)");
    }

    await onboarding.getByRole("link", { name: "Continuar configuração" }).click();
    await expect(page).toHaveURL(/\/usuario\/perfil/);
  });

  test("itens concluídos ficam marcados, o CTA avança, e a configuração some quando completa", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/boas-vindas/);

    await expect(onboardingItem(page, "Configurar modalidades")).toContainText("(concluído)");
    await expect(onboardingItem(page, "Criar perfil")).toContainText("(pendente)");
    await expect(onboardingItem(page, "Cadastrar arma")).toContainText("(pendente)");
    await expect(page.getByRole("region", { name: "Configuração inicial" }).getByText("1 de 3 concluídos")).toBeVisible();
    // Perfil ainda pendente → continua sendo o primeiro destino
    await expect(page.getByRole("link", { name: "Continuar configuração" })).toHaveAttribute("href", "/usuario/perfil");

    await updateProfile(token, { name: "Atleta Teste", experienceLevel: "INTERMEDIATE" });
    await page.reload();
    await expect(onboardingItem(page, "Criar perfil")).toContainText("(concluído)");
    await expect(page.getByRole("link", { name: "Continuar configuração" })).toHaveAttribute("href", "/acervo/armas/nova");

    await registerAnyWeapon(token);
    await page.reload();
    await expect(page.getByRole("heading", { name: /, Atleta Teste$/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Configuração inicial" })).toHaveCount(0);
  });

  test("atleta configurado vê saudação pelo horário e contexto rápido, sem CTA", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    await updateProfile(token, { name: "Atleta Teste", experienceLevel: "INTERMEDIATE" });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);
    await registerAnyWeapon(token);

    const location = await registerTrainingLocation(token, { name: "Estande Sul", city: "Porto Alegre", state: "RS" });
    const visit = await startVisit(token, location.id);
    const training = await openTraining(token, visit.id, modality.id);
    await closeTraining(token, training.id);
    await closeVisit(token, visit.id);

    await page.clock.setFixedTime(todayAt(9));
    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/boas-vindas/);

    await expect(page.getByRole("heading", { name: "Bom dia, Atleta Teste" })).toBeVisible();
    await expect(page.getByText("1 treino este mês · última visita hoje")).toBeVisible();
    await expect(page.getByRole("region", { name: "Configuração inicial" })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("link")).toHaveCount(0);

    await page.clock.setFixedTime(todayAt(15));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Boa tarde, Atleta Teste" })).toBeVisible();

    await page.clock.setFixedTime(todayAt(21));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Boa noite, Atleta Teste" })).toBeVisible();

    // Dashboard segue acessível pela nav
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Sua evolução" })).toBeVisible();
  });

  test("logo do menu leva de volta pra boas-vindas, expandido ou recolhido", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/boas-vindas/);

    await page.goto("/acervo");
    await page.getByRole("link", { name: "ShotTrack" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    await page.goto("/acervo");
    await page.getByRole("button", { name: "Recolher menu" }).click();
    await page.getByRole("link", { name: "ShotTrack" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);
  });

  test("login com visita ativa pula boas-vindas e vai direto pra Treinos", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, { name: "Estande Sul", city: "Porto Alegre", state: "RS" });
    await startVisit(token, location.id);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/treinos\/visitas/);
  });

  test("sem sessão ou com sessão inválida, manda pro login", async ({ page, context }) => {
    await page.goto("/boas-vindas");
    await expect(page).toHaveURL(/\/login/);

    // Cookie presente (o proxy deixa passar) mas token inválido: o backend
    // responde 401 e a tela precisa tratar como sessão expirada.
    await context.addCookies([{ name: "shottrack_access", value: "token-invalido", url: "http://localhost:3000" }]);
    await page.goto("/boas-vindas");
    await expect(page).toHaveURL(/\/login/);
  });
});
