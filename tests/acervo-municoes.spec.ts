import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getAmmunitionManufacturers,
  getWeaponCatalog,
  registerAmmunition,
} from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Acervo > Munições (FUC08)", () => {
  test("cadastra uma munição só com fabricante", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const manufacturers = await getAmmunitionManufacturers(token);
    const manufacturer = manufacturers[0];

    await login(page, email);
    await page.goto("/acervo/municoes");
    await expect(page.getByText(/acervo de munições está vazio/i)).toBeVisible();

    await page.getByRole("link", { name: "+ Cadastrar munição" }).click();
    await expect(page).toHaveURL(/\/acervo\/municoes\/nova/);

    await page.getByLabel(/Fabricante/).selectOption({ label: manufacturer.name });
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page).toHaveURL(/\/acervo\/municoes$/);
    await expect(page.getByText(manufacturer.name)).toBeVisible();
  });

  test("cadastra uma munição só com apelido", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await login(page, email);
    await page.goto("/acervo/municoes/nova");

    await page.getByLabel(/Apelido/).fill("Recarga leve");
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page).toHaveURL(/\/acervo\/municoes$/);
    await expect(page.getByText("Recarga leve")).toBeVisible();
  });

  test("edita parcialmente um único campo sem afetar os demais", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const manufacturers = await getAmmunitionManufacturers(token);
    const manufacturer = manufacturers[0];
    const ammo = await registerAmmunition(token, {
      manufacturerId: manufacturer.id,
      nickname: "Original",
    });

    await login(page, email);
    await page.goto(`/acervo/municoes/${ammo.id}`);

    await page.getByLabel(/Apelido/).fill("Atualizado");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/acervo\/municoes$/);
    await expect(page.getByText("Atualizado")).toBeVisible();
    await expect(page.getByText(manufacturer.name)).toBeVisible();

    await page.getByText("Atualizado").click();
    await expect(page.getByLabel(/Fabricante/)).toHaveValue(manufacturer.id);
  });

  test("filtra a lista por calibre", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { calibers } = await getWeaponCatalog(token);
    const [caliberA, caliberB] = calibers;
    const ammoA = await registerAmmunition(token, { nickname: "Munição A", caliberId: caliberA.id });
    const ammoB = await registerAmmunition(token, { nickname: "Munição B", caliberId: caliberB.id });

    await login(page, email);
    await page.goto("/acervo/municoes");

    await expect(page.getByText(ammoA.nickname)).toBeVisible();
    await expect(page.getByText(ammoB.nickname)).toBeVisible();

    await page.getByLabel("Filtrar por calibre").selectOption({ label: caliberA.name });

    await expect(page.getByText(ammoA.nickname)).toBeVisible();
    await expect(page.getByText(ammoB.nickname)).not.toBeVisible();
  });

  test("exclui uma munição com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const ammo = await registerAmmunition(token, { nickname: "Pra excluir" });

    await login(page, email);
    await page.goto(`/acervo/municoes/${ammo.id}`);
    await page.getByRole("button", { name: "Excluir munição" }).click();

    await expect(page).toHaveURL(/\/acervo\/municoes$/);
    await expect(page.getByText(/acervo de munições está vazio/i)).toBeVisible();
  });
});
