import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getWeaponCatalog,
  getWeaponModels,
  registerWeapon,
  registerAccessory,
  associateAccessoryWeapon,
  getAccessoryTypes,
} from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function registerTwoWeapons(token: string) {
  const { types, brands, calibers } = await getWeaponCatalog(token);
  const brand = brands[0];
  const models = await getWeaponModels(token, brand.id);
  const model = models[0];
  const weaponA = await registerWeapon(token, {
    typeId: types[0].id,
    brandId: brand.id,
    modelId: model.id,
    caliberId: calibers[0].id,
  });
  const weaponB = await registerWeapon(token, {
    typeId: types[0].id,
    brandId: brand.id,
    modelId: model.id,
    caliberId: calibers[0].id,
  });
  return { weaponA, weaponB, brand, model };
}

test.describe("Acervo > Acessórios (FUC09)", () => {
  test("mostra o estado vazio e cadastra um acessório com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const types = await getAccessoryTypes(token);
    const type = types[0];

    await login(page, email);
    await page.goto("/acervo/acessorios");
    await expect(page.getByText(/acervo de acessórios está vazio/i)).toBeVisible();

    await page.getByRole("link", { name: "+ Cadastrar acessório" }).click();
    await expect(page).toHaveURL(/\/acervo\/acessorios\/novo/);

    await page.getByLabel("Nome").fill("Coldre");
    await page.getByLabel(/Tipo/).selectOption({ label: type.name });
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page).toHaveURL(/\/acervo\/acessorios$/);
    await expect(page.getByText("Coldre", { exact: true })).toBeVisible();
    await expect(page.getByText(type.name)).toBeVisible();
  });

  test("associa a duas armas (N:N) e desassocia uma sem afetar a outra", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { brand, model } = await registerTwoWeapons(token);
    const types = await getAccessoryTypes(token);
    const accessory = await registerAccessory(token, { name: "Bipé", typeId: types[0].id });

    await login(page, email);
    await page.goto(`/acervo/acessorios/${accessory.id}`);

    const weaponName = `${brand.name} ${model.name}`;
    const selector = page.getByLabel("Selecionar arma pra associar");

    // as duas armas têm o mesmo nome (marca+modelo) — associa a primeira
    // disponível duas vezes seguidas. Conta pelos botões "Desassociar"
    // (não pelo texto do nome, que também casaria com a opção ainda
    // disponível no <select>)
    const disassociateButtons = page.getByRole("button", { name: "Desassociar" });
    const associateButton = page.getByRole("button", { name: "Associar", exact: true });

    await selector.selectOption({ label: weaponName });
    await associateButton.click();
    await expect(disassociateButtons).toHaveCount(1);

    await selector.selectOption({ label: weaponName });
    await associateButton.click();
    await expect(disassociateButtons).toHaveCount(2);

    // desassocia uma — a outra continua associada
    await disassociateButtons.first().click();
    await expect(disassociateButtons).toHaveCount(1);
  });

  test("edita nome, tipo e observações", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const types = await getAccessoryTypes(token);
    const [typeA, typeB] = types;
    const accessory = await registerAccessory(token, { name: "Mira", typeId: typeA.id });

    await login(page, email);
    await page.goto(`/acervo/acessorios/${accessory.id}`);

    await page.getByLabel("Nome").fill("Mira holográfica");
    await page.getByLabel(/Tipo/).selectOption({ label: typeB.name });
    await page.getByLabel(/Observações/).fill("Zerada a 25m");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/acervo\/acessorios$/);
    await expect(page.getByText("Mira holográfica")).toBeVisible();
    await expect(page.getByText(typeB.name)).toBeVisible();
  });

  test("exclui um acessório e remove as associações junto, sem afetar a arma", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { weaponA, brand, model } = await registerTwoWeapons(token);
    const types = await getAccessoryTypes(token);
    const accessory = await registerAccessory(token, { name: "Suporte", typeId: types[0].id });
    await associateAccessoryWeapon(token, accessory.id, weaponA.id);

    await login(page, email);
    await page.goto(`/acervo/acessorios/${accessory.id}`);
    await page.getByRole("button", { name: "Excluir acessório" }).click();

    await expect(page).toHaveURL(/\/acervo\/acessorios$/);
    await expect(page.getByText("Suporte")).not.toBeVisible();

    // a arma associada não foi excluída junto — continua no acervo de Armas
    await page.goto("/acervo/armas");
    await expect(page.getByText(`${brand.name} ${model.name}`).first()).toBeVisible();
  });
});
