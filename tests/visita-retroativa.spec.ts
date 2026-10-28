import { test, expect, type Page } from "@playwright/test";
import {
  backendJson,
  closedVisit,
  createAdmin,
  createHabitualityRule,
  createUser,
  loginAndGetToken,
  randomEmail,
  registerTrainingLocation,
  startVisit,
  trackHabituality,
  uniqueRuleName,
} from "./helpers";

/**
 * Visita retroativa e edição de datas (ADR-0024 / FUC25). Cada teste cria o
 * próprio atleta. Datas em hora local, no formato do `datetime-local`.
 */
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas|\/dashboard|\/treinos/);
}

/** Dia `daysAgo` dias atrás, na hora `hour:minute` local. */
function at(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function local(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

const br = (date: Date) => date.toLocaleDateString("pt-BR");
const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

async function athleteWithLocation() {
  const email = randomEmail();
  await createUser(email);
  const token = await loginAndGetToken(email);
  const location = await registerTrainingLocation(token, { name: "Clube Retro", city: "Curitiba", state: "PR" });
  return { email, token, location, label: `${location.name} · ${location.city}/${location.state}` };
}

async function openStartForm(page: Page, label: string) {
  await page.goto("/treinos/nova");
  await page.getByLabel("Local de treino").selectOption({ label });
}

test.describe("Iniciar visita com data (FUC25)", () => {
  test("data pré-preenchida com agora e ajuda; visita com data passada aparece no histórico na data informada", async ({ page }) => {
    const athlete = await athleteWithLocation();
    await login(page, athlete.email);
    await openStartForm(page, athlete.label);

    const when = page.getByLabel("Quando foi?");
    await expect(when).toHaveAttribute("type", "datetime-local");
    await expect(when).toHaveValue(new RegExp(`^${local(new Date()).slice(0, 10)}T\\d{2}:\\d{2}$`));
    await expect(page.getByText(/Para treino que já aconteceu, altere a data/)).toBeVisible();

    const past = at(10, 9, 30);
    await when.fill(local(past));
    await page.getByRole("button", { name: "Iniciar" }).click();
    await expect(page).toHaveURL(/\/treinos\/visitas$/);
    await expect(page.getByText("Visita em andamento", { exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`Início: ${br(past)}.*${hhmm(past)}`))).toBeVisible();

    const visits = (await backendJson(athlete.token, "/api/visits")).body.data as { id: string; startedAt: string }[];
    expect(new Date(visits[0].startedAt).getTime()).toBe(past.getTime());
    await backendJson(athlete.token, `/api/visits/${visits[0].id}/closure`, "POST");

    await page.reload();
    await expect(page.getByText(new RegExp(br(past)))).toBeVisible();
  });

  test("sem mexer no campo, a visita começa agora (não envia startedAt)", async ({ page }) => {
    const athlete = await athleteWithLocation();
    await login(page, athlete.email);
    await openStartForm(page, athlete.label);
    const before = Date.now();
    await page.getByRole("button", { name: "Iniciar" }).click();
    await expect(page).toHaveURL(/\/treinos\/visitas$/);

    const [visit] = (await backendJson(athlete.token, "/api/visits")).body.data as { startedAt: string }[];
    expect(Math.abs(new Date(visit.startedAt).getTime() - before)).toBeLessThan(60_000);
  });

  test("recusa data futura e data com mais de 12 meses, sem sair da tela", async ({ page }) => {
    const athlete = await athleteWithLocation();
    await login(page, athlete.email);
    await openStartForm(page, athlete.label);

    await page.getByLabel("Quando foi?").fill(local(new Date(Date.now() + 2 * 86_400_000)));
    await page.getByRole("button", { name: "Iniciar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "futuro" })).toBeVisible();

    const old = new Date();
    old.setMonth(old.getMonth() - 13);
    await page.getByLabel("Quando foi?").fill(local(old));
    await page.getByRole("button", { name: "Iniciar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "12 meses" })).toBeVisible();

    await page.getByLabel("Quando foi?").fill("");
    await page.getByRole("button", { name: "Iniciar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Informe a data" })).toBeVisible();

    await expect(page).toHaveURL(/\/treinos\/nova$/);
    expect(((await backendJson(athlete.token, "/api/visits")).body.data as unknown[]).length).toBe(0);
  });

  test("erro do backend aparece inline (cliente com relógio adiantado) e o BFF repassa o código", async ({ page }) => {
    const athlete = await athleteWithLocation();
    await login(page, athlete.email);

    const response = await page.request.post("/api/visits", {
      data: { trainingLocationId: athlete.location.id, startedAt: new Date(Date.now() + 2 * 86_400_000).toISOString() },
    });
    expect(response.ok()).toBe(false);
    expect((await response.json()).error.code).toBe("VISIT_DATE_IN_FUTURE");

    // o relógio do navegador adiantado faz a validação do cliente passar; o backend recusa
    await page.clock.setFixedTime(new Date(Date.now() + 3 * 86_400_000));
    await openStartForm(page, athlete.label);
    await page.getByLabel("Quando foi?").fill(local(new Date(Date.now() + 86_400_000)));
    await page.getByRole("button", { name: "Iniciar" }).click();
    // o anunciador de rota do Next também tem role="alert"
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText("Informe");
    await expect(page).toHaveURL(/\/treinos\/nova$/);
  });
});

test.describe("Editar datas da visita (FUC25)", () => {
  test("visita encerrada: edita início e fim e o cabeçalho mostra os novos valores", async ({ page }) => {
    const athlete = await athleteWithLocation();
    const visit = await closedVisit(athlete.token, athlete.location.id, { startedAt: at(5, 10).toISOString() });
    await login(page, athlete.email);
    await page.goto(`/treinos/${visit.id}`);

    await page.getByRole("button", { name: "Editar datas" }).click();
    const form = page.getByRole("form", { name: "Editar datas da visita" });
    const start = at(3, 8, 15);
    const end = at(3, 11, 45);
    await expect(form.getByLabel("Início")).toHaveValue(local(at(5, 10)));
    await form.getByLabel("Início").fill(local(start));
    await form.getByLabel("Fim").fill(local(end));
    await form.getByRole("button", { name: "Salvar datas" }).click();

    await expect(form).toHaveCount(0);
    await expect(page.getByText(new RegExp(`Início: ${br(start)}.*${hhmm(start)}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Fim: ${br(end)}.*${hhmm(end)}`))).toBeVisible();

    const [saved] = (await backendJson(athlete.token, "/api/visits")).body.data as { startedAt: string; endedAt: string }[];
    expect(new Date(saved.startedAt).getTime()).toBe(start.getTime());
    expect(new Date(saved.endedAt).getTime()).toBe(end.getTime());
  });

  test("erros: fim antes do início e futuro (cliente) e intervalo inválido (backend), inline", async ({ page }) => {
    const athlete = await athleteWithLocation();
    const visit = await closedVisit(athlete.token, athlete.location.id, { startedAt: at(5, 10).toISOString() });
    await login(page, athlete.email);
    await page.goto(`/treinos/${visit.id}`);
    await page.getByRole("button", { name: "Editar datas" }).click();
    const form = page.getByRole("form", { name: "Editar datas da visita" });

    await form.getByLabel("Início").fill(local(at(3, 12)));
    await form.getByLabel("Fim").fill(local(at(3, 9)));
    await form.getByRole("button", { name: "Salvar datas" }).click();
    await expect(form.getByRole("alert")).toContainText("fim não pode ser anterior");

    await form.getByLabel("Início").fill(local(new Date(Date.now() + 86_400_000)));
    await form.getByRole("button", { name: "Salvar datas" }).click();
    await expect(form.getByRole("alert")).toContainText("futuro");

    // backend: início depois do fim
    const response = await page.request.patch(`/api/visits/${visit.id}/dates`, {
      data: { startedAt: at(1, 12).toISOString(), endedAt: at(2, 12).toISOString() },
    });
    expect(response.ok()).toBe(false);
    expect((await response.json()).error.code).toBe("VISIT_DATE_RANGE_INVALID");
    const tooOld = new Date();
    tooOld.setMonth(tooOld.getMonth() - 14);
    const old = await page.request.patch(`/api/visits/${visit.id}/dates`, { data: { startedAt: tooOld.toISOString() } });
    expect((await old.json()).error.code).toBe("VISIT_DATE_TOO_OLD");

    // nada foi alterado
    const [saved] = (await backendJson(athlete.token, "/api/visits")).body.data as { startedAt: string }[];
    expect(new Date(saved.startedAt).getTime()).toBe(at(5, 10).getTime());
  });

  test("visita em andamento: só o início é editável", async ({ page }) => {
    const athlete = await athleteWithLocation();
    const visit = await startVisit(athlete.token, athlete.location.id);
    await login(page, athlete.email);
    await page.goto(`/treinos/${visit.id}`);

    await page.getByRole("button", { name: "Editar datas" }).click();
    const form = page.getByRole("form", { name: "Editar datas da visita" });
    await expect(form.getByLabel("Fim")).toHaveCount(0);

    const start = at(2, 14, 20);
    await form.getByLabel("Início").fill(local(start));
    await form.getByRole("button", { name: "Salvar datas" }).click();
    await expect(form).toHaveCount(0);
    await expect(page.getByText(new RegExp(`Início: ${br(start)}.*${hhmm(start)}`))).toBeVisible();
    await expect(page.getByText(/Fim:/)).toHaveCount(0);
  });
});

test.describe("Efeito da data da visita (FUC25)", () => {
  test("a visita conta na habitualidade e na meta pelo ano da data de início, inclusive depois de editar", async ({ page }) => {
    const admin = await createAdmin();
    const ruleName = uniqueRuleName("Retro");
    const { ruleId } = await createHabitualityRule(admin.token, ruleName, [
      { name: "Básico", requirements: [{ activityType: "TREINO", minQuantity: 2 }] },
    ]);
    const athlete = await athleteWithLocation();
    await trackHabituality(athlete.token, ruleId, "Básico");
    await backendJson(athlete.token, "/api/habituality/personal-goal", "PUT", { yearlyTrainings: 10 });

    // uma visita neste ano e outra há ~11 meses (dentro da janela de 12 meses; ano anterior se não estivermos em dezembro)
    const recent = await closedVisit(athlete.token, athlete.location.id, { startedAt: at(20, 10).toISOString() });
    const old = new Date();
    old.setMonth(old.getMonth() - 11);
    await closedVisit(athlete.token, athlete.location.id, { startedAt: old.toISOString() });

    const progress = async () => (await backendJson(athlete.token, "/api/habituality/progress")).body.data;
    expect((await progress()).requirements[0].done).toBe(2);
    const sameYear = old.getFullYear() === new Date().getFullYear();
    expect((await progress()).personalGoal.doneThisYear).toBe(sameYear ? 2 : 1);

    await login(page, athlete.email);
    await page.goto("/dashboard?aba=habitualidade");
    await expect(page.getByText("2 de 2")).toBeVisible();
    await expect(page.getByText("Cumprido")).toBeVisible();

    // edita a visita recente para o fim do ano anterior: a meta deixa de contá-la
    const lastYear = new Date(new Date().getFullYear() - 1, 11, 20, 10, 0);
    const monthsBack = (new Date().getFullYear() - lastYear.getFullYear()) * 12 + new Date().getMonth() - lastYear.getMonth();
    test.skip(monthsBack > 11, "dezembro do ano anterior fica fora da janela de 12 meses nesta data");
    await page.goto(`/treinos/${recent.id}`);
    await page.getByRole("button", { name: "Editar datas" }).click();
    const form = page.getByRole("form", { name: "Editar datas da visita" });
    await form.getByLabel("Início").fill(local(lastYear));
    await form.getByLabel("Fim").fill(local(new Date(lastYear.getTime() + 3_600_000)));
    await form.getByRole("button", { name: "Salvar datas" }).click();
    await expect(form).toHaveCount(0);

    expect((await progress()).personalGoal.doneThisYear).toBe(sameYear ? 1 : 0);
    await page.goto("/dashboard?aba=habitualidade");
    await expect(page.getByText(new RegExp(`${sameYear ? 1 : 0} de 10`))).toBeVisible();
  });
});
