import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getModalityCatalog,
  addPracticedModality,
  registerTrainingLocation,
  startVisit,
  openTraining,
} from "./helpers";

async function practicedModalityIds(token: string): Promise<string[]> {
  const response = await fetch("http://localhost:8080/api/practiced-modalities", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data } = await response.json();
  return data.map((m: { id: string }) => m.id);
}

async function login(page: Page, email: string, landing: RegExp = /\/boas-vindas/) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(landing);
}

test.describe("Usuário > Modalidades (FUC06)", () => {
  test("mostra o estado inicial sem nenhuma modalidade marcada", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await page.goto("/usuario/modalidades");

    await expect(page.getByText(/toque numa modalidade/i)).toBeVisible();
    await expect(page.getByText("0 modalidades selecionadas")).toBeVisible();

    const chips = page.getByRole("button", { pressed: false });
    expect(await chips.count()).toBeGreaterThanOrEqual(2);
  });

  test("marca um chip e reflete no contador imediatamente", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const catalog = await getModalityCatalog(token);
    const [first] = catalog;

    await login(page, email);
    await page.goto("/usuario/modalidades");

    const chip = page.getByRole("button", { name: first.name, exact: true });
    await expect(chip).toHaveAttribute("aria-pressed", "false");

    await chip.click();

    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1 modalidade selecionada")).toBeVisible();
  });

  test("desmarca um chip sem afetar os demais", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const catalog = await getModalityCatalog(token);
    const [first, second] = catalog;
    await addPracticedModality(token, first.id);
    await addPracticedModality(token, second.id);

    await login(page, email);
    await page.goto("/usuario/modalidades");

    const firstChip = page.getByRole("button", { name: first.name, exact: true });
    const secondChip = page.getByRole("button", { name: second.name, exact: true });
    await expect(firstChip).toHaveAttribute("aria-pressed", "true");
    await expect(secondChip).toHaveAttribute("aria-pressed", "true");

    await firstChip.click();

    await expect(firstChip).toHaveAttribute("aria-pressed", "false");
    await expect(secondChip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1 modalidade selecionada")).toBeVisible();
  });

  test("remove uma modalidade de verdade e consegue re-adicionar em seguida, sem recarregar", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const [first] = await getModalityCatalog(token);

    await login(page, email);
    await page.goto("/usuario/modalidades");
    const chip = page.getByRole("button", { name: first.name, exact: true });

    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("status")).toHaveText(`${first.name} adicionada`);

    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("status")).toHaveText(`${first.name} removida`);
    await expect(page.getByText("0 modalidades selecionadas")).toBeVisible();
    await expect(page.getByRole("button", { name: `Configurar tipos de resultado de ${first.name}` })).toHaveCount(0);
    expect(await practicedModalityIds(token)).not.toContain(first.id);

    // Re-adicionar logo em seguida, sem reload: não pode acusar "já está na lista"
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("status")).toHaveText(`${first.name} adicionada`);
    await expect(page.getByText(/já está na lista|Erro interno/)).toHaveCount(0);
    await expect(page.getByText("1 modalidade selecionada")).toBeVisible();
    expect(await practicedModalityIds(token)).toContain(first.id);
  });

  test("bloqueia remover modalidade já usada em treino, com mensagem clara", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const [first] = await getModalityCatalog(token);
    await addPracticedModality(token, first.id);
    const location = await registerTrainingLocation(token, { name: "Estande Sul", city: "Porto Alegre", state: "RS" });
    const visit = await startVisit(token, location.id);
    await openTraining(token, visit.id, first.id);

    // Visita ativa: o login cai direto em Treinos (FUC17)
    await login(page, email, /\/treinos\/visitas/);
    await page.goto("/usuario/modalidades");
    const chip = page.getByRole("button", { name: first.name, exact: true });
    await expect(chip).toHaveAttribute("aria-pressed", "true");

    await chip.click();
    // filtro pelo texto: o Next também tem um role="alert" (anunciador de rotas)
    await expect(
      page.getByRole("alert").filter({ hasText: `${first.name} já tem treino registrado e não pode ser removida.` })
    ).toBeVisible();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(await practicedModalityIds(token)).toContain(first.id);
  });
});
