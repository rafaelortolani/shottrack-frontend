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

async function submitLogin(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

// Login cai em Boas-vindas (FUC17); o Dashboard segue acessível pela nav
async function openDashboardFromNav(page: Page) {
  await expect(page).toHaveURL(/\/boas-vindas/);
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function loginAndOpen(page: Page, email: string, path = "/dashboard") {
  await submitLogin(page, email);
  await expect(page).toHaveURL(/\/boas-vindas/);
  await page.goto(path);
}

/**
 * Precisão (3 treinos): Agrupamento 4,4 e 3,2 (menor é melhor), Pontuação 92.
 * Trap (1 treino, o mais recente): Acertos 20, Erros 5.
 * Recordes (ordem do nome): Acertos, Agrupamento, Erros, Pontuação.
 */
async function seedAthlete(token: string) {
  const location = await registerTrainingLocation(token, { name: "Clube de Tiro Alvorada", city: "Curitiba", state: "PR" });
  const catalog = await getModalityCatalog(token);
  const precisao = catalog.find((m) => m.name === "Precisão")!;
  const trap = catalog.find((m) => m.name === "Trap")!;
  await addPracticedModality(token, precisao.id);
  await addPracticedModality(token, trap.id);
  const precisaoTypes = await getConfiguredResultTypes(token, precisao.id);
  const trapTypes = await getConfiguredResultTypes(token, trap.id);
  const agrupamento = precisaoTypes.find((r) => r.name === "Agrupamento")!;
  const pontuacao = precisaoTypes.find((r) => r.name === "Pontuação")!;
  const acertos = trapTypes.find((r) => r.name === "Acertos")!;
  const erros = trapTypes.find((r) => r.name === "Erros")!;

  const visit = await startVisit(token, location.id);
  for (const [grouping, score] of [["4.4", null], ["3.2", "92"], ["3.9", null]] as const) {
    const training = await openTraining(token, visit.id, precisao.id);
    const series = await registerSeries(token, { trainingId: training.id, shotCount: 10 });
    await registerSeriesResult(token, series.id, agrupamento.id, grouping);
    if (score) await registerSeriesResult(token, series.id, pontuacao.id, score);
    await closeTraining(token, training.id);
  }
  const trapTraining = await openTraining(token, visit.id, trap.id);
  const trapSeries = await registerSeries(token, { trainingId: trapTraining.id, shotCount: 25 });
  await registerSeriesResult(token, trapSeries.id, acertos.id, "20");
  await registerSeriesResult(token, trapSeries.id, erros.id, "5");
  await closeTraining(token, trapTraining.id);
  await closeVisit(token, visit.id);

  await waitForDashboardRecords(token, 4);
  return { location, precisao, trap };
}

const tabLink = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Seções do dashboard" }).getByRole("link", { name, exact: true });

test.describe("Dashboard em abas — Resumo (FUC15 v6)", () => {
  test("atleta novo: convite pra treinar, indicadores zerados sem comparação, sem blocos vazios nem acervo", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);

    await submitLogin(page, email);
    await openDashboardFromNav(page);

    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    // Onboarding vive só em Boas-vindas (FUC17)
    await expect(page.getByRole("region", { name: "Configuração inicial" })).toHaveCount(0);

    await expect(page.getByRole("region", { name: "Ação principal" }).getByText("Pronto pra treinar?")).toBeVisible();

    const trainings = page.getByRole("group", { name: "Treinos esse mês" });
    await expect(trainings.getByText("0", { exact: true })).toBeVisible();
    await expect(trainings.getByLabel("Sem dados do mês anterior para comparar")).toHaveText("—");
    await expect(page.getByText("NaN")).toHaveCount(0);

    await expect(page.getByRole("region", { name: "Últimos treinos" }).getByText(/Ainda não há treinos/)).toBeVisible();
    // sem dado: nem mini evolução, nem recordes, e o acervo e o resumo de modalidades saíram do dashboard
    await expect(page.getByRole("region", { name: "Evolução" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Recordes" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Acervo" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Modalidades" })).toHaveCount(0);
  });

  test("ação principal muda pra 'Continuar treino' ao iniciar uma visita", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, { name: "Estande Sul", city: "Porto Alegre", state: "RS" });
    const [modality] = await getModalityCatalog(token);
    await addPracticedModality(token, modality.id);

    await submitLogin(page, email);
    await openDashboardFromNav(page);
    const mainAction = page.getByRole("region", { name: "Ação principal" });
    await expect(mainAction.getByText("Pronto pra treinar?")).toBeVisible();

    const visit = await startVisit(token, location.id);
    await openTraining(token, visit.id, modality.id);
    await page.reload();

    await expect(mainAction.getByText("Visita em andamento")).toBeVisible();
    await expect(mainAction.getByText(location.name)).toBeVisible();
    await expect(mainAction.getByText(modality.name)).toBeVisible();
    await expect(mainAction.getByText("Pronto pra treinar?")).toHaveCount(0);

    await mainAction.getByRole("link", { name: "Continuar treino" }).click();
    await expect(page).toHaveURL(/\/treinos\/visitas/);
  });

  test("com dados: indicadores, mini evolução, 3 últimos treinos e 3 recordes, com os links entre abas", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { location } = await seedAthlete(token);

    await loginAndOpen(page, email);

    // Indicadores: valor do mês; sem mês anterior, o delta é "—"
    await expect(page.getByRole("group", { name: "Treinos esse mês" }).getByText("4", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Disparos esse mês" }).getByText("55", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Modalidades praticadas" }).getByText("2", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Sem dados do mês anterior para comparar")).toHaveCount(3);

    // Mini evolução do suggestedEvolution: sem controles, com link "Ver evolução"
    const mini = page.getByRole("region", { name: "Evolução" });
    await expect(mini).toBeVisible();
    await expect(mini.getByRole("table")).toHaveCount(1);
    await expect(mini.getByRole("tab")).toHaveCount(0);
    await expect(mini.getByRole("combobox")).toHaveCount(0);
    await expect(mini.getByRole("link", { name: "Ver evolução" })).toHaveAttribute("href", /aba=evolucao.*tipo=|tipo=.*aba=evolucao/);

    // Só 3 treinos (o 4º, mais antigo, fica de fora), mais recente primeiro, com a métrica de cada um
    const recent = page.getByRole("region", { name: "Últimos treinos" });
    await expect(recent.getByRole("listitem")).toHaveCount(3);
    await expect(recent.getByRole("listitem").first()).toContainText("Trap");
    await expect(recent.getByRole("listitem").first()).toContainText(location.name);
    // o destaque do treino é o tipo com mais registros (empate: o mais recente) — Acertos ou Erros
    await expect(recent.getByRole("listitem").first()).toContainText(/(Acertos: 20|Erros: 5)/);
    await expect(recent.getByRole("link", { name: "Ver histórico" })).toHaveAttribute("href", "/treinos/historico");

    // 3 recordes (ordem do nome) e "Ver todos" leva à aba Recordes
    const records = page.getByRole("region", { name: "Recordes" });
    await expect(records.getByRole("listitem")).toHaveCount(3);
    await expect(records.getByRole("listitem").first()).toContainText("Acertos");
    await records.getByRole("link", { name: "Ver todos" }).click();
    await expect(page).toHaveURL(/aba=recordes/);
    await expect(page.getByRole("region", { name: "Recordes" }).getByRole("listitem")).toHaveCount(4);

    // "Ver evolução" abre a aba Evolução já com a seleção sugerida
    await tabLink(page, "Resumo").click();
    await page.getByRole("region", { name: "Evolução" }).getByRole("link", { name: "Ver evolução" }).click();
    await expect(page).toHaveURL(/aba=evolucao/);
    await expect(page.getByRole("heading", { name: "Evolução", level: 2 })).toBeVisible();
    await expect(page.getByLabel("Tipo de resultado")).toBeVisible();
  });

  test("os deltas comparam com o período anterior: melhora em verde, piora e igual neutros, nunca vermelho", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    await seedAthlete(token);

    // O treino sempre nasce "hoje", então não há como criar dado do mês anterior pela API:
    // o teste usa a resposta real e só substitui o campo `previous` dos indicadores.
    await page.route("**/api/dashboard", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data.trainingsThisMonth = { value: 4, previous: 1 }; // melhora
      body.data.shotsThisMonth = { value: 55, previous: 80 }; // piora
      body.data.modalitiesPracticed = { value: 2, previous: 2 }; // igual
      await route.fulfill({ response, json: body });
    });

    await loginAndOpen(page, email);

    const improved = page.getByRole("group", { name: "Treinos esse mês" }).getByLabel("3 a mais que no mês anterior");
    await expect(improved).toHaveText("▲ 3 vs mês anterior");
    await expect(improved).toHaveClass(/text-positive/);

    const worse = page.getByRole("group", { name: "Disparos esse mês" }).getByLabel("25 a menos que no mês anterior");
    await expect(worse).toHaveText("▼ 25 vs mês anterior");
    await expect(worse).not.toHaveClass(/text-positive/);

    const same = page.getByRole("group", { name: "Modalidades praticadas" }).getByLabel("Igual ao mês anterior");
    await expect(same).toHaveText("= igual ao mês anterior");

    // nenhum delta usa as cores de alerta (vermelho)
    for (const delta of [improved, worse, same]) {
      await expect(delta).not.toHaveClass(/accent-brass|accent-target/);
    }
  });

  test("erro ao carregar mostra a mensagem e 'Tentar de novo' recarrega", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    let failures = 0;
    await page.route("**/api/dashboard", async (route) => {
      if (failures-- > 0) {
        await route.fulfill({ status: 500, json: { error: { code: "X", message: "falhou" } } });
      } else {
        await route.continue();
      }
    });

    // Boas-vindas também consulta /api/dashboard: a falha só vale pra tela do dashboard
    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/boas-vindas/);
    await expect(page.getByText(/Bem-vindo/)).toBeVisible();
    failures = 1;
    await page.goto("/dashboard");
    await expect(page.getByRole("alert").filter({ hasText: "Não foi possível carregar o dashboard" })).toBeVisible();

    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByRole("region", { name: "Ação principal" })).toBeVisible();
  });

  test("login com visita ativa cai em Treinos > Visitas, e o Dashboard segue acessível", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const location = await registerTrainingLocation(token, { name: "Estande Sul", city: "Porto Alegre", state: "RS" });
    await startVisit(token, location.id);

    await submitLogin(page, email);
    await expect(page).toHaveURL(/\/treinos\/visitas/);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  });

  test("sessão inválida no carregamento manda pro login", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email);

    await submitLogin(page, email);
    await openDashboardFromNav(page);

    // Cookie presente (o proxy deixa passar) mas token inválido: o backend
    // responde 401 e a tela precisa tratar como sessão expirada.
    await context.addCookies([{ name: "shottrack_access", value: "token-invalido", url: "http://localhost:3000" }]);
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Dashboard em abas — abas, URL e filtro global (FUC15 v6)", () => {
  test("a aba ativa vive na URL, sobrevive ao recarregar e o Resumo é a padrão", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    await seedAthlete(token);

    await loginAndOpen(page, email);
    await expect(tabLink(page, "Resumo")).toHaveAttribute("aria-current", "page");
    expect(new URL(page.url()).search).toBe(""); // padrão: sem ?aba=

    for (const [name, aba] of [["Evolução", "evolucao"], ["Recordes", "recordes"], ["Modalidades", "modalidades"]]) {
      await tabLink(page, name).click();
      await expect(page).toHaveURL(new RegExp(`aba=${aba}`));
      await expect(tabLink(page, name)).toHaveAttribute("aria-current", "page");
    }

    await page.reload();
    await expect(page).toHaveURL(/aba=modalidades/);
    await expect(tabLink(page, "Modalidades")).toHaveAttribute("aria-current", "page");

    // voltar do navegador percorre as abas
    await page.goBack();
    await expect(page).toHaveURL(/aba=recordes/);
    await expect(tabLink(page, "Recordes")).toHaveAttribute("aria-current", "page");

    // aba inválida cai no Resumo
    await page.goto("/dashboard?aba=nao-existe");
    await expect(tabLink(page, "Resumo")).toHaveAttribute("aria-current", "page");
  });

  test("o filtro global vale pra Resumo, Evolução e Recordes, persiste ao trocar de aba e não afeta Modalidades", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { precisao, trap } = await seedAthlete(token);
    await waitForDashboardRecords(token, 2, trap.id);

    await loginAndOpen(page, email);
    const filter = page.locator("#dashboard-modality");
    await expect(filter.locator("option")).toHaveText(["Todas as modalidades", precisao.name, trap.name].sort((a, b) => (a === "Todas as modalidades" ? -1 : b === "Todas as modalidades" ? 1 : a.localeCompare(b))));

    await filter.selectOption(trap.id);
    await expect(page).toHaveURL(new RegExp(`modalidade=${trap.id}`));

    // Resumo: só o treino do Trap; e só os recordes do Trap
    const recent = page.getByRole("region", { name: "Últimos treinos" });
    await expect(recent.getByRole("listitem")).toHaveCount(1);
    await expect(recent.getByRole("listitem")).toContainText("Trap");
    const records = page.getByRole("region", { name: "Recordes" });
    await expect(records.getByRole("listitem")).toHaveText([/Acertos/, /Erros/]);
    // indicador de treinos respeita o filtro; "Modalidades praticadas" não
    await expect(page.getByRole("group", { name: "Treinos esse mês" }).getByText("1", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Modalidades praticadas" }).getByText("2", { exact: true })).toBeVisible();

    // O filtro persiste ao trocar de aba
    await tabLink(page, "Recordes").click();
    await expect(page).toHaveURL(new RegExp(`aba=recordes.*modalidade=${trap.id}|modalidade=${trap.id}.*aba=recordes`));
    await expect(filter).toHaveValue(trap.id);
    await expect(page.getByRole("region", { name: "Recordes" }).getByRole("listitem")).toHaveCount(2);

    // Evolução: a modalidade vem do filtro (sem seletor local), com os tipos dela
    await tabLink(page, "Evolução").click();
    const evolution = page.getByRole("region", { name: "Evolução" });
    await expect(evolution.getByText(/^Modalidade:/)).toContainText(trap.name);
    await expect(evolution.getByLabel("Modalidade")).toHaveCount(0);
    await expect
      .poll(() => page.getByLabel("Tipo de resultado").locator("option").allTextContents())
      .toEqual(expect.arrayContaining(["Acertos", "Erros"]));

    // Modalidades ignora o filtro: lista todas, e o seletor mostra "Todas" desabilitado
    await tabLink(page, "Modalidades").click();
    await expect(filter).toBeDisabled();
    await expect(filter).toHaveValue("");
    await expect(page.getByText("Esta aba mostra todas as modalidades.")).toBeVisible();
    const list = page.getByRole("region", { name: "Modalidades" }).getByRole("listitem");
    await expect(list).toHaveCount(2);
    await expect(list.filter({ hasText: precisao.name })).toContainText("3 treinos");
    await expect(list.filter({ hasText: trap.name })).toContainText("1 treino");

    // ...e voltar pro Resumo restaura o filtro que a URL guardou
    await tabLink(page, "Resumo").click();
    await expect(filter).toHaveValue(trap.id);
    await expect(filter).toBeEnabled();

    // "Todas as modalidades" limpa o filtro
    await filter.selectOption("");
    await expect(page).not.toHaveURL(/modalidade=/);
    await expect(page.getByRole("region", { name: "Últimos treinos" }).getByRole("listitem")).toHaveCount(3);
  });

  test("modalidade inválida na URL vira 'Todas' sem quebrar a tela", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    await seedAthlete(token);

    await loginAndOpen(page, email, "/dashboard?modalidade=00000000-0000-0000-0000-000000000000");
    await expect(page.locator("#dashboard-modality")).toHaveValue("");
    await expect(page.getByRole("region", { name: "Últimos treinos" }).getByRole("listitem")).toHaveCount(3);
  });

  test("Modalidades: nome, nº de treinos e melhor valor; vazio sem treino", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { precisao } = await seedAthlete(token);

    await loginAndOpen(page, email, "/dashboard?aba=modalidades");
    const row = page.getByRole("region", { name: "Modalidades" }).getByRole("listitem").filter({ hasText: precisao.name });
    await expect(row).toContainText("3 treinos");
    await expect(row).toContainText("Melhor");

    // atleta sem treino
    const empty = randomEmail();
    await createUser(empty);
    await page.context().clearCookies();
    await loginAndOpen(page, empty, "/dashboard?aba=modalidades");
    await expect(page.getByText("Nenhum treino registrado em nenhuma modalidade ainda.")).toBeVisible();
  });

  test("Recordes: lista completa, e tocar num recorde abre a Evolução com a seleção correspondente", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { precisao, trap } = await seedAthlete(token);

    await loginAndOpen(page, email, "/dashboard?aba=recordes");
    const records = page.getByRole("region", { name: "Recordes" }).getByRole("listitem");
    await expect(records).toHaveCount(4);
    await expect(records.filter({ hasText: "Agrupamento" })).toContainText("3,2");
    await expect(records.filter({ hasText: "Agrupamento" })).toContainText("cm");
    await expect(records.filter({ hasText: "Pontuação" })).toContainText("92");

    // Pontuação é da Precisão; Acertos é do Trap — o modo "Todas" escolhe a modalidade certa
    await records.filter({ hasText: "Acertos" }).getByRole("link").click();
    await expect(page).toHaveURL(/aba=evolucao/);
    await expect(page.getByRole("region", { name: "Evolução" }).getByLabel("Modalidade")).toHaveValue(trap.id);
    await expect(page.getByLabel("Tipo de resultado").locator("option:checked")).toHaveText("Acertos");
    await expect(page.getByRole("table").getByRole("cell", { name: "20", exact: true })).toBeVisible();

    await page.goBack();
    await page.getByRole("region", { name: "Recordes" }).getByRole("listitem").filter({ hasText: "Pontuação" }).getByRole("link").click();
    await expect(page.getByRole("region", { name: "Evolução" }).getByLabel("Modalidade")).toHaveValue(precisao.id);
    await expect(page.getByLabel("Tipo de resultado").locator("option:checked")).toHaveText("Pontuação");
  });

  test("Recordes vazio sem resultado registrado", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);

    await loginAndOpen(page, email, "/dashboard?aba=recordes");
    await expect(page.getByText(/Nenhum recorde ainda/)).toBeVisible();
  });
});
