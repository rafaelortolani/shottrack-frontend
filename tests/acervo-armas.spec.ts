import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getWeaponCatalog,
  getWeaponModels,
  getModelCalibers,
  getValidWeaponCombo,
  registerWeapon,
  getModalityCatalog,
  addPracticedModality,
  registerTrainingLocation,
  startVisit,
  openTraining,
  registerSeries,
  type WeaponCatalogModel,
} from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Dois modelos de tipos diferentes, procurando em todas as marcas do catálogo. */
async function findModelsOfDistinctTypes(token: string): Promise<[WeaponCatalogModel, WeaponCatalogModel]> {
  const { brands } = await getWeaponCatalog(token);
  const models = (await Promise.all(brands.map((b) => getWeaponModels(token, b.id)))).flat();
  const modelA = models[0];
  const modelB = models.find((m) => m.type.id !== modelA.type.id);
  if (!modelB) {
    throw new Error("Catálogo de teste sem modelos de tipos diferentes");
  }
  return [modelA, modelB];
}

test.describe("Acervo > Armas (FUC07)", () => {
  test("mostra o estado vazio e cadastra uma arma em cascata Marca → Modelo → Calibre, com tipo derivado do modelo", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { brand, model, caliber } = await getValidWeaponCombo(token);

    await login(page, email);
    await page.goto("/acervo/armas");
    await expect(page.getByText(/acervo de armas está vazio/i)).toBeVisible();

    await page.getByRole("link", { name: "+ Cadastrar arma" }).click();
    await expect(page).toHaveURL(/\/acervo\/armas\/nova/);

    // Tipo não é escolha do atleta — só aparece depois do modelo
    await expect(page.getByLabel("Tipo")).toHaveCount(0);
    await expect(page.getByLabel("Calibre")).toBeDisabled();

    await page.getByLabel("Marca").selectOption({ label: brand.name });
    await page.getByLabel("Modelo").selectOption({ label: model.name });

    const typeField = page.getByLabel("Tipo");
    await expect(typeField).toHaveValue(model.type.name);
    await expect(typeField).not.toBeEditable();

    await page.getByLabel("Calibre").selectOption({ label: caliber.name });
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page).toHaveURL(/\/acervo\/armas$/);
    await expect(page.getByText(`${brand.name} ${model.name}`)).toBeVisible();
    await expect(page.getByText(`${model.type.name} · ${caliber.name}`)).toBeVisible();
  });

  test("calibre mostra só as opções válidas do modelo escolhido e é limpo ao trocar de modelo", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { brands, calibers: allCalibers } = await getWeaponCatalog(token);
    const brand = brands[0];
    const [modelA, modelB] = await getWeaponModels(token, brand.id);
    const modelACalibers = await getModelCalibers(token, modelA.id);
    const notAllowed = allCalibers.find((c) => !modelACalibers.some((mc) => mc.id === c.id));

    await login(page, email);
    await page.goto("/acervo/armas/nova");
    await page.getByLabel("Marca").selectOption({ label: brand.name });
    await page.getByLabel("Modelo").selectOption({ label: modelA.name });

    const caliberSelect = page.getByLabel("Calibre");
    await expect(caliberSelect).toBeEnabled();
    // Placeholder + só os calibres válidos do modelo
    await expect(caliberSelect.locator("option")).toHaveCount(modelACalibers.length + 1);
    if (notAllowed) {
      await expect(caliberSelect.locator("option", { hasText: notAllowed.name })).toHaveCount(0);
    }

    await caliberSelect.selectOption({ label: modelACalibers[0].name });
    await page.getByLabel("Modelo").selectOption({ label: modelB.name });
    await expect(caliberSelect).toHaveValue("");
    await expect(page.getByLabel("Tipo")).toHaveValue(modelB.type.name);
  });

  test("edita o apelido de uma arma existente, com tipo somente leitura", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { model, caliber } = await getValidWeaponCombo(token);
    const weapon = await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });

    await login(page, email);
    await page.goto(`/acervo/armas/${weapon.id}`);
    await expect(page.getByLabel("Tipo")).toHaveValue(model.type.name);
    await expect(page.getByLabel("Tipo")).not.toBeEditable();
    await expect(page.getByLabel("Calibre")).toHaveValue(caliber.id);

    await page.getByLabel("Apelido").fill("Minha Glockinha");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/acervo\/armas$/);
    await expect(page.getByText("Minha Glockinha")).toBeVisible();
  });

  test("filtra a lista por tipo", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const [modelA, modelB] = await findModelsOfDistinctTypes(token);
    const [caliberA] = await getModelCalibers(token, modelA.id);
    const [caliberB] = await getModelCalibers(token, modelB.id);
    const weaponA = await registerWeapon(token, { modelId: modelA.id, caliberId: caliberA.id });
    const weaponB = await registerWeapon(token, { modelId: modelB.id, caliberId: caliberB.id });

    await login(page, email);
    await page.goto("/acervo/armas");

    const linkA = page.locator(`a[href="/acervo/armas/${weaponA.id}"]`);
    const linkB = page.locator(`a[href="/acervo/armas/${weaponB.id}"]`);
    await expect(linkA).toBeVisible();
    await expect(linkB).toBeVisible();

    await page.getByLabel("Filtrar por tipo").selectOption({ label: modelA.type.name });

    await expect(linkA).toBeVisible();
    await expect(linkB).toHaveCount(0);
  });

  test("exclui uma arma com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { model, caliber } = await getValidWeaponCombo(token);
    const weapon = await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });

    await login(page, email);
    await page.goto(`/acervo/armas/${weapon.id}`);
    await page.getByRole("button", { name: "Excluir arma" }).click();

    await expect(page).toHaveURL(/\/acervo\/armas$/);
    await expect(page.getByText(/acervo de armas está vazio/i)).toBeVisible();
  });

  // fixme: backend ainda não implementa WEAPON_IN_USE (ADR-0006/UC08) — excluir
  // arma usada numa série hoje retorna 500 INTERNAL_ERROR. Reativar quando o
  // backend lançar o erro, como já faz pra munição/acessório/local.
  test.fixme("bloqueia a exclusão de uma arma já usada numa série (WEAPON_IN_USE)", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { model, caliber } = await getValidWeaponCombo(token);
    const weapon = await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });

    const location = await registerTrainingLocation(token, { name: "Clube Alvo", city: "Curitiba", state: "PR" });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);
    const visit = await startVisit(token, location.id);
    const training = await openTraining(token, visit.id, modality.id);
    await registerSeries(token, { trainingId: training.id, weaponId: weapon.id, shotCount: 5 });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto(`/acervo/armas/${weapon.id}`);
    await page.getByRole("button", { name: "Excluir arma" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Essa arma já foi usada e não pode ser excluída." })
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/acervo/armas/${weapon.id}$`));
  });
});
