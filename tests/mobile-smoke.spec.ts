import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  setUserRole,
  getModalityCatalog,
  addPracticedModality,
  registerTrainingLocation,
  startVisit,
  openTraining,
  getValidWeaponCombo,
  registerWeapon,
  createAdmin,
  createHabitualityRule,
  uniqueRuleName,
} from "./helpers";

/**
 * Smoke mobile (FUC22): os fluxos principais num celular (projetos
 * mobile-iphone e mobile-pixel). Cada tela confere também o básico de
 * usabilidade: sem rolagem horizontal, campos com 16px e alvos de toque de 44px.
 */
async function login(page: Page, email: string, landing: RegExp = /\/boas-vindas/) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(landing);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "a página rola na horizontal").toBeLessThanOrEqual(1);
}

/** Botões, campos e selects visíveis têm ao menos 44px de altura; campos de texto, 16px de fonte. */
async function expectTouchFriendly(page: Page) {
  const problems = await page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest("nextjs-portal");
    };
    const label = (el: Element) => (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.id || el.tagName).trim().slice(0, 30);
    const controls = [
      ...document.querySelectorAll("button, select, textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio])"),
    ].filter(visible);
    const small = controls.filter((el) => el.getBoundingClientRect().height < 43.5).map((el) => `${el.tagName} "${label(el)}" ${Math.round(el.getBoundingClientRect().height)}px`);
    const zoom = controls
      .filter((el) => el.matches("input, select, textarea"))
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => `${el.tagName} "${label(el)}" ${getComputedStyle(el).fontSize}`);
    return { small, zoom };
  });
  expect(problems.small, "alvos de toque menores que 44px").toEqual([]);
  expect(problems.zoom, "campos com fonte menor que 16px (zoom no iOS)").toEqual([]);
}

// O indicador do `next dev` (botão "N") fica sobre a nav inferior e intercepta o toque;
// em produção ele não existe. Só some pra não atrapalhar o teste em dev.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(style);
    });
  });
});

test.describe("Mobile smoke (FUC22)", () => {
  test("login e boas-vindas: sem rolagem horizontal, campos e botões fáceis de tocar, nav inferior", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await page.goto("/login");
    await expectNoHorizontalScroll(page);
    await expectTouchFriendly(page);

    await login(page, email);
    await expect(page.getByText(/Bem-vindo/)).toBeVisible();
    await expectNoHorizontalScroll(page);

    // a nav é a barra inferior e leva ao dashboard
    const nav = page.locator("nav.fixed");
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("cadastro e esqueci-senha cabem na tela e têm alvos de toque adequados", async ({ page }) => {
    for (const route of ["/cadastro", "/esqueci-senha"]) {
      await page.goto(route);
      await expectNoHorizontalScroll(page);
      await expectTouchFriendly(page);
    }
  });

  test("registrar série com uma mão: o botão Salvar fica visível acima da nav, mesmo com o formulário alto", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, { name: "Clube Alvo", city: "Curitiba", state: "PR" });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);
    const { model, caliber } = await getValidWeaponCombo(token);
    await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });
    const visit = await startVisit(token, location.id);
    await openTraining(token, visit.id, modality.id);

    await login(page, email, /\/treinos\/visitas/);
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "Registrar série", exact: true }).click();
    await page.getByLabel("Quantidade de disparos").fill("10");

    const save = page.getByRole("button", { name: "Salvar série" });
    await expect(save).toBeInViewport({ ratio: 1 });
    const saveBox = (await save.boundingBox())!;
    const navBox = (await page.locator("nav.fixed").boundingBox())!;
    expect(saveBox.y + saveBox.height, "o botão Salvar está atrás da nav inferior").toBeLessThanOrEqual(navBox.y + 1);
    expect(saveBox.height).toBeGreaterThanOrEqual(43.5);

    await expectTouchFriendly(page);
    await save.click();

    await expect(page.getByRole("button", { name: "Registrar nova série" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("dashboard com dados cabe na tela", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, { name: "Clube Alvo", city: "Curitiba", state: "PR" });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);
    const { model, caliber } = await getValidWeaponCombo(token);
    await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });
    const visit = await startVisit(token, location.id);
    await openTraining(token, visit.id, modality.id);

    await login(page, email, /\/treinos\/visitas/);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByText("Visita em andamento")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTouchFriendly(page);
  });

  test("dashboard em abas: a barra de abas rola na horizontal, a página não, e cada aba é tocável", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, { name: "Clube Alvo", city: "Curitiba", state: "PR" });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);
    const visit = await startVisit(token, location.id);
    await openTraining(token, visit.id, modality.id);

    await page.setViewportSize({ width: 360, height: 640 });
    await login(page, email, /\/treinos\/visitas/);
    await page.goto("/dashboard");

    const tabs = page.getByRole("navigation", { name: "Seções do dashboard" });
    await expect(tabs.getByRole("link", { name: "Resumo" })).toBeVisible();

    // quatro abas não cabem em 360px: a barra rola sozinha; a página, não
    const scrolls = await tabs.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrolls, "a barra de abas deveria rolar na horizontal").toBe(true);
    await expectNoHorizontalScroll(page);

    for (const name of ["Resumo", "Evolução", "Recordes", "Modalidades"]) {
      const box = (await tabs.getByRole("link", { name, exact: true }).boundingBox())!;
      expect(box.height, `aba ${name} abaixo de 44px`).toBeGreaterThanOrEqual(43.5);
    }

    // a última aba fica à vista ao tocar nela (a barra rola até ela)
    await tabs.getByRole("link", { name: "Modalidades", exact: true }).click();
    await expect(page).toHaveURL(/aba=modalidades/);
    await expect(tabs.getByRole("link", { name: "Modalidades", exact: true })).toBeInViewport({ ratio: 1 });
    await expectNoHorizontalScroll(page);

    // Evolução (a tela com mais controles) também cabe e é tocável
    await tabs.getByRole("link", { name: "Evolução", exact: true }).click();
    await expect(page.getByRole("switch", { name: "Comparar com período anterior" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTouchFriendly(page);
    const toggleBox = (await page.getByRole("switch", { name: "Comparar com período anterior" }).locator("xpath=..").boundingBox())!;
    expect(toggleBox.height).toBeGreaterThanOrEqual(43.5);
  });

  test("acervo: cadastra uma arma pelo formulário no celular", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { brand, model, caliber } = await getValidWeaponCombo(token);

    await login(page, email);
    await page.goto("/acervo/armas");
    await expectNoHorizontalScroll(page);

    await page.getByRole("link", { name: "+ Cadastrar arma" }).click();
    await expect(page).toHaveURL(/\/acervo\/armas\/nova/);
    await expectTouchFriendly(page);
    await expectNoHorizontalScroll(page);

    await page.getByLabel("Marca").selectOption({ label: brand.name });
    await page.getByLabel("Modelo").selectOption({ label: model.name });
    await page.getByLabel("Calibre").selectOption({ label: caliber.name });
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page).toHaveURL(/\/acervo\/armas$/);
    await expect(page.getByText(`${brand.name} ${model.name}`)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("perfil com e-mail longo não estoura a tela", async ({ page }) => {
    const email = `teste.${"a".repeat(24)}.${Date.now()}@shottrack-exemplo-longo.com.br`;
    await createUser(email);

    await login(page, email);
    await page.goto("/usuario/perfil");
    await expect(page.getByText(email)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("admin vê o item Admin na nav inferior, junto dos outros, sem estourar a tela; atleta comum não vê", async ({ page }) => {
    const athlete = randomEmail();
    await createUser(athlete);
    await login(page, athlete);
    const nav = page.locator("nav.fixed");
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);

    const admin = randomEmail();
    await createUser(admin);
    setUserRole(admin, "ADMIN");
    await page.context().clearCookies();
    await login(page, admin);

    const adminLink = nav.getByRole("link", { name: "Admin" });
    await expect(adminLink).toBeVisible();
    for (const name of ["Dashboard", "Treinos", "Acervo", "Usuário", "Admin"]) {
      const box = (await nav.getByRole("link", { name }).boundingBox())!;
      expect(box.height, `${name} abaixo de 44px`).toBeGreaterThanOrEqual(43.5);
    }
    await expectNoHorizontalScroll(page);

    await adminLink.click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("habitualidade: aba do atleta e telas do admin cabem na tela, com alvos de toque adequados", async ({ page }) => {
    const admin = await createAdmin();
    const ruleName = uniqueRuleName("Mobile");
    const { ruleId } = await createHabitualityRule(admin.token, ruleName, [
      { name: "Iniciante", requirements: [{ activityType: "TREINO", minQuantity: 2 }] },
    ]);

    const athlete = randomEmail();
    await createUser(athlete);
    await login(page, athlete);
    await page.goto("/dashboard?aba=habitualidade");
    await expect(page.getByText("Controle pessoal. A comprovação oficial é feita pelo seu clube.")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTouchFriendly(page);

    await page.context().clearCookies();
    await login(page, admin.email);
    await page.goto("/admin/habitualidade");
    await expect(page.getByRole("heading", { name: "Regras de habitualidade" })).toBeVisible();
    await expect(page.getByText(ruleName)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTouchFriendly(page);

    await page.goto(`/admin/habitualidade/${ruleId}`);
    await expect(page.getByRole("heading", { name: ruleName })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTouchFriendly(page);

    await page.goto(`/admin/habitualidade/${ruleId}/versoes/nova`);
    await expect(page.getByLabel("Vigente a partir de")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTouchFriendly(page);
  });
});
