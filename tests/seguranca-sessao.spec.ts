import { test, expect, type Page } from "@playwright/test";
import {
  BASE_URL,
  createUser,
  getLatestPasswordResetToken,
  getLatestRegistrationToken,
  randomEmail,
  refreshSession,
} from "./helpers";

/**
 * Lote 4 da auditoria de segurança do frontend:
 *  - A04: token de uso único sai da URL assim que a página carrega e a página manda Referrer-Policy: no-referrer;
 *  - A07: cookie shottrack_refresh só viaja em /api/auth (e some no logout).
 * (O scrubber do Sentry, A09, tem teste unitário em sentry-scrub.spec.ts.)
 */
const SENHA = "senha12345";

async function expectTokenGoneFromUrl(page: Page, token: string) {
  await expect.poll(() => page.url()).not.toContain("token");
  expect(page.url()).not.toContain(token);
}

async function requestPasswordReset(request: import("@playwright/test").APIRequestContext, email: string) {
  const response = await request.post("/api/auth/password-reset/request", { data: { email } });
  expect(response.status()).toBe(202);
  return getLatestPasswordResetToken(email);
}

test.describe("A04 — token fora da URL", () => {
  test("redefinir senha: a URL perde o token ao carregar e o fluxo segue até a nova senha entrar", async ({ page, request }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    const token = await requestPasswordReset(request, email);

    await page.goto(`/redefinir-senha?token=${token}`);
    await expect(page.getByRole("button", { name: "Redefinir senha" })).toBeVisible();
    await expectTokenGoneFromUrl(page, token);
    expect(new URL(page.url()).pathname).toBe("/redefinir-senha");
    expect(new URL(page.url()).search).toBe("");

    await page.getByLabel("Nova senha", { exact: true }).fill("novaSenha789");
    await page.getByLabel("Confirmar nova senha").fill("novaSenha789");
    await page.getByRole("button", { name: "Redefinir senha" }).click();
    await expect(page).toHaveURL(/\/login\?senha=redefinida/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("novaSenha789");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);
  });

  test("redefinir senha: o token enviado ao BFF é o do link, e erro de token usado continua tratado", async ({ page, request }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    const token = await requestPasswordReset(request, email);

    const sent: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/auth/password-reset/confirm")) sent.push(req.postData() ?? "");
    });
    await page.goto(`/redefinir-senha?token=${token}`);
    await expectTokenGoneFromUrl(page, token);
    await page.getByLabel("Nova senha", { exact: true }).fill("primeiraNova1");
    await page.getByLabel("Confirmar nova senha").fill("primeiraNova1");
    await page.getByRole("button", { name: "Redefinir senha" }).click();
    await expect(page).toHaveURL(/\/login\?senha=redefinida/);
    expect(JSON.parse(sent[0]).token).toBe(token);

    await page.goto(`/redefinir-senha?token=${token}`);
    await page.getByLabel("Nova senha", { exact: true }).fill("segundaNova2");
    await page.getByLabel("Confirmar nova senha").fill("segundaNova2");
    await page.getByRole("button", { name: "Redefinir senha" }).click();
    await expect(page.getByText("Esse link já foi utilizado.")).toBeVisible();
  });

  test("completar cadastro: a URL perde o token e o cadastro conclui e loga", async ({ page }) => {
    const email = randomEmail();
    await page.goto("/cadastro");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText(/verifique seu email/i)).toBeVisible();
    const token = await getLatestRegistrationToken(email);

    await page.goto(`/cadastro/completar?token=${token}`);
    await expect(page.getByRole("button", { name: "Concluir cadastro" })).toBeVisible();
    await expectTokenGoneFromUrl(page, token);
    expect(new URL(page.url()).pathname).toBe("/cadastro/completar");

    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Concluir cadastro" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);
  });

  test("sem token (ou depois de recarregar a página limpa) a tela mostra link inválido", async ({ page, request }) => {
    await page.goto("/redefinir-senha");
    await expect(page.getByText("Esse link de redefinição é inválido.")).toBeVisible();
    await page.goto("/cadastro/completar");
    await expect(page.getByText("Esse link de cadastro é inválido.")).toBeVisible();

    // consequência do token só existir em memória: recarregar depois da limpeza pede um link novo
    const email = randomEmail();
    await createUser(email, SENHA);
    const token = await requestPasswordReset(request, email);
    await page.goto(`/redefinir-senha?token=${token}`);
    await expectTokenGoneFromUrl(page, token);
    await page.reload();
    await expect(page.getByText("Esse link de redefinição é inválido.")).toBeVisible();
  });

  test("as duas páginas respondem Referrer-Policy: no-referrer; as demais mantêm strict-origin-when-cross-origin", async ({ request }) => {
    for (const path of ["/redefinir-senha?token=x", "/cadastro/completar?token=x", "/redefinir-senha", "/cadastro/completar"]) {
      expect((await request.get(path)).headers()["referrer-policy"], path).toBe("no-referrer");
    }
    for (const path of ["/login", "/cadastro", "/esqueci-senha", "/offline"]) {
      expect((await request.get(path)).headers()["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    }
  });
});

test.describe("A07 — cookie de refresh restrito a /api/auth", () => {
  async function loginUi(page: Page, email: string) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);
  }

  test("o login grava o refresh com Path=/api/auth (httpOnly) e o access com Path=/", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);

    const cookies = await context.cookies();
    const refresh = cookies.filter((c) => c.name === "shottrack_refresh");
    expect(refresh).toHaveLength(1);
    expect(refresh[0].path).toBe("/api/auth");
    expect(refresh[0].httpOnly).toBe(true);
    expect(refresh[0].sameSite).toBe("Lax");
    const access = cookies.find((c) => c.name === "shottrack_access")!;
    expect(access.path).toBe("/");
    expect(access.httpOnly).toBe(true);
  });

  test("o navegador só envia o refresh a /api/auth/**: páginas e demais rotas da API não o recebem", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);

    // cookies que o navegador anexaria a cada URL (mesma regra de path do envio real)
    const sentTo = async (path: string) => (await context.cookies(`${BASE_URL}${path}`)).map((c) => c.name);

    for (const path of ["/dashboard", "/acervo/armas", "/api/users/me", "/api/weapons", "/api/series/history", "/api/dashboard"]) {
      const names = await sentTo(path);
      expect(names, path).toContain("shottrack_access"); // a sessão continua funcionando
      expect(names, path).not.toContain("shottrack_refresh");
    }
    for (const path of ["/api/auth/logout", "/api/auth/login", "/api/auth/refresh"]) {
      expect(await sentTo(path), path).toContain("shottrack_refresh");
    }

    // e a tela autenticada segue carregando dados pelo BFF só com o access
    await page.goto("/acervo/armas");
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText(/acervo de armas está vazio/i)).toBeVisible();
  });

  test("o logout revoga o refresh no backend e limpa os dois cookies (inclusive o de Path=/api/auth)", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);
    const refresh = (await context.cookies()).find((c) => c.name === "shottrack_refresh")!;
    expect(refresh.path).toBe("/api/auth");

    const response = await page.request.post("/api/auth/logout");
    expect(response.status()).toBe(200);

    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("shottrack_refresh");
    expect(names).not.toContain("shottrack_access");
    expect((await refreshSession(refresh.value)).status).toBe(401);
  });

  test("sessão aberta antes da mudança (refresh antigo em Path=/): o próximo login o substitui e o logout o apaga", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await context.addCookies([{ name: "shottrack_refresh", value: "cookie-antigo", url: BASE_URL, httpOnly: true }]);
    expect((await context.cookies()).find((c) => c.name === "shottrack_refresh")!.path).toBe("/");

    await loginUi(page, email);
    const afterLogin = (await context.cookies()).filter((c) => c.name === "shottrack_refresh");
    expect(afterLogin).toHaveLength(1);
    expect(afterLogin[0].path).toBe("/api/auth");

    // e o cookie antigo sozinho também é limpo no logout
    await context.addCookies([{ name: "shottrack_refresh", value: "cookie-antigo", url: BASE_URL, httpOnly: true }]);
    await page.request.post("/api/auth/logout");
    expect((await context.cookies()).map((c) => c.name)).not.toContain("shottrack_refresh");
  });

  test("trocar a senha encerra as sessões e limpa o refresh restrito", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);
    const refresh = (await context.cookies()).find((c) => c.name === "shottrack_refresh")!;

    const response = await page.request.patch("/api/users/me/password", {
      data: { currentPassword: SENHA, newPassword: "outraSenha123" },
    });
    expect(response.status()).toBe(200);
    expect((await context.cookies()).map((c) => c.name)).not.toContain("shottrack_refresh");
    expect((await refreshSession(refresh.value)).status).toBe(401);
  });
});

test.describe("A07 — renovação de sessão", () => {
  const EXPIRED_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.assinatura-invalida";

  async function loginUi(page: Page, email: string) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);
  }

  const cookie = async (context: import("@playwright/test").BrowserContext, name: string) =>
    (await context.cookies()).find((c) => c.name === name);

  /** Simula o JWT de acesso vencido: o cookie continua lá, mas o backend o recusa (401). */
  async function expireAccess(context: import("@playwright/test").BrowserContext) {
    const access = (await cookie(context, "shottrack_access"))!;
    await context.addCookies([{ ...access, value: EXPIRED_JWT }]);
  }

  test("o cookie de acesso dura tanto quanto o refresh (7 dias), para a página não perder a sessão após 1 h", async ({ page, context }) => {
    await createUser(randomEmail(), SENHA); // aquece o backend de teste
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);
    const access = (await cookie(context, "shottrack_access"))!;
    const refresh = (await cookie(context, "shottrack_refresh"))!;
    expect(access.expires - Date.now() / 1000).toBeGreaterThan(6 * 24 * 3600);
    expect(refresh.expires - Date.now() / 1000).toBeGreaterThan(6 * 24 * 3600);
  });

  test("acesso vencido: a tela renova a sessão sozinha, repete a chamada e o atleta continua logado", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);
    const refreshAntes = (await cookie(context, "shottrack_refresh"))!.value;

    await expireAccess(context);
    const renovacoes: number[] = [];
    page.on("response", (res) => {
      if (res.url().endsWith("/api/auth/refresh")) renovacoes.push(res.status());
    });

    await page.goto("/acervo/armas");
    await expect(page.getByText(/acervo de armas está vazio/i)).toBeVisible();
    expect(page).toHaveURL(/\/acervo\/armas/);
    expect(renovacoes).toEqual([200]);

    const access = (await cookie(context, "shottrack_access"))!;
    const refresh = (await cookie(context, "shottrack_refresh"))!;
    expect(access.value).not.toBe(EXPIRED_JWT);
    expect(refresh.value).not.toBe(refreshAntes); // rotação
    expect(refresh.path).toBe("/api/auth");
    expect((await refreshSession(refreshAntes)).status).toBe(401); // o antigo foi revogado
  });

  test("várias chamadas com o acesso vencido geram uma única renovação (o refresh só pode ser usado uma vez)", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);
    await expireAccess(context);

    let renovacoes = 0;
    page.on("request", (req) => {
      if (req.url().endsWith("/api/auth/refresh")) renovacoes++;
    });
    const status = await page.evaluate(() =>
      Promise.all(Array.from({ length: 6 }, () => fetch("/api/users/me").then((r) => r.status)))
    );
    expect(status).toEqual([200, 200, 200, 200, 200, 200]);
    expect(renovacoes).toBe(1);
  });

  test("dois pedidos de renovação simultâneos com o mesmo refresh não derrubam a sessão (trava no servidor)", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);

    const [a, b] = await Promise.all([page.request.post("/api/auth/refresh"), page.request.post("/api/auth/refresh")]);
    expect([a.status(), b.status()]).toEqual([200, 200]);
    expect(JSON.stringify(await a.json())).toBe('{"ok":true}'); // nenhum token no corpo

    // a sessão continua válida com os cookies mais recentes
    expect((await page.request.get("/api/users/me")).status()).toBe(200);
    expect((await cookie(context, "shottrack_refresh"))!.path).toBe("/api/auth");
  });

  test("refresh recusado (inválido): a chamada devolve 401, a sessão local é limpa e a tela volta ao login", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);
    await expireAccess(context);
    const refresh = (await cookie(context, "shottrack_refresh"))!;
    await context.addCookies([{ ...refresh, value: "refresh-invalido" }]);

    await page.goto("/boas-vindas");
    await expect(page).toHaveURL(/\/login/);
    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("shottrack_access");
    expect(names).not.toContain("shottrack_refresh");
  });

  test("401 de negócio (senha atual incorreta) não renova a sessão nem repete o envio", async ({ page }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);

    const chamadas: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/auth/refresh") || req.url().includes("/api/users/me/email")) chamadas.push(new URL(req.url()).pathname);
    });
    const status = await page.evaluate(async (novo) => {
      const r = await fetch("/api/users/me/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: novo, currentPassword: "senhaErrada999" }),
      });
      return r.status;
    }, randomEmail());
    expect(status).toBe(401);
    expect(chamadas).toEqual(["/api/users/me/email"]); // uma tentativa, nenhuma renovação
  });

  test("sem cookie de refresh a rota responde 401 sem corpo de token e não chama a renovação em /api/auth/*", async ({ request }) => {
    const response = await request.post("/api/auth/refresh");
    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });
});
