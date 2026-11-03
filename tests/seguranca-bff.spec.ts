import { test, expect, type APIRequestContext, type APIResponse } from "@playwright/test";
import { BASE_URL, createUser, randomEmail, loginAndGetToken, getAccessoryTypes, registerAccessory } from "./helpers";

/**
 * Lote 2 da auditoria de segurança do frontend: BFF fechado.
 *  - A02: parâmetro de rota só entra no caminho do backend se for UUID;
 *  - A05: escrita cross-origin bloqueada no proxy.ts (403) e corpo não-JSON recusado (415);
 *  - A10: corpo inválido vira 400, e falha de rede não deixa a tela presa.
 */
const SENHA = "senha12345";
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

async function loggedRequest(request: APIRequestContext) {
  const email = randomEmail();
  await createUser(email);
  const login = await request.post("/api/auth/login", { data: { email, password: SENHA } });
  expect(login.status()).toBe(200);
  return email;
}

async function expectError(response: APIResponse, status: number, code: string) {
  expect(response.status()).toBe(status);
  expect((await response.json()).error.code).toBe(code);
}

test.describe("A02 — parâmetro de rota validado como UUID", () => {
  test("travessia de caminho e query injetada no parâmetro dão 400 e não chegam ao backend", async ({ request }) => {
    await loggedRequest(request);

    // Antes: o BFF chamava /actuator/health e /api/users/me do backend com o token do usuário
    const traversals = [
      "..%2F..%2Factuator%2Fhealth%3F",
      "..%2F..%2Fapi%2Fusers%2Fme%3F",
      "%2e%2e%2F%2e%2e%2Factuator%2Fhealth%3F",
      "%2E%2E%2F..%2Fapi%2Fusers%2Fme%3F",
      `${UUID_INEXISTENTE}%3Fx=1`,
      `${UUID_INEXISTENTE}%2Fseries`,
      "nao-e-uuid",
    ];
    for (const param of traversals) {
      const response = await request.get(`/api/trainings/${param}/series`);
      await expectError(response, 400, "INVALID_PARAMETER");
      expect(await response.text(), param).not.toContain('"UP"');
    }
  });

  test("DELETE com travessia não executa a rota alcançada (visits/..%2Fhabituality%2Ftracking)", async ({ request }) => {
    await loggedRequest(request);
    await expectError(await request.delete("/api/visits/..%2Fhabituality%2Ftracking"), 400, "INVALID_PARAMETER");
    await expectError(await request.delete("/api/visits/..%2Fhabituality%2Ftracking%3F"), 400, "INVALID_PARAMETER");
  });

  test("todo parâmetro de rota é validado, inclusive o segundo e os de admin", async ({ request }) => {
    await loggedRequest(request);
    await expectError(
      await request.delete(`/api/accessories/${UUID_INEXISTENTE}/weapons/..%2F..%2Fweapons`),
      400,
      "INVALID_PARAMETER"
    );
    await expectError(await request.delete(`/api/series/${UUID_INEXISTENTE}/results/..%2F`), 400, "INVALID_PARAMETER");
    await expectError(await request.get("/api/weapon-catalog/brands/..%2Fbrands/models"), 400, "INVALID_PARAMETER");
    await expectError(await request.put("/api/admin/habituality/rules/..%2Fx", { data: {} }), 400, "INVALID_PARAMETER");
    await expectError(await request.delete("/api/admin/habituality/versions/..%2Fx"), 400, "INVALID_PARAMETER");
  });

  test("UUID válido (também em maiúsculas) continua chegando ao backend", async ({ request }) => {
    const email = await loggedRequest(request);

    // UUID válido porém inexistente: o 404 é do backend, não o 400 do BFF
    for (const id of [UUID_INEXISTENTE, UUID_INEXISTENTE.toUpperCase()]) {
      const response = await request.get(`/api/trainings/${id}/series`);
      expect(response.status(), id).not.toBe(400);
      expect(response.status(), id).toBeGreaterThanOrEqual(403);
    }

    // Recurso real: excluir o acessório criado
    const token = await loginAndGetToken(email);
    const [type] = await getAccessoryTypes(token);
    const accessory = await registerAccessory(token, { name: "Coldre", typeId: type.id });
    expect((await request.delete(`/api/accessories/${accessory.id}`)).status()).toBe(200);
  });
});

test.describe("A05 — origem cruzada em métodos de escrita", () => {
  test("POST com Origin de outro site → 403, com e sem sessão", async ({ request }) => {
    const evil = { Origin: "https://evil.example" };

    await expectError(
      await request.post("/api/practiced-modalities", { headers: evil, data: { modalityId: UUID_INEXISTENTE } }),
      403,
      "FORBIDDEN_ORIGIN"
    );

    await loggedRequest(request);
    for (const method of ["post", "put", "patch", "delete"] as const) {
      const response = await request[method](`/api/series/${UUID_INEXISTENTE}`, { headers: evil, data: {} });
      await expectError(response, 403, "FORBIDDEN_ORIGIN");
    }
  });

  test("a escrita bloqueada não chega ao backend", async ({ request }) => {
    const email = await loggedRequest(request);
    const token = await loginAndGetToken(email);
    const [type] = await getAccessoryTypes(token);

    const blocked = await request.post("/api/accessories", {
      headers: { Origin: "https://evil.example" },
      data: { name: "Não deve existir", typeId: type.id },
    });
    expect(blocked.status()).toBe(403);

    const list = await (await request.get("/api/accessories")).json();
    expect(list.data).toHaveLength(0);
  });

  test("Sec-Fetch-Site diferente de same-origin/none → 403; Origin 'null' e malformado também", async ({ request }) => {
    for (const site of ["cross-site", "same-site"]) {
      const response = await request.post("/api/auth/login", {
        headers: { "Sec-Fetch-Site": site },
        data: { email: "a@b.com", password: "x" },
      });
      await expectError(response, 403, "FORBIDDEN_ORIGIN");
    }
    for (const origin of ["null", "isto não é uma url"]) {
      const response = await request.post("/api/auth/login", { headers: { Origin: origin }, data: {} });
      await expectError(response, 403, "FORBIDDEN_ORIGIN");
    }
  });

  test("mesma origem passa (Origin do próprio host, Sec-Fetch-Site same-origin/none, sem cabeçalhos)", async ({ request }) => {
    const credentials = { email: "nao-existe@shottrack.com", password: "qualquer-coisa" };
    const sameOriginHeaders: Record<string, string>[] = [{ Origin: BASE_URL }, { "Sec-Fetch-Site": "same-origin" }, { "Sec-Fetch-Site": "none" }, {}];
    for (const headers of sameOriginHeaders) {
      const response = await request.post("/api/auth/login", { headers, data: credentials });
      // passou pelo proxy.ts: quem responde é o backend (credencial inválida), não o 403 de origem
      expect(response.status(), JSON.stringify(headers)).toBe(401);
    }
  });

  test("leitura (GET) não é bloqueada por origem", async ({ request }) => {
    const response = await request.get("/api/weapons", { headers: { Origin: "https://evil.example" } });
    expect(response.status()).toBe(401); // sem sessão, não 403
  });

  test("corpo que não é application/json → 415 (text/plain e formulário cross-site)", async ({ request }) => {
    for (const contentType of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
      const response = await request.post("/api/practiced-modalities", {
        headers: { "Content-Type": contentType },
        data: '{"modalityId":"x"}',
      });
      await expectError(response, 415, "UNSUPPORTED_MEDIA_TYPE");
    }
    // JSON com charset continua valendo
    const ok = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      data: '{"email":"a@b.com","password":"x"}',
    });
    expect(ok.status()).not.toBe(415);
  });

  test("POST sem corpo (ex.: logout) e DELETE sem corpo continuam funcionando", async ({ request }) => {
    await loggedRequest(request);
    expect((await request.delete(`/api/accessories/${UUID_INEXISTENTE}`)).status()).not.toBe(415);
    expect((await request.post("/api/auth/logout")).status()).toBe(200);
  });
});

test.describe("A10 — corpo inválido e falha de rede", () => {
  const BAD_BODIES: [string, string][] = [
    ["xx", "texto que não é JSON"],
    ["null", "null"],
    ["[]", "array"],
    ['"texto"', "string JSON"],
    ["{", "JSON truncado"],
  ];

  for (const [raw, label] of BAD_BODIES) {
    test(`login com corpo inválido (${label}) → 400, não 500`, async ({ request }) => {
      const response = await request.post("/api/auth/login", { headers: { "Content-Type": "application/json" }, data: raw });
      await expectError(response, 400, "INVALID_BODY");
    });
  }

  test("corpo inválido → 400 nos handlers públicos, autenticados e passa-prato", async ({ request }) => {
    const json = { "Content-Type": "application/json" };
    for (const path of ["/api/users/registration", "/api/auth/password-reset/request", "/api/auth/password-reset/confirm"]) {
      await expectError(await request.post(path, { headers: json, data: "xx" }), 400, "INVALID_BODY");
    }

    await loggedRequest(request);
    const authenticated: [string, string][] = [
      ["post", "/api/weapons"],
      ["post", "/api/ammunitions"],
      ["post", "/api/accessories"],
      ["post", "/api/visits"],
      ["patch", "/api/users/me"],
      ["patch", "/api/users/me/password"],
      ["post", "/api/training-locations"],
      ["post", "/api/users/me/email"],
      ["post", "/api/users/me/deletion"],
      ["post", "/api/practiced-modalities"],
      ["post", `/api/trainings/${UUID_INEXISTENTE}/series`],
      ["post", `/api/series/${UUID_INEXISTENTE}/results`],
      // passa-prato (proxyToBackend com forwardBody): antes mandava {} ao backend
      ["put", "/api/habituality/personal-goal"],
      ["put", "/api/habituality/tracking"],
      ["patch", `/api/visits/${UUID_INEXISTENTE}/dates`],
    ];
    for (const [method, path] of authenticated) {
      const response = await request[method as "post"](path, { headers: json, data: "xx" });
      expect(response.status(), `${method} ${path}`).toBe(400);
      expect((await response.json()).error.code, `${method} ${path}`).toBe("INVALID_BODY");
    }
  });

  test("login sem rede: mostra aviso de conexão e libera o botão (antes: erro não tratado)", async ({ page }) => {
    await page.route("**/api/auth/login", (route) => route.abort("connectionrefused"));
    await page.goto("/login");

    await expect(async () => {
      await page.getByLabel("Email").fill("a@b.com");
      await page.getByLabel("Senha").fill("senha12345");
      await expect(page.getByLabel("Email")).toHaveValue("a@b.com");
    }).toPass();
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText(/sem conexão com o servidor/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  test("lista sem rede: mostra o erro em vez de ficar em 'carregando'", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);

    await page.route("**/api/weapons", (route) => route.abort("connectionrefused"));
    await page.goto("/acervo/armas");

    await expect(page.getByText("Não foi possível carregar as armas")).toBeVisible();
  });
});
