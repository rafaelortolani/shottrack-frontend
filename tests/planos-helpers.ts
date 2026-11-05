import { expect, type Page, type TestInfo } from "@playwright/test";
import { backendJson, createAdmin, createUser, loginAndGetToken, randomEmail } from "./helpers";

/**
 * Apoio dos testes de planos e limites (FUC27/FUC28). Tudo REAL (backend de teste): planos, limites e atribuições
 * são criados pela API do backend; a tela só faz o que o teste quer validar. O backend não tem rota de exclusão de
 * plano e aceita no máximo 20 planos por banco, então cada teste cria só os planos de que precisa.
 */
export type ApiPlan = {
  code: string;
  name: string;
  active: boolean;
  default: boolean;
  athleteCount: number;
  limits: { key: string; value: number; unit: string; min: number; max: number; defaultValue: number; enforced: boolean; customized: boolean }[];
};

export const MB = 1024 * 1024;

export function uniquePlanCode(): string {
  return `P${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export async function loginAs(page: Page, email: string, landing: RegExp = /\/boas-vindas|\/treinos\/visitas|\/dashboard/) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(landing);
}

export async function listPlans(adminToken: string): Promise<ApiPlan[]> {
  const { status, body } = await backendJson(adminToken, "/api/admin/plans");
  expect(status).toBe(200);
  return body.data;
}

export async function createPlan(
  adminToken: string,
  options: { code?: string; name?: string; copyFromCode?: string | null } = {}
): Promise<ApiPlan> {
  const code = options.code ?? uniquePlanCode();
  const { status, body } = await backendJson(adminToken, "/api/admin/plans", "POST", {
    code,
    name: options.name ?? `Plano ${code}`,
    copyFromCode: options.copyFromCode ?? null,
  });
  expect(status, JSON.stringify(body)).toBe(201);
  return body.data;
}

export async function editLimits(adminToken: string, code: string, limits: Record<string, number>) {
  const { status, body } = await backendJson(adminToken, `/api/admin/plans/${code}/limits`, "PATCH", { limits });
  expect(status, JSON.stringify(body)).toBe(200);
  return body.data as ApiPlan;
}

export async function updatePlan(adminToken: string, code: string, patch: { name?: string; active?: boolean; default?: boolean }) {
  return backendJson(adminToken, `/api/admin/plans/${code}`, "PATCH", patch);
}

export async function defaultPlanCode(adminToken: string): Promise<string> {
  const plan = (await listPlans(adminToken)).find((p) => p.default);
  if (!plan) throw new Error("Nenhum plano padrão no backend de teste");
  return plan.code;
}

/** Atleta comum, já com o plano `planCode` atribuído pelo admin. */
export async function createAthleteOnPlan(adminToken: string, planCode: string) {
  const email = randomEmail();
  await createUser(email);
  const { status, body } = await backendJson(adminToken, `/api/admin/users?email=${encodeURIComponent(email)}`);
  expect(status).toBe(200);
  const userId = body.data[0].id as string;
  const assigned = await backendJson(adminToken, `/api/admin/users/${userId}/plan`, "PUT", { planCode });
  expect(assigned.status, JSON.stringify(assigned.body)).toBe(200);
  return { email, userId, token: await loginAndGetToken(email) };
}

export async function myPlan(token: string) {
  const { status, body } = await backendJson(token, "/api/users/me/plan");
  expect(status).toBe(200);
  return body.data as {
    plan: { code: string; name: string };
    limits: { photosPerSeries: number; photosPerAthlete: number; storageBytesPerAthlete: number; uploadsPerHour: number };
    usage: { photos: number; storageBytes: number };
  };
}

export { createAdmin };

/** Troca o plano de um atleta (pelo e-mail) direto na API do backend. */
export async function assignPlanByEmail(adminToken: string, email: string, planCode: string) {
  const { status, body } = await backendJson(adminToken, `/api/admin/users?email=${encodeURIComponent(email)}`);
  expect(status).toBe(200);
  const userId = body.data[0].id as string;
  const assigned = await backendJson(adminToken, `/api/admin/users/${userId}/plan`, "PUT", { planCode });
  expect(assigned.status, JSON.stringify(assigned.body)).toBe(200);
  return userId;
}

/** Entra como administrador e abre Planos e limites. */
export async function openAdminPlans(page: Page) {
  const admin = await createAdmin();
  await loginAs(page, admin.email);
  await page.goto("/admin/planos");
  await expect(page.getByRole("heading", { name: "Planos e limites", level: 1 })).toBeVisible();
  return admin;
}

export const planCard = (page: Page, code: string) => page.locator(`li[data-plan="${code}"]`);

const DEFAULT_LIMITS = {
  PHOTOS_PER_SERIES: 5,
  PHOTOS_PER_ATHLETE: 500,
  STORAGE_BYTES_PER_ATHLETE: 512 * MB,
  UPLOADS_PER_HOUR: 30,
};

/**
 * Plano de teste COMPARTILHADO por chave e por projeto (o backend não exclui plano e aceita no máximo 20 por banco).
 * Se ainda não existe, é criado; a cada uso volta ao estado inicial (ativo, nome fixo, limites padrão), então um
 * teste nunca herda o que o anterior fez. O código leva o nome do projeto: chromium e celular não disputam o mesmo plano.
 */
export async function sharedPlan(adminToken: string, key: string, testInfo: TestInfo) {
  const project = testInfo.project.name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const code = `T_${key}_${project}`.slice(0, 30);
  const name = `Teste ${key} ${testInfo.project.name}`;
  const existing = (await listPlans(adminToken)).find((p) => p.code === code);
  if (!existing) await createPlan(adminToken, { code, name });
  else {
    if (!existing.active) expect((await updatePlan(adminToken, code, { active: true })).status).toBe(200);
    if (existing.name !== name) expect((await updatePlan(adminToken, code, { name })).status).toBe(200);
  }
  await editLimits(adminToken, code, DEFAULT_LIMITS);
  return { code, name };
}
