import { test, expect, type Page } from "@playwright/test";
import {
  backdateVersion,
  backendJson,
  closedVisit,
  createAdmin,
  createFutureVersion,
  createHabitualityRule,
  createUser,
  loginAndGetToken,
  randomEmail,
  registerTrainingLocation,
  trackHabituality,
  uniqueRuleName,
} from "./helpers";

/**
 * Habitualidade configurável (ADR-0023 / FUC23 / FUC24). Regras vêm do admin,
 * o atleta acompanha uma regra e um nível. Cada teste cria a própria regra com
 * nome único (o atleta enxerga todas as regras ativas) e usuários novos.
 */
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas/);
}

function inDays(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// o anunciador de rota do Next também tem role="alert"
const alertOf = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

const habitualityTab = (page: Page) =>
  page.getByRole("navigation", { name: "Seções do dashboard" }).getByRole("link", { name: /Habitualidade/ });

async function athleteWithToken() {
  const email = randomEmail();
  await createUser(email);
  return { email, token: await loginAndGetToken(email) };
}

const BASIC_LEVELS = [
  { name: "Iniciante", requirements: [{ activityType: "TREINO" as const, minQuantity: 2 }] },
  {
    name: "Avançado",
    requirements: [
      { activityType: "TREINO" as const, minQuantity: 5 },
      { activityType: "COMPETICAO" as const, minQuantity: 1, minScope: "ESTADUAL" as const, distinctEvents: true },
    ],
  },
];

test.describe("Administração de habitualidade (FUC24)", () => {
  test("admin cadastra regra, versão, níveis e exigências e vê o resumo legível", async ({ page }) => {
    const admin = await createAdmin();
    await login(page, admin.email);
    const ruleName = uniqueRuleName("Portaria");

    await page.goto("/admin");
    await page.getByRole("link", { name: "Regras de habitualidade" }).click();
    await expect(page).toHaveURL(/\/admin\/habitualidade$/);

    await page.getByRole("button", { name: "Nova regra" }).click();
    await page.getByRole("button", { name: "Criar regra" }).click();
    await expect(page.getByText("Nome não pode ficar vazio")).toBeVisible();

    await page.getByLabel("Nome").fill(ruleName);
    await page.getByLabel("Referência legal").fill("Portaria nº 1/2026");
    await page.getByRole("button", { name: "Criar regra" }).click();
    await expect(page).toHaveURL(/\/admin\/habitualidade\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: ruleName, level: 1 })).toBeVisible();

    await page.getByRole("link", { name: "Nova versão" }).click();
    await expect(page).toHaveURL(/\/versoes\/nova$/);

    // validação local
    await page.getByRole("button", { name: "Criar versão" }).click();
    await expect(alertOf(page)).toContainText("data de vigência");

    await page.getByLabel("Vigente a partir de").fill("2026-01-01");
    await page.getByLabel("Janela (meses)").fill("12");

    await page.getByRole("button", { name: "+ Nível" }).click();
    await page.getByLabel("Nome do nível 1", { exact: true }).fill("Iniciante");
    await page.getByLabel("Quantidade mínima da exigência 1 do nível 1").fill("8");

    await page.getByRole("button", { name: "+ Nível" }).click();
    await page.getByLabel("Nome do nível 2", { exact: true }).fill("Intermediário");
    await page.getByLabel("Quantidade mínima da exigência 1 do nível 2").fill("12");
    await page.getByRole("button", { name: "Adicionar exigência ao nível 2" }).click();
    await page.getByLabel("Tipo da exigência 2 do nível 2").selectOption("COMPETICAO");
    await page.getByLabel("Quantidade mínima da exigência 2 do nível 2").fill("2");
    await page.getByLabel("Âmbito mínimo da exigência 2 do nível 2").selectOption("ESTADUAL");
    await page.getByLabel("Eventos distintos da exigência 2 do nível 2").click();

    await expect(page.getByLabel("Resumo do nível 1")).toHaveText("Resumo: 8 treinos");
    await expect(page.getByLabel("Resumo do nível 2")).toHaveText(
      "Resumo: 12 treinos + 2 competições estaduais, eventos distintos"
    );

    await page.getByRole("button", { name: "Criar versão" }).click();
    await expect(page).toHaveURL(/\/admin\/habitualidade\/[0-9a-f-]{36}$/);

    const versions = page.getByRole("region", { name: "Versões" });
    await expect(versions.getByText("Desde 01/01/2026")).toBeVisible();
    await expect(versions.getByText("Vigente", { exact: true })).toBeVisible();
    await expect(versions.getByText("Intermediário: 12 treinos + 2 competições estaduais, eventos distintos")).toBeVisible();

    // aparece na lista, com a vigência
    await page.goto("/admin/habitualidade");
    const row = page.getByRole("listitem").filter({ hasText: ruleName });
    await expect(row).toContainText("vigente desde 01/01/2026");
    await expect(row.getByText("Ativa", { exact: true })).toBeVisible();
  });

  test("ativar e desativar a regra reflete na lista de regras do atleta", async ({ page }) => {
    const admin = await createAdmin();
    const ruleName = uniqueRuleName();
    await createHabitualityRule(admin.token, ruleName, BASIC_LEVELS);
    const athlete = await athleteWithToken();

    await login(page, admin.email);
    await page.goto("/admin/habitualidade");
    const row = page.getByRole("listitem").filter({ hasText: ruleName });
    await row.getByRole("button", { name: `Desativar ${ruleName}` }).click();
    await expect(row.getByText("Inativa", { exact: true })).toBeVisible();

    const names = async () =>
      (await backendJson(athlete.token, "/api/habituality/rules")).body.data.map((r: { name: string }) => r.name);
    expect(await names()).not.toContain(ruleName);

    await row.getByRole("button", { name: `Ativar ${ruleName}` }).click();
    await expect(row.getByText("Ativa", { exact: true })).toBeVisible();
    expect(await names()).toContain(ruleName);
  });

  test("versão futura é editável e removível (com confirmação); a vigente é somente leitura", async ({ page }) => {
    const admin = await createAdmin();
    const ruleName = uniqueRuleName();
    const { ruleId, versionId } = await createHabitualityRule(admin.token, ruleName, BASIC_LEVELS);
    const futureDate = inDays(60);
    await createFutureVersion(admin.token, ruleId, futureDate, [
      { name: "Novo nível", requirements: [{ activityType: "QUALQUER", minQuantity: 3 }] },
    ]);
    await login(page, admin.email);

    // vigente: somente leitura
    await page.goto(`/admin/habitualidade/${ruleId}/versoes/${versionId}`);
    await expect(page.getByText("somente leitura")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar versão" })).toHaveCount(0);
    await expect(page.getByText("5 treinos + 1 competição estadual, eventos distintos")).toBeVisible();

    // futura: editar
    await page.goto(`/admin/habitualidade/${ruleId}`);
    const versions = page.getByRole("region", { name: "Versões" });
    await expect(versions.getByText("Futura")).toBeVisible();
    await versions.getByRole("link").filter({ hasText: `Desde ${brDate(futureDate)}` }).click();
    await page.getByLabel("Janela (meses)").fill("6");
    await page.getByLabel("Quantidade mínima da exigência 1 do nível 1").fill("7");
    await page.getByRole("button", { name: "Salvar versão" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/habitualidade/${ruleId}$`));
    await expect(versions.getByText("Janela de 6 meses")).toBeVisible();
    await expect(versions.getByText("Novo nível: 7 atividades")).toBeVisible();

    // futura: excluir pede confirmação
    await versions.getByRole("link").filter({ hasText: `Desde ${brDate(futureDate)}` }).click();
    await page.getByRole("button", { name: "Excluir versão" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Excluir esta versão futura?");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar" }).click();
    await expect(page).toHaveURL(/versoes\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Excluir versão" }).click();
    await page.getByRole("button", { name: "Confirmar exclusão" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/habitualidade/${ruleId}$`));
    await expect(versions.getByText("Futura")).toHaveCount(0);
  });

  test("erros do backend aparecem inline: data inválida, níveis repetidos e versão vigente não editável", async ({ page }) => {
    const admin = await createAdmin();
    const { ruleId, versionId } = await createHabitualityRule(admin.token, uniqueRuleName(), BASIC_LEVELS);
    await login(page, admin.email);

    // 2ª versão com data passada
    await page.goto(`/admin/habitualidade/${ruleId}/versoes/nova`);
    // "+ Nível" só funciona depois da hidratação; antes disso o campo preenchido não chega ao estado do React
    await expect(async () => {
      await page.getByRole("button", { name: "+ Nível" }).click();
      await expect(page.getByLabel("Nome do nível 1", { exact: true })).toBeVisible({ timeout: 500 });
    }).toPass();
    await page.getByLabel("Vigente a partir de").fill("2026-02-01");
    await page.getByLabel("Janela (meses)").fill("12");
    await page.getByLabel("Nome do nível 1", { exact: true }).fill("Único");
    await page.getByLabel("Quantidade mínima da exigência 1 do nível 1").fill("1");
    await page.getByRole("button", { name: "Criar versão" }).click();
    await expect(alertOf(page)).toContainText("Data de vigência inválida");
    await expect(page).toHaveURL(/versoes\/nova$/);

    // nomes de nível repetidos
    await page.getByLabel("Vigente a partir de").fill(inDays(90));
    await page.getByRole("button", { name: "+ Nível" }).click();
    await page.getByLabel("Nome do nível 2", { exact: true }).fill("Único");
    await page.getByLabel("Quantidade mínima da exigência 1 do nível 2").fill("1");
    await page.getByRole("button", { name: "Criar versão" }).click();
    await expect(alertOf(page)).toBeVisible();
    await expect(page).toHaveURL(/versoes\/nova$/);

    // com atleta acompanhando, o backend recusa alterar a vigente e o BFF repassa o erro
    const athlete = await athleteWithToken();
    await trackHabituality(athlete.token, ruleId, "Iniciante");
    const response = await page.request.put(`/api/admin/habituality/versions/${versionId}`, {
      data: {
        validFrom: "2026-01-01",
        windowMonths: 6,
        levels: [{ name: "X", position: 1, requirements: [{ activityType: "QUALQUER", minQuantity: 1 }] }],
      },
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("HABITUALITY_VERSION_NOT_EDITABLE");
  });

  test("atleta comum é barrado em /admin/habitualidade e no BFF", async ({ page }) => {
    const athlete = await athleteWithToken();
    await login(page, athlete.email);

    await page.goto("/admin/habitualidade");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/admin/habitualidade/qualquer-id");
    await expect(page).toHaveURL(/\/dashboard$/);

    for (const path of ["/api/admin/habituality/rules", "/api/admin/habituality/rules/x/versions"]) {
      const response = await page.request.get(path);
      expect(response.status()).toBe(403);
    }
    const post = await page.request.post("/api/admin/habituality/rules", { data: { name: "Invasora", active: true } });
    expect(post.status()).toBe(403);
  });

  test("sem login o BFF de habitualidade responde 401", async ({ request }) => {
    for (const path of ["/api/habituality/progress", "/api/habituality/rules", "/api/admin/habituality/rules"]) {
      expect((await request.get(path)).status()).toBe(401);
    }
  });
});

test.describe("Aba Habitualidade do dashboard (FUC23)", () => {
  test("sem acompanhamento: escolhe regra e nível, vê o progresso por exigência e o texto fixo", async ({ page }) => {
    const admin = await createAdmin();
    const ruleName = uniqueRuleName();
    await createHabitualityRule(admin.token, ruleName, BASIC_LEVELS);
    const athlete = await athleteWithToken();
    const location = await registerTrainingLocation(athlete.token, { name: "Campo A", city: "Curitiba", state: "PR" });
    await closedVisit(athlete.token, location.id);
    await login(page, athlete.email);

    await page.goto("/dashboard");
    await habitualityTab(page).click();
    await expect(page).toHaveURL(/aba=habitualidade/);

    await expect(page.getByRole("button", { name: "Escolher regra e nível" })).toBeVisible();
    await expect(page.getByText("Controle pessoal. A comprovação oficial é feita pelo seu clube.")).toBeVisible();
    // a aba ignora o filtro global
    await expect(page.locator("#dashboard-modality")).toBeDisabled();
    await expect(page.getByText("Esta aba não usa o filtro de modalidade.")).toBeVisible();

    await page.getByRole("button", { name: "Escolher regra e nível" }).click();
    const form = page.getByRole("form", { name: "Escolher regra e nível" });
    await expect(form.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    await form.getByLabel("Regra", { exact: true }).selectOption({ label: ruleName });
    await form.getByLabel("Nível", { exact: true }).selectOption("Avançado");
    await expect(form).toContainText("5 treinos + 1 competição estadual, eventos distintos");
    await form.getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByText(ruleName)).toBeVisible();
    await expect(page.getByText("Portaria de teste")).toBeVisible();
    await expect(page.getByText(/Janela de \d{2}\/\d{2}\/\d{4} a hoje/)).toBeVisible();
    await expect(page.getByText(/Faltam \d+/)).toBeVisible();
    // 1 visita encerrada (treino): conta 1 de 5 em treinos
    const bar = page.getByRole("progressbar", { name: /5 treino/ });
    await expect(bar).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByText("1 de 5")).toBeVisible();
    await expect(page.getByText("0 de 1").first()).toBeVisible();

    // o estado vive no servidor e a aba na URL: sobrevive ao recarregar
    await page.reload();
    await expect(page.getByText(ruleName)).toBeVisible();
  });

  test("trocar de nível e parar de acompanhar", async ({ page }) => {
    const admin = await createAdmin();
    const ruleName = uniqueRuleName();
    const { ruleId } = await createHabitualityRule(admin.token, ruleName, BASIC_LEVELS);
    const athlete = await athleteWithToken();
    await trackHabituality(athlete.token, ruleId, "Iniciante");
    await login(page, athlete.email);

    await page.goto("/dashboard?aba=habitualidade");
    await expect(page.getByText("Nível:")).toContainText("Iniciante");

    await page.getByRole("button", { name: "Trocar regra ou nível" }).click();
    const form = page.getByRole("form", { name: "Escolher regra e nível" });
    await form.getByLabel("Nível", { exact: true }).selectOption("Avançado");
    await form.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Nível:")).toContainText("Avançado");

    await page.getByRole("button", { name: "Parar de acompanhar" }).click();
    await expect(page.getByRole("button", { name: "Escolher regra e nível" })).toBeVisible();
    expect((await backendJson(athlete.token, "/api/habituality/progress")).body.data.rule).toBeNull();
  });

  test("competição com âmbito e local-clube alteram o progresso (formulários de visita e local)", async ({ page }) => {
    const admin = await createAdmin();
    const { ruleId } = await createHabitualityRule(admin.token, uniqueRuleName(), [
      { name: "Clube", requirements: [{ activityType: "COMPETICAO", minQuantity: 1, minScope: "ESTADUAL", onlyInClub: true }] },
    ]);
    const athlete = await athleteWithToken();
    await trackHabituality(athlete.token, ruleId, "Clube");

    // competição estadual em local que NÃO é clube: não conta
    const field = await registerTrainingLocation(athlete.token, { name: "Campo Aberto", city: "Curitiba", state: "PR" });
    await closedVisit(athlete.token, field.id, { visitType: "COMPETICAO", competitionScope: "ESTADUAL" });

    await login(page, athlete.email);
    await page.goto("/dashboard?aba=habitualidade");
    await expect(page.getByText("0 de 1")).toBeVisible();
    await expect(page.getByText(/Faltam 1/)).toBeVisible();

    // cadastra o clube pela tela (caixa "Este local é um clube")
    await page.goto("/treinos/locais/novo");
    await page.getByLabel("Nome").fill("Clube de Tiro Alvorada");
    await page.getByLabel("Cidade").fill("Curitiba");
    await page.getByLabel("Estado").selectOption("PR");
    await page.getByLabel("Este local é um clube").check();
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page).toHaveURL(/\/treinos\/locais$/);
    await expect(page.getByText("Curitiba · PR · Clube")).toBeVisible();

    // inicia visita de competição, com âmbito (opcional, só em competição)
    await page.goto("/treinos/nova");
    await page.getByLabel("Local de treino").selectOption({ label: "Clube de Tiro Alvorada · Curitiba/PR" });
    await expect(page.getByLabel(/Âmbito/)).toHaveCount(0);
    await page.getByLabel("Tipo", { exact: true }).selectOption("COMPETICAO");
    await page.getByLabel(/Âmbito/).selectOption("ESTADUAL");
    await page.getByRole("button", { name: "Iniciar" }).click();
    await expect(page).toHaveURL(/\/treinos\/visitas$/);
    await expect(page.getByText("Competição · Estadual").first()).toBeVisible();

    // enquanto a visita não encerra, não conta
    await page.goto("/dashboard?aba=habitualidade");
    await expect(page.getByText("0 de 1")).toBeVisible();

    const visits = (await backendJson(athlete.token, "/api/visits")).body.data as { id: string; status: string }[];
    const active = visits.find((v) => v.status === "IN_PROGRESS")!;
    await backendJson(athlete.token, `/api/visits/${active.id}/closure`, "POST");

    await page.reload();
    await expect(page.getByText("1 de 1")).toBeVisible();
    await expect(page.getByText("Cumprido")).toBeVisible();
  });

  test("meta pessoal: definir, editar inline e remover", async ({ page }) => {
    const athlete = await athleteWithToken();
    await login(page, athlete.email);
    await page.goto("/dashboard?aba=habitualidade");

    const goal = page.getByRole("region", { name: "Minha meta de treinos no ano" });
    await goal.getByRole("button", { name: "Definir meta" }).click();

    await goal.getByLabel("Treinos no ano").fill("0");
    await goal.getByRole("button", { name: "Salvar meta" }).click();
    await expect(goal.getByRole("alert")).toContainText("maior que zero");

    await goal.getByLabel("Treinos no ano").fill("24");
    await goal.getByRole("button", { name: "Salvar meta" }).click();
    await expect(goal.getByText("0 de 24")).toBeVisible();

    await goal.getByRole("button", { name: "Editar meta" }).click();
    await expect(goal.getByLabel("Treinos no ano")).toHaveValue("24");
    await goal.getByLabel("Treinos no ano").fill("30");
    await goal.getByRole("button", { name: "Salvar meta" }).click();
    await expect(goal.getByText("0 de 30")).toBeVisible();

    // a meta é independente da regra
    await expect(page.getByRole("button", { name: "Escolher regra e nível" })).toBeVisible();

    await goal.getByRole("button", { name: "Remover meta" }).click();
    await expect(goal.getByRole("button", { name: "Definir meta" })).toBeVisible();
    expect((await backendJson(athlete.token, "/api/habituality/progress")).body.data.personalGoal).toBeNull();
  });

  test("nível perdido na mudança de versão: pede para reescolher", async ({ page }) => {
    const admin = await createAdmin();
    const ruleName = uniqueRuleName();
    const { ruleId } = await createHabitualityRule(admin.token, ruleName, BASIC_LEVELS);
    const athlete = await athleteWithToken();
    await trackHabituality(athlete.token, ruleId, "Iniciante");

    // nova versão sem o nível "Iniciante"; a vigência só chega com o tempo, então vai pro banco
    const versionId = await createFutureVersion(admin.token, ruleId, inDays(30), [
      { name: "Básico", requirements: [{ activityType: "TREINO", minQuantity: 1 }] },
      { name: "Pleno", requirements: [{ activityType: "TREINO", minQuantity: 4 }] },
    ]);
    backdateVersion(versionId, "2026-06-01");

    await login(page, athlete.email);
    await page.goto("/dashboard");
    // o selo na aba avisa mesmo fora dela
    await expect(habitualityTab(page)).toContainText("requer atenção");

    await habitualityTab(page).click();
    await expect(alertOf(page)).toContainText("“Iniciante” não existe mais");
    await page.getByRole("button", { name: "Escolher nível" }).click();
    const form = page.getByRole("form", { name: "Escolher regra e nível" });
    await expect(form.getByLabel("Nível", { exact: true }).locator("option", { hasText: "Iniciante" })).toHaveCount(0);
    await form.getByLabel("Nível", { exact: true }).selectOption("Pleno");
    await form.getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByText("Nível:")).toContainText("Pleno");
    await expect(habitualityTab(page)).not.toContainText("requer atenção");
  });

  test("mudança futura: faixa na aba e selo na barra de abas", async ({ page }) => {
    const admin = await createAdmin();
    const { ruleId } = await createHabitualityRule(admin.token, uniqueRuleName(), BASIC_LEVELS);
    const athlete = await athleteWithToken();
    await trackHabituality(athlete.token, ruleId, "Iniciante");
    const date = inDays(45);
    await createFutureVersion(admin.token, ruleId, date, BASIC_LEVELS);

    await login(page, athlete.email);
    await page.goto("/dashboard");
    await expect(habitualityTab(page)).toContainText("requer atenção");

    await habitualityTab(page).click();
    await expect(page.getByRole("status").filter({ hasText: "A regra muda em" })).toContainText(brDate(date));
  });

  test("regra desativada: avisa e permite escolher outra", async ({ page }) => {
    const admin = await createAdmin();
    const ruleName = uniqueRuleName();
    const { ruleId } = await createHabitualityRule(admin.token, ruleName, BASIC_LEVELS);
    const other = uniqueRuleName("Outra");
    await createHabitualityRule(admin.token, other, BASIC_LEVELS);
    const athlete = await athleteWithToken();
    await trackHabituality(athlete.token, ruleId, "Iniciante");
    await backendJson(admin.token, `/api/admin/habituality/rules/${ruleId}`, "PUT", {
      name: ruleName,
      legalReference: "Portaria de teste",
      active: false,
    });

    await login(page, athlete.email);
    await page.goto("/dashboard?aba=habitualidade");
    await expect(alertOf(page)).toContainText(`“${ruleName}” foi desativada`);

    await page.getByRole("button", { name: "Escolher outra regra" }).click();
    const form = page.getByRole("form", { name: "Escolher regra e nível" });
    await expect(form.getByLabel("Regra", { exact: true }).locator("option", { hasText: ruleName })).toHaveCount(0);
    await form.getByLabel("Regra", { exact: true }).selectOption({ label: other });
    await form.getByLabel("Nível", { exact: true }).selectOption("Iniciante");
    await form.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText(other)).toBeVisible();
  });

  test("erro do backend ao salvar o acompanhamento aparece inline", async ({ page }) => {
    const admin = await createAdmin();
    const ruleName = uniqueRuleName();
    const { ruleId } = await createHabitualityRule(admin.token, ruleName, BASIC_LEVELS);
    const athlete = await athleteWithToken();
    await login(page, athlete.email);
    await page.goto("/dashboard?aba=habitualidade");

    await page.getByRole("button", { name: "Escolher regra e nível" }).click();
    const form = page.getByRole("form", { name: "Escolher regra e nível" });
    await form.getByLabel("Regra", { exact: true }).selectOption({ label: ruleName });
    await form.getByLabel("Nível", { exact: true }).selectOption("Iniciante");

    // a regra é desativada entre abrir o seletor e confirmar
    await backendJson(admin.token, `/api/admin/habituality/rules/${ruleId}`, "PUT", { name: ruleName, active: false });
    await form.getByRole("button", { name: "Confirmar" }).click();
    await expect(form.getByRole("alert")).toBeVisible();
    await expect(form.getByRole("button", { name: "Confirmar" })).toBeEnabled();
  });

  test("falha ao carregar a habitualidade mostra erro com 'Tentar de novo'", async ({ page }) => {
    const athlete = await athleteWithToken();
    await login(page, athlete.email);

    let fail = true;
    await page.route("**/api/habituality/progress", (route) =>
      fail
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: { code: "X", message: "Falhou" } }),
          })
        : route.continue()
    );
    await page.goto("/dashboard?aba=habitualidade");
    await expect(alertOf(page)).toContainText("Falhou");

    fail = false;
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByRole("button", { name: "Escolher regra e nível" })).toBeVisible();
  });
});
