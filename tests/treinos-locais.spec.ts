import { test, expect, type Page } from "@playwright/test";
import { createUser, randomEmail, loginAndGetToken, registerTrainingLocation } from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Treinos > Locais (FUC11)", () => {
  test("mostra o estado vazio e cadastra um local com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await login(page, email);
    await page.goto("/treinos/locais");
    await expect(page.getByText(/não cadastrou nenhum local de treino/i)).toBeVisible();

    await page.getByRole("link", { name: "+ Cadastrar local" }).click();
    await expect(page).toHaveURL(/\/treinos\/locais\/novo/);

    await page.getByLabel("Nome").fill("Clube de Tiro Alvorada");
    await page.getByLabel("Cidade").fill("Curitiba");
    await page.getByLabel("Estado").selectOption({ label: "Paraná" });
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page).toHaveURL(/\/treinos\/locais$/);
    await expect(page.getByText("Clube de Tiro Alvorada")).toBeVisible();
    await expect(page.getByText("Curitiba · PR")).toBeVisible();
  });

  test("busca por nome/cidade e filtra por estado", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const locationA = await registerTrainingLocation(token, { name: "Estande Sul", city: "Curitiba", state: "PR" });
    const locationB = await registerTrainingLocation(token, { name: "Clube Norte", city: "Manaus", state: "AM" });

    await login(page, email);
    await page.goto("/treinos/locais");

    await expect(page.getByText(locationA.name)).toBeVisible();
    await expect(page.getByText(locationB.name)).toBeVisible();

    await page.getByLabel("Buscar local de treino").fill("curitiba");
    await expect(page.getByText(locationA.name)).toBeVisible();
    await expect(page.getByText(locationB.name)).not.toBeVisible();

    await page.getByLabel("Buscar local de treino").fill("");
    await page.getByLabel("Filtrar por estado").selectOption("AM");
    await expect(page.getByText(locationB.name)).toBeVisible();
    await expect(page.getByText(locationA.name)).not.toBeVisible();
  });

  test("edita parcialmente um único campo sem afetar os demais", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, {
      name: "Clube de Tiro Alvorada",
      city: "Curitiba",
      state: "PR",
    });

    await login(page, email);
    await page.goto(`/treinos/locais/${location.id}`);

    await page.getByLabel("Cidade").fill("São José dos Pinhais");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/treinos\/locais$/);
    await expect(page.getByText("São José dos Pinhais · PR")).toBeVisible();
    await expect(page.getByText("Clube de Tiro Alvorada")).toBeVisible();

    await page.getByText("Clube de Tiro Alvorada").click();
    await expect(page.getByLabel("Nome")).toHaveValue("Clube de Tiro Alvorada");
    await expect(page.getByLabel("Estado")).toHaveValue("PR");
  });

  test("exclui um local de treino com sucesso", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, {
      name: "Local pra excluir",
      city: "Curitiba",
      state: "PR",
    });

    await login(page, email);
    await page.goto(`/treinos/locais/${location.id}`);
    await page.getByRole("button", { name: "Excluir local" }).click();

    await expect(page).toHaveURL(/\/treinos\/locais$/);
    await expect(page.getByText(/não cadastrou nenhum local de treino/i)).toBeVisible();
  });
});
