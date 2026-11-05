import { test, expect, type APIResponse } from "@playwright/test";
import { BASE_URL, createAdmin, createUser, randomEmail } from "./helpers";

/**
 * BFF de planos e limites (FUC27/FUC28, Lote 1): sessão e papel, parâmetros validados, Origin, no-store e
 * repasse dos erros do backend. Tudo contra o backend real de teste.
 */
const SENHA = "senha12345";
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

async function expectError(response: APIResponse, status: number, code: string) {
  expect(response.status(), await response.text()).toBe(status);
  expect((await response.json()).error.code).toBe(code);
}

async function loginAs(request: import("@playwright/test").APIRequestContext, email: string) {
  const login = await request.post("/api/auth/login", { data: { email, password: SENHA } });
  expect(login.status()).toBe(200);
}

const ADMIN_READS = ["/api/admin/plans", "/api/admin/plans/audit", "/api/admin/users?email=abc"];

test.describe("BFF — planos e limites", () => {
  test("sem sessão: 401 em todas as rotas, admin e atleta", async ({ request }) => {
    for (const path of [...ADMIN_READS, "/api/users/me/plan"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
    }
  });

  test("atleta comum: 403 nas rotas admin (leitura e escrita) e 200 em /api/users/me/plan", async ({ request }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAs(request, email);

    for (const path of ADMIN_READS) expect((await request.get(path)).status(), path).toBe(403);
    expect((await request.post("/api/admin/plans", { data: { code: "ABC", name: "Abc" } })).status()).toBe(403);
    expect((await request.patch("/api/admin/plans/FREE", { data: { name: "X" } })).status()).toBe(403);
    expect((await request.patch("/api/admin/plans/FREE/limits", { data: { limits: { PHOTOS_PER_SERIES: 1 } } })).status()).toBe(403);
    expect((await request.put(`/api/admin/users/${UUID_INEXISTENTE}/plan`, { data: { planCode: "FREE" } })).status()).toBe(403);

    const mine = await request.get("/api/users/me/plan");
    expect(mine.status()).toBe(200);
    const { data } = await mine.json();
    expect(data.plan.code).toBeTruthy();
    expect(data.limits.photosPerSeries).toBeGreaterThan(0);
    expect(data.usage).toEqual({ photos: 0, storageBytes: 0 });
  });

  test("admin: lê planos e histórico; respostas sempre no-store", async ({ request }) => {
    const admin = await createAdmin();
    await loginAs(request, admin.email);

    for (const path of [...ADMIN_READS, "/api/users/me/plan"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["cache-control"], path).toContain("no-store");
    }
    const { data } = await (await request.get("/api/admin/plans")).json();
    expect(data.length).toBeGreaterThan(0);
    expect(data.filter((p: { default: boolean }) => p.default)).toHaveLength(1);
  });

  test("a busca de atleta repassa o uso (photoCount e storageBytes) sem alterar o resto", async ({ request }) => {
    const admin = await createAdmin();
    const athleteEmail = randomEmail();
    await createUser(athleteEmail);
    await loginAs(request, admin.email);

    const response = await request.get(`/api/admin/users?email=${encodeURIComponent(athleteEmail)}`);
    expect(response.status()).toBe(200);
    const { data } = await response.json();
    expect(data).toHaveLength(1);
    expect(Object.keys(data[0]).sort()).toEqual(["email", "id", "name", "photoCount", "planCode", "planName", "storageBytes"]);
    expect(data[0]).toMatchObject({ email: athleteEmail, photoCount: 0, storageBytes: 0, planCode: "FREE", planName: "Gratuito" });
    // erro do backend continua com status e código originais
    expect((await request.get("/api/admin/users?email=ab")).status()).toBe(400);
  });

  test("parâmetros inválidos dão 400 sem chegar ao backend (código de plano, UUID e limit do histórico)", async ({ request }) => {
    const admin = await createAdmin();
    await loginAs(request, admin.email);

    for (const code of ["gratuito", "..%2F..%2Factuator%2Fhealth", "A", "FREE%2Flimits", "A".repeat(31)]) {
      await expectError(await request.patch(`/api/admin/plans/${code}`, { data: { name: "Xx" } }), 400, "INVALID_PARAMETER");
      await expectError(await request.patch(`/api/admin/plans/${code}/limits`, { data: { limits: { PHOTOS_PER_SERIES: 1 } } }), 400, "INVALID_PARAMETER");
    }
    await expectError(await request.put("/api/admin/users/nao-e-uuid/plan", { data: { planCode: "FREE" } }), 400, "INVALID_PARAMETER");
    await expectError(await request.put("/api/admin/users/..%2F..%2Fapi%2Fusers%2Fme/plan", { data: { planCode: "FREE" } }), 400, "INVALID_PARAMETER");

    for (const limit of ["0", "201", "abc", "-1", "1e2", "5%0A"]) {
      await expectError(await request.get(`/api/admin/plans/audit?limit=${limit}`), 400, "INVALID_PARAMETER");
    }
    expect((await request.get("/api/admin/plans/audit?limit=200")).status()).toBe(200);
    expect((await request.get(`/api/admin/users?email=${"a".repeat(255)}`)).status()).toBe(400);
  });

  test("erros do backend chegam com status e código originais", async ({ request }) => {
    const admin = await createAdmin();
    await loginAs(request, admin.email);

    await expectError(await request.patch("/api/admin/plans/NAO_EXISTE", { data: { name: "Novo nome" } }), 404, "PLAN_NOT_FOUND");
    await expectError(await request.patch("/api/admin/plans/NAO_EXISTE/limits", { data: { limits: { PHOTOS_PER_SERIES: 3 } } }), 404, "PLAN_NOT_FOUND");
    await expectError(await request.put(`/api/admin/users/${UUID_INEXISTENTE}/plan`, { data: { planCode: "FREE" } }), 404, "USER_NOT_FOUND");
    await expectError(await request.post("/api/admin/plans", { data: { code: "minusculo", name: "Teste" } }), 400, "PLAN_CODE_INVALID");
    await expectError(await request.post("/api/admin/plans", { data: { code: "OK_COD", name: "x" } }), 400, "PLAN_NAME_INVALID");
    await expectError(await request.patch("/api/admin/plans/FREE/limits", { data: { limits: { PHOTOS_PER_SERIES: 21 } } }), 400, "PLAN_LIMIT_OUT_OF_RANGE");
    await expectError(await request.patch("/api/admin/plans/FREE/limits", { data: { limits: { INEXISTENTE: 1 } } }), 400, "PLAN_LIMIT_INVALID_KEY");
    await expectError(await request.patch("/api/admin/plans/FREE", { data: { active: false } }), 409, "PLAN_DEFAULT_CANNOT_BE_DEACTIVATED");
  });

  test("escrita cross-origin é barrada (403) e corpo não-JSON é recusado", async ({ request }) => {
    const admin = await createAdmin();
    await loginAs(request, admin.email);
    const evil = { Origin: "https://evil.example" };

    expect((await request.post("/api/admin/plans", { data: { code: "EVIL", name: "Evil" }, headers: evil })).status()).toBe(403);
    expect((await request.patch("/api/admin/plans/FREE", { data: { name: "Evil" }, headers: evil })).status()).toBe(403);
    expect((await request.patch("/api/admin/plans/FREE/limits", { data: { limits: { PHOTOS_PER_SERIES: 1 } }, headers: evil })).status()).toBe(403);
    expect((await request.put(`/api/admin/users/${UUID_INEXISTENTE}/plan`, { data: { planCode: "FREE" }, headers: evil })).status()).toBe(403);

    const notJson = await request.patch("/api/admin/plans/FREE", {
      headers: { "Content-Type": "text/plain", Origin: BASE_URL },
      data: "name=x",
    });
    expect(notJson.status()).toBe(415);

    // nada mudou
    const { data } = await (await request.get("/api/admin/plans")).json();
    expect(data.find((p: { code: string }) => p.code === "FREE").name).not.toBe("Evil");
  });
});
