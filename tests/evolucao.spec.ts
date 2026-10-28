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
  closeVisit,
  openTraining,
  closeTraining,
  registerSeries,
  registerSeriesResult,
  waitForDashboardRecords,
} from "./helpers";

async function loginAndOpen(page: Page, email: string, path: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  // Login cai em Boas-vindas (FUC17); o dashboard segue pela URL
  await expect(page).toHaveURL(/\/boas-vindas/);
  await page.goto(path);
}

const evolution = (page: Page) => page.getByRole("region", { name: "Evolução" });

// A tabela do gráfico (acessível, fora da tela) traz todos os pontos
const chartTable = (page: Page) => evolution(page).getByRole("table");

/**
 * Precisão: Agrupamento 3,2 e 4,4 no mesmo dia (média 3,8; melhor 3,2 —
 * menor é melhor). Trap: Acertos 20. Dois treinos de Precisão contra um de
 * Trap, pra Precisão ser a modalidade inicial.
 */
async function seedTwoModalities(token: string) {
  const location = await registerTrainingLocation(token, { name: "Clube de Tiro Alvorada", city: "Curitiba", state: "PR" });
  const catalog = await getModalityCatalog(token);
  const precisao = catalog.find((m) => m.name === "Precisão")!;
  const trap = catalog.find((m) => m.name === "Trap")!;
  await addPracticedModality(token, precisao.id);
  await addPracticedModality(token, trap.id);
  const agrupamento = (await getConfiguredResultTypes(token, precisao.id)).find((r) => r.name === "Agrupamento")!;
  const acertos = (await getConfiguredResultTypes(token, trap.id)).find((r) => r.name === "Acertos")!;

  const visit = await startVisit(token, location.id);
  for (const value of ["3.2", "4.4"]) {
    const training = await openTraining(token, visit.id, precisao.id);
    const series = await registerSeries(token, { trainingId: training.id, shotCount: 10 });
    await registerSeriesResult(token, series.id, agrupamento.id, value);
    await closeTraining(token, training.id);
  }
  const trapTraining = await openTraining(token, visit.id, trap.id);
  const trapSeries = await registerSeries(token, { trainingId: trapTraining.id, shotCount: 25 });
  await registerSeriesResult(token, trapSeries.id, acertos.id, "20");
  await closeTraining(token, trapTraining.id);
  await closeVisit(token, visit.id);
  await waitForDashboardRecords(token, 2);

  return { precisao, trap, agrupamento, acertos };
}

test.describe("Aba Evolução (FUC16)", () => {
  test("troca modo, período e modalidade, recarregando o gráfico e guardando tudo na URL", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { precisao, trap } = await seedTwoModalities(token);

    await loginAndOpen(page, email, "/dashboard?aba=evolucao");
    await expect(evolution(page)).toBeVisible();

    // Seleção inicial (filtro "Todas"): modalidade mais treinada, tipo com recorde, 30 dias, Média
    await expect(evolution(page).getByLabel("Modalidade")).toHaveValue(precisao.id);
    await expect(evolution(page).getByLabel("Tipo de resultado").locator("option:checked")).toHaveText("Agrupamento");
    await expect(evolution(page).getByRole("tab", { name: "30 dias" })).toHaveAttribute("aria-selected", "true");
    await expect(evolution(page).getByRole("button", { name: "Média" })).toHaveAttribute("aria-pressed", "true");
    await expect(chartTable(page).getByRole("cell", { name: "3,8 cm" })).toBeVisible();

    // Modo Melhor: mesmo gráfico, menor valor do dia (Agrupamento: menor é melhor)
    await evolution(page).getByRole("button", { name: "Melhor" }).click();
    await expect(page).toHaveURL(/modo=melhor/);
    await expect(evolution(page).getByRole("button", { name: "Melhor" })).toHaveAttribute("aria-pressed", "true");
    await expect(chartTable(page).getByRole("cell", { name: "3,2 cm" })).toBeVisible();
    await expect(evolution(page).getByRole("table", { name: /Melhor diária de Agrupamento/ })).toHaveCount(1);

    // As 4 abas de período recarregam o gráfico (o dado de hoje entra em todas)
    for (const [label, code] of [["7 dias", "7d"], ["3 meses", "3m"], ["1 ano", "1a"], ["30 dias", "30d"]]) {
      const request = page.waitForRequest((r) => r.url().includes("/api/dashboard/evolution") && r.url().includes(`period=${code}`));
      await evolution(page).getByRole("tab", { name: label }).click();
      await request;
      await expect(page).toHaveURL(new RegExp(`periodo=${code}`));
      await expect(evolution(page).getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
      await expect(chartTable(page).getByRole("cell", { name: "3,2 cm" })).toBeVisible();
    }

    // Trocar modalidade reinicia o tipo pro da nova modalidade
    await evolution(page).getByLabel("Modalidade").selectOption(trap.id);
    await expect(page).toHaveURL(new RegExp(`mod=${trap.id}`));
    await expect(evolution(page).getByLabel("Tipo de resultado").locator("option:checked")).toHaveText("Acertos");
    await expect(chartTable(page).getByRole("cell", { name: "20", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\?/);

    // A seleção inteira sobrevive ao recarregar
    await page.reload();
    await expect(evolution(page).getByLabel("Modalidade")).toHaveValue(trap.id);
    await expect(evolution(page).getByRole("button", { name: "Melhor" })).toHaveAttribute("aria-pressed", "true");
    await expect(chartTable(page).getByRole("cell", { name: "20", exact: true })).toBeVisible();
  });

  test("aceita a seleção inteira pela URL", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { trap, acertos } = await seedTwoModalities(token);

    await loginAndOpen(
      page,
      email,
      `/dashboard?aba=evolucao&mod=${trap.id}&tipo=${acertos.id}&periodo=7d&modo=melhor`
    );

    await expect(evolution(page).getByLabel("Modalidade")).toHaveValue(trap.id);
    await expect(evolution(page).getByLabel("Tipo de resultado")).toHaveValue(acertos.id);
    await expect(evolution(page).getByRole("tab", { name: "7 dias" })).toHaveAttribute("aria-selected", "true");
    await expect(evolution(page).getByRole("button", { name: "Melhor" })).toHaveAttribute("aria-pressed", "true");
    await expect(chartTable(page).getByRole("cell", { name: "20", exact: true })).toBeVisible();

    // valores inválidos na URL caem nos padrões, sem quebrar
    await page.goto("/dashboard?aba=evolucao&tipo=xxx&periodo=99&modo=nada&mod=yyy&comparar=talvez");
    await expect(evolution(page).getByRole("tab", { name: "30 dias" })).toHaveAttribute("aria-selected", "true");
    await expect(evolution(page).getByRole("button", { name: "Média" })).toHaveAttribute("aria-pressed", "true");
    await expect(evolution(page).getByRole("switch", { name: "Comparar com período anterior" })).not.toBeChecked();
    await expect(chartTable(page)).toBeVisible();
  });

  test("com filtro global, a modalidade vem do filtro (sem seletor local) e só os tipos dela aparecem", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { trap } = await seedTwoModalities(token);

    await loginAndOpen(page, email, `/dashboard?aba=evolucao&modalidade=${trap.id}`);

    await expect(evolution(page).getByText(/^Modalidade:/)).toContainText(trap.name);
    await expect(evolution(page).getByLabel("Modalidade")).toHaveCount(0);
    await expect(evolution(page).getByLabel("Tipo de resultado").locator("option:checked")).toHaveText("Acertos");
    await expect(chartTable(page).getByRole("cell", { name: "20", exact: true })).toBeVisible();

    // trocar o filtro global reinicia a seleção local
    await page.locator("#dashboard-modality").selectOption("");
    await expect(evolution(page).getByLabel("Modalidade")).toBeVisible();
  });

  test("combinação sem dado no período mostra estado vazio, sem gráfico solto", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { trap } = await seedTwoModalities(token);

    await loginAndOpen(page, email, "/dashboard?aba=evolucao");
    await evolution(page).getByLabel("Modalidade").selectOption(trap.id);
    // "Erros" está configurado no Trap, mas nunca foi preenchido
    await evolution(page).getByLabel("Tipo de resultado").selectOption({ label: "Erros" });

    await expect(evolution(page).getByText("Nenhum registro nesse período")).toBeVisible();
    await expect(evolution(page).getByRole("img")).toHaveCount(0);
    await expect(evolution(page).getByRole("table")).toHaveCount(0);
  });

  test("sem modalidade com tipo numérico a aba explica o que fazer", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await loginAndOpen(page, email, "/dashboard?aba=evolucao");
    await expect(evolution(page).getByText(/configure ao menos um tipo de resultado numérico/)).toBeVisible();
    await expect(evolution(page).getByRole("link", { name: "Modalidades" })).toHaveAttribute("href", "/usuario/modalidades");
    await expect(evolution(page).getByRole("tab")).toHaveCount(0);
  });
});

test.describe("Comparar com período anterior (FUC16)", () => {
  test("desligado por padrão; ligar pede o período anterior ao backend e guarda na URL; desligar volta ao normal", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    await seedTwoModalities(token);

    const requests: string[] = [];
    page.on("request", (r) => r.url().includes("/api/dashboard/evolution") && requests.push(r.url()));

    await loginAndOpen(page, email, "/dashboard?aba=evolucao");
    const toggle = evolution(page).getByRole("switch", { name: "Comparar com período anterior" });
    await expect(toggle).not.toBeChecked();
    await expect(chartTable(page)).toBeVisible();
    expect(requests.every((url) => !url.includes("comparePrevious"))).toBe(true);

    // Ligar: o backend recebe comparePrevious=true. Sem dado no mês anterior (o treino sempre
    // nasce "hoje"), o gráfico segue só com a série atual e avisa.
    const request = page.waitForRequest((r) => r.url().includes("comparePrevious=true"));
    await toggle.click(); // controlado pela URL: o estado muda depois da navegação, então não usa check()
    await request;
    await expect(page).toHaveURL(/comparar=1/);
    await expect(toggle).toBeChecked();
    await expect(evolution(page).getByText("Sem registros no período anterior.")).toBeVisible();
    await expect(evolution(page).getByRole("group", { name: "Legenda" })).toHaveCount(0);
    await expect(chartTable(page).getByRole("cell", { name: "3,8 cm" })).toBeVisible();

    // sobrevive ao recarregar
    await page.reload();
    await expect(evolution(page).getByRole("switch", { name: "Comparar com período anterior" })).toBeChecked();

    // Desligar: some o aviso e a próxima requisição não pede o anterior
    requests.length = 0;
    await evolution(page).getByRole("switch", { name: "Comparar com período anterior" }).click();
    await expect(page).not.toHaveURL(/comparar=/);
    await expect(evolution(page).getByText("Sem registros no período anterior.")).toHaveCount(0);
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => !url.includes("comparePrevious"))).toBe(true);
  });

  test("com dado no período anterior: segunda série tracejada, legenda 'Atual × Anterior' e tabela própria", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    await seedTwoModalities(token);

    // Não há como criar treino no mês anterior pela API: usa a resposta real e acrescenta o anterior
    await page.route("**/api/dashboard/evolution?*comparePrevious=true*", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const day = (offset: number) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - offset);
        return d.toISOString().slice(0, 10);
      };
      body.data.previousPoints = [
        { date: day(45), value: 5.1 },
        { date: day(40), value: 4.6 },
      ];
      await route.fulfill({ response, json: body });
    });

    await loginAndOpen(page, email, "/dashboard?aba=evolucao&comparar=1");

    const legend = evolution(page).getByRole("group", { name: "Legenda" });
    await expect(legend).toBeVisible();
    await expect(legend).toHaveText(/Atual\s*×\s*Anterior/);
    await expect(evolution(page).getByText("Sem registros no período anterior.")).toHaveCount(0);

    // série atual e anterior em tabelas separadas (leitor de tela), com a data REAL do anterior
    await expect(evolution(page).getByRole("table")).toHaveCount(2);
    const previous = evolution(page).getByRole("table", { name: /período anterior/ });
    await expect(previous.getByRole("cell", { name: "5,1 cm" })).toBeVisible();
    await expect(previous.getByRole("cell", { name: "4,6 cm" })).toBeVisible();
    await expect(evolution(page).getByRole("table", { name: /Média diária de Agrupamento \(cm\) — Precisão$/ }).getByRole("cell", { name: "3,8 cm" })).toBeVisible();

    // o gráfico desenha duas linhas: a atual (sólida) e a anterior (tracejada)
    const paths = evolution(page).locator("svg path[stroke-dasharray]");
    await expect(paths).toHaveCount(1);
    await expect(evolution(page).locator('svg path[fill="none"]')).toHaveCount(2);
  });
});
