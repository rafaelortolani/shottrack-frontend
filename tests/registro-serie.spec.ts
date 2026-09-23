import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getModalityCatalog,
  addPracticedModality,
  getConfiguredResultTypes,
  registerTrainingLocation,
  startVisit,
  openTraining,
  closeTraining,
  registerSeries,
  getWeaponCatalog,
  getWeaponModels,
  registerWeapon,
} from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Todo cenário aqui loga já com visita em andamento → landing em Visitas (FUC15)
  await expect(page).toHaveURL(/\/treinos\/visitas/);
}

test.describe("Registro rápido de série (FUC14)", () => {
  test("registra série vazia, completa depois com arma e resultado, marca outro como N/A, edita um campo e exclui", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const location = await registerTrainingLocation(token, {
      name: "Clube de Tiro Alvorada",
      city: "Curitiba",
      state: "PR",
    });

    const modalityCatalog = await getModalityCatalog(token);
    const precisao = modalityCatalog.find((m) => m.name === "Precisão")!;
    await addPracticedModality(token, precisao.id);
    const configured = await getConfiguredResultTypes(token, precisao.id);
    const pontuacao = configured.find((r) => r.name === "Pontuação")!;
    const agrupamento = configured.find((r) => r.name === "Agrupamento")!;

    const weaponCatalog = await getWeaponCatalog(token);
    const brand = weaponCatalog.brands[0];
    const models = await getWeaponModels(token, brand.id);
    const model = models[0];
    const weapon = await registerWeapon(token, {
      typeId: weaponCatalog.types[0].id,
      brandId: brand.id,
      modelId: model.id,
      caliberId: weaponCatalog.calibers[0].id,
    });
    const weaponLabel = `${brand.name} ${model.name}`;

    const visit = await startVisit(token, location.id);
    await openTraining(token, visit.id, precisao.id);

    await login(page, email);
    await page.goto("/treinos/visitas");

    // Treino em andamento na visita ativa já abre com as séries expandidas
    await expect(page.getByRole("button", { name: "Séries" })).toHaveAttribute("aria-expanded", "true");

    // Treino sem série: estado vazio com CTA em destaque, sem o botão secundário
    const emptyState = page.getByRole("group", { name: "Nenhuma série registrada ainda" });
    await expect(emptyState).toBeVisible();
    await expect(emptyState.getByText("Cada série é um disparo ou sequência de disparos.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar nova série" })).not.toBeVisible();

    // Registra uma série totalmente vazia pelo CTA
    await emptyState.getByRole("button", { name: "Registrar série", exact: true }).click();
    await expect(emptyState).not.toBeVisible();
    await page.getByRole("button", { name: "Salvar série" }).click();
    await expect(page.getByRole("button", { name: /^Série 1/ })).toBeVisible();
    await expect(page.getByText("Sem dados ainda")).toBeVisible();

    // Com série registrada, o botão "Registrar nova série" entra no lugar do estado vazio
    await expect(emptyState).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar nova série" })).toBeVisible();

    // Completa depois: arma + um resultado
    await page.getByRole("button", { name: /^Série 1/ }).click();
    await page.getByLabel("Arma").selectOption({ label: weaponLabel });
    await page.getByLabel(pontuacao.name, { exact: true }).fill("92");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText(`${pontuacao.name}: 92`)).toBeVisible();
    await expect(page.getByText(weaponLabel)).toBeVisible();

    // Marca outro resultado como não aplicável
    await page.getByRole("button", { name: /^Série 1/ }).click();
    await expect(page.getByLabel("Arma")).toHaveValue(weapon.id);
    const naButton = page.getByRole("button", { name: `${agrupamento.name} não aplicável` });
    await naButton.click();
    await expect(naButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel(`${agrupamento.name} (cm)`, { exact: true })).toBeDisabled();

    // Edita um campo (quantidade de disparos)
    await page.getByLabel("Quantidade de disparos").fill("5");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    // "Salvar" compõe várias chamadas (série + resultados alterados) — espera
    // o formulário fechar antes de seguir, senão a reabertura corre com o
    // fim do salvamento ainda em andamento — "Cancelar" só some quando o
    // formulário fecha de verdade (o texto do botão de salvar muda pra
    // "Salvando..." nesse meio tempo, então esperar por ele some cedo demais).
    await expect(page.getByRole("button", { name: "Cancelar" })).toHaveCount(0);

    // Reabre e confirma que tudo persistiu
    await page.getByRole("button", { name: /^Série 1/ }).click();
    await expect(page.getByLabel("Quantidade de disparos")).toHaveValue("5");
    await expect(page.getByRole("button", { name: `${agrupamento.name} não aplicável` })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByLabel(pontuacao.name, { exact: true })).toHaveValue("92");

    // Exclui a série
    await page.getByRole("button", { name: "Excluir série", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Excluir série" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("group", { name: "Nenhuma série registrada ainda" })).toBeVisible();
  });

  test("treino encerrado bloqueia série nova mas permite editar existentes", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const location = await registerTrainingLocation(token, {
      name: "Clube de Tiro Alvorada",
      city: "Curitiba",
      state: "PR",
    });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);

    const visit = await startVisit(token, location.id);
    const training = await openTraining(token, visit.id, modality.id);
    await registerSeries(token, { trainingId: training.id });
    await closeTraining(token, training.id);

    await login(page, email);
    await page.goto("/treinos/visitas");

    await page.getByRole("button", { name: "Séries" }).click();
    await expect(page.getByRole("button", { name: /^Série 1/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Registrar/ })).not.toBeVisible();

    await page.getByRole("button", { name: /^Série 1/ }).click();
    await page.getByLabel("Quantidade de disparos").fill("3");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("button", { name: "Cancelar" })).toHaveCount(0);

    await page.getByRole("button", { name: /^Série 1/ }).click();
    await expect(page.getByLabel("Quantidade de disparos")).toHaveValue("3");
  });

  test("bloqueia acertos + erros maior que a quantidade de disparos", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);

    const location = await registerTrainingLocation(token, {
      name: "Clube de Tiro Alvorada",
      city: "Curitiba",
      state: "PR",
    });

    const modalityCatalog = await getModalityCatalog(token);
    const trap = modalityCatalog.find((m) => m.name === "Trap")!;
    await addPracticedModality(token, trap.id);
    const configured = await getConfiguredResultTypes(token, trap.id);
    const acertos = configured.find((r) => r.name === "Acertos")!;
    const erros = configured.find((r) => r.name === "Erros")!;

    const visit = await startVisit(token, location.id);
    await openTraining(token, visit.id, trap.id);

    await login(page, email);
    await page.goto("/treinos/visitas");

    // Treino em andamento na visita ativa já abre com as séries expandidas
    await expect(page.getByRole("button", { name: "Séries" })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Registrar série", exact: true }).click();

    await page.getByLabel("Quantidade de disparos").fill("50");
    await page.getByLabel(acertos.name, { exact: true }).fill("10");
    await page.getByLabel(erros.name, { exact: true }).fill("50");
    await page.getByRole("button", { name: "Salvar série" }).click();

    await expect(page.getByText(/não pode passar da quantidade de disparos/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Série 1/ })).not.toBeVisible();

    // Corrige e confirma que passa a salvar
    await page.getByLabel(erros.name, { exact: true }).fill("30");
    await page.getByRole("button", { name: "Salvar série" }).click();
    await expect(page.getByRole("button", { name: /^Série 1/ })).toBeVisible();
  });
});
