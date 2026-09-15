import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getWeaponCatalog,
  getWeaponModels,
  registerWeapon,
} from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Acervo > Armas (FUC07)", () => {
  test("mostra o estado vazio e cadastra uma arma com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { types, brands, calibers } = await getWeaponCatalog(token);
    const type = types[0];
    const brand = brands[0];
    const caliber = calibers[0];
    const models = await getWeaponModels(token, brand.id);
    const model = models[0];

    await login(page, email);
    await page.goto("/acervo");
    await expect(page.getByText(/acervo de armas está vazio/i)).toBeVisible();

    await page.getByRole("link", { name: "+ Cadastrar arma" }).click();
    await expect(page).toHaveURL(/\/acervo\/armas\/nova/);

    await page.getByLabel("Tipo").selectOption({ label: type.name });
    await page.getByLabel("Marca").selectOption({ label: brand.name });
    await page.getByLabel("Modelo").selectOption({ label: model.name });
    await page.getByLabel("Calibre").selectOption({ label: caliber.name });
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page).toHaveURL(/\/acervo$/);
    await expect(page.getByText(`${brand.name} ${model.name}`)).toBeVisible();
    await expect(page.getByText(`${type.name} · ${caliber.name}`)).toBeVisible();
  });

  test("edita o apelido de uma arma existente", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { types, brands, calibers } = await getWeaponCatalog(token);
    const type = types[0];
    const brand = brands[0];
    const caliber = calibers[0];
    const models = await getWeaponModels(token, brand.id);
    const model = models[0];
    const weapon = await registerWeapon(token, {
      typeId: type.id,
      brandId: brand.id,
      modelId: model.id,
      caliberId: caliber.id,
    });

    await login(page, email);
    await page.goto(`/acervo/armas/${weapon.id}`);
    await page.getByLabel("Apelido").fill("Minha Glockinha");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/acervo$/);
    await expect(page.getByText("Minha Glockinha")).toBeVisible();
  });

  test("exclui uma arma com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { types, brands, calibers } = await getWeaponCatalog(token);
    const type = types[0];
    const brand = brands[0];
    const caliber = calibers[0];
    const models = await getWeaponModels(token, brand.id);
    const model = models[0];
    const weapon = await registerWeapon(token, {
      typeId: type.id,
      brandId: brand.id,
      modelId: model.id,
      caliberId: caliber.id,
    });

    await login(page, email);
    await page.goto(`/acervo/armas/${weapon.id}`);
    await page.getByRole("button", { name: "Excluir arma" }).click();

    await expect(page).toHaveURL(/\/acervo$/);
    await expect(page.getByText(/acervo de armas está vazio/i)).toBeVisible();
  });
});
