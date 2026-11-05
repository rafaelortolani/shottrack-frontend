import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getWeaponCatalog,
  getWeaponModels,
  getModelCalibers,
  getValidWeaponCombo,
  findCatalogModel,
  pickOption,
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
  await expect(page).toHaveURL(/\/boas-vindas/);
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

/** Taurus G3: modelo com dois calibres (9mm e .38 TPC), então o calibre precisa ser escolhido. */
async function findModelWithMultipleCalibers(token: string) {
  const { brand, model, calibers } = await findCatalogModel(token, "Taurus", "G3");
  if (calibers.length < 2) throw new Error("Taurus G3 deveria ter mais de um calibre no catálogo de teste");
  return { brand, model, calibers };
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

    await pickOption(page, "Marca", brand.name);
    await pickOption(page, "Modelo", model.name);

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
    const { calibers: allCalibers } = await getWeaponCatalog(token);
    const { brand, model: modelA, calibers: modelACalibers } = await findModelWithMultipleCalibers(token);
    const { model: modelB } = await findCatalogModel(token, "Taurus", "G2C");
    const notAllowed = allCalibers.find((c) => !modelACalibers.some((mc) => mc.id === c.id));

    await login(page, email);
    await page.goto("/acervo/armas/nova");
    await pickOption(page, "Marca", brand.name);
    await pickOption(page, "Modelo", modelA.name);

    const caliberSelect = page.getByLabel("Calibre");
    await expect(caliberSelect).toBeEnabled();
    // Placeholder + só os calibres válidos do modelo
    await expect(caliberSelect.locator("option")).toHaveCount(modelACalibers.length + 1);
    if (notAllowed) {
      await expect(caliberSelect.locator("option", { hasText: notAllowed.name })).toHaveCount(0);
    }

    // Modelo com vários calibres: nada é escolhido sozinho e o cadastro fica bloqueado até escolher
    await expect(caliberSelect).toHaveValue("");
    await expect(page.getByRole("button", { name: "Cadastrar" })).toBeDisabled();
    await caliberSelect.selectOption({ label: modelACalibers[0].name });
    await expect(page.getByRole("button", { name: "Cadastrar" })).toBeEnabled();

    await pickOption(page, "Modelo", modelB.name);
    await expect(caliberSelect).toHaveValue("");
    await expect(page.getByLabel("Tipo")).toHaveValue(modelB.type.name);
  });

  test("trocar a marca limpa modelo, tipo e calibre", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { brand: taurus, model, caliber } = await findCatalogModel(token, "Taurus", "G2C").then((c) => ({
      ...c,
      caliber: c.calibers[0],
    }));
    const { brand: glock } = await findCatalogModel(token, "Glock", "G17");

    await login(page, email);
    await page.goto("/acervo/armas/nova");
    await pickOption(page, "Marca", taurus.name);
    await pickOption(page, "Modelo", model.name);
    await page.getByLabel("Calibre").selectOption({ label: caliber.name });
    await expect(page.getByRole("button", { name: "Cadastrar" })).toBeEnabled();

    await pickOption(page, "Marca", glock.name);
    await expect(page.getByRole("combobox", { name: "Modelo" })).toHaveValue("");
    await expect(page.getByLabel("Tipo")).toHaveCount(0);
    await expect(page.getByLabel("Calibre")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Cadastrar" })).toBeDisabled();
  });

  test("seletor de modelo com catálogo grande: ordem alfabética, busca, teclado e sem texto livre", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { brand } = await findCatalogModel(token, "Taurus", "G2C");
    const models = await getWeaponModels(token, brand.id);
    // Ponto de partida da conferência de usabilidade: a Taurus tem dezenas de modelos
    expect(models.length).toBeGreaterThan(40);

    await login(page, email);
    await page.goto("/acervo/armas/nova");
    const modelField = page.getByRole("combobox", { name: "Modelo" });
    await expect(modelField).toBeDisabled();

    await pickOption(page, "Marca", brand.name);
    await modelField.click();
    const listbox = page.getByRole("listbox", { name: "Modelo" });
    const options = listbox.getByRole("option");
    await expect(options).toHaveCount(models.length);
    const shown = await options.allTextContents();
    expect(shown).toEqual(models.map((m) => m.name));

    // A lista rola dentro do próprio painel (não alarga nem empurra a página)
    const box = await listbox.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    expect(box.scroll).toBeGreaterThan(box.client);

    // Busca sem diferenciar caixa: "g2c" mostra só os modelos que contêm G2C
    await modelField.fill("g2c");
    const filtered = models.filter((m) => m.name.toLowerCase().includes("g2c")).map((m) => m.name);
    await expect(options).toHaveText(filtered);

    // Sem resultado: aviso, e o texto livre não vira valor
    await modelField.fill("zzzz-inexistente");
    await expect(listbox.getByText("Nenhum resultado")).toBeVisible();
    await modelField.blur();
    await expect(modelField).toHaveValue("");
    await expect(page.getByLabel("Tipo")).toHaveCount(0);

    // Teclado: ↓ abre, ↓ navega, Enter escolhe (sem enviar o formulário), Esc fecha
    const g3 = models.filter((m) => m.name.toLowerCase().includes("g3")).map((m) => m.name);
    expect(g3.length).toBeGreaterThan(1);
    await modelField.focus();
    await modelField.fill("g3");
    await modelField.press("ArrowDown");
    await modelField.press("Enter");
    await expect(modelField).toHaveValue(g3[1]);
    await expect(listbox).toHaveCount(0);
    await expect(page).toHaveURL(/\/acervo\/armas\/nova/);
    await modelField.press("Escape");
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

  test("edita a arma trocando só o calibre, mantendo o apelido", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { model, calibers } = await findModelWithMultipleCalibers(token);
    const [original, other] = calibers;
    const weapon = await registerWeapon(token, { modelId: model.id, caliberId: original.id });

    await login(page, email);
    await page.goto(`/acervo/armas/${weapon.id}`);
    await expect(page.getByLabel("Calibre")).toHaveValue(original.id);
    await page.getByLabel("Apelido").fill("Troca de calibre");

    await page.getByLabel("Calibre").selectOption({ label: other.name });
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/acervo\/armas$/);
    await expect(page.getByText("Troca de calibre")).toBeVisible();
    await expect(page.getByText(`${model.type.name} · ${other.name}`)).toBeVisible();
  });

  test("mostra erro inline quando o backend recusa o calibre para o modelo (WEAPON_CALIBER_NOT_ALLOWED_FOR_MODEL)", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { model, caliber } = await getValidWeaponCombo(token);
    const weapon = await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });

    await login(page, email);
    await page.goto(`/acervo/armas/${weapon.id}`);
    await expect(page.getByLabel("Calibre")).toHaveValue(caliber.id);

    // A UI só oferece calibres válidos; simula o backend recusando (ex.: catálogo
    // alterado entre o carregamento da tela e o envio) interceptando o BFF.
    await page.route(`**/api/weapons/${weapon.id}`, (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "WEAPON_CALIBER_NOT_ALLOWED_FOR_MODEL", message: "Calibre não é válido para o modelo informado" },
        }),
      })
    );
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Calibre não é válido para o modelo informado" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/acervo/armas/${weapon.id}$`));
  });

  test("o BFF repassa o erro real do backend para calibre fora da lista do modelo", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { brands, calibers: allCalibers } = await getWeaponCatalog(token);
    const brand = brands[0];
    const models = await getWeaponModels(token, brand.id);
    let target: { modelId: string; caliberId: string } | undefined;
    for (const m of models) {
      const allowed = await getModelCalibers(token, m.id);
      const notAllowed = allCalibers.find((c) => !allowed.some((a) => a.id === c.id));
      if (notAllowed) {
        target = { modelId: m.id, caliberId: notAllowed.id };
        break;
      }
    }
    test.skip(!target, "Catálogo de teste sem modelo com calibre não permitido");

    await login(page, email);
    const response = await page.request.post("/api/weapons", { data: target });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("WEAPON_CALIBER_NOT_ALLOWED_FOR_MODEL");
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
