import { test, expect, type Page } from "@playwright/test";
import { createUser, randomEmail, getLatestPasswordResetToken } from "./helpers";

const SENT_MESSAGE = "Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.";

async function requestReset(page: Page, email: string) {
  await page.goto("/esqueci-senha");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
}

test.describe("Esqueci minha senha / Redefinir senha (FUC20)", () => {
  test("login tem o link; pede o link, redefine pelo e-mail e entra com a nova senha", async ({ page }) => {
    const email = randomEmail();
    const newPassword = "novaSenha789";
    await createUser(email, "senha12345");

    await page.goto("/login");
    await page.getByRole("link", { name: "Esqueci minha senha" }).click();
    await expect(page).toHaveURL(/\/esqueci-senha$/);

    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText(SENT_MESSAGE)).toBeVisible();

    const token = await getLatestPasswordResetToken(email);
    await page.goto(`/redefinir-senha?token=${token}`);
    await page.getByLabel("Nova senha", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirmar nova senha").fill(newPassword);
    await page.getByRole("button", { name: "Redefinir senha" }).click();

    await expect(page).toHaveURL(/\/login\?senha=redefinida/);
    await expect(page.getByText("Senha redefinida. Entre com a nova senha.")).toBeVisible();

    // a senha antiga deixa de valer; a nova entra
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Email ou senha incorretos." })).toBeVisible();

    await page.getByLabel("Senha").fill(newPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);
  });

  test("o mesmo link reutilizado mostra erro com caminho para pedir outro", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await requestReset(page, email);
    await expect(page.getByText(SENT_MESSAGE)).toBeVisible();
    const token = await getLatestPasswordResetToken(email);

    await page.goto(`/redefinir-senha?token=${token}`);
    await page.getByLabel("Nova senha", { exact: true }).fill("primeiraNova1");
    await page.getByLabel("Confirmar nova senha").fill("primeiraNova1");
    await page.getByRole("button", { name: "Redefinir senha" }).click();
    await expect(page).toHaveURL(/\/login\?senha=redefinida/);

    await page.goto(`/redefinir-senha?token=${token}`);
    await page.getByLabel("Nova senha", { exact: true }).fill("segundaNova2");
    await page.getByLabel("Confirmar nova senha").fill("segundaNova2");
    await page.getByRole("button", { name: "Redefinir senha" }).click();

    await expect(page.getByText("Esse link já foi utilizado.")).toBeVisible();
    await page.getByRole("link", { name: "Pedir um novo link" }).click();
    await expect(page).toHaveURL(/\/esqueci-senha$/);
  });

  test("token inexistente ou ausente mostra a tela de erro", async ({ page }) => {
    await page.goto("/redefinir-senha?token=token-que-nao-existe");
    await page.getByLabel("Nova senha", { exact: true }).fill("qualquerSenha1");
    await page.getByLabel("Confirmar nova senha").fill("qualquerSenha1");
    await page.getByRole("button", { name: "Redefinir senha" }).click();
    await expect(page.getByText("Esse link de redefinição é inválido.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Pedir um novo link" })).toBeVisible();

    await page.goto("/redefinir-senha");
    await expect(page.getByText("Esse link de redefinição é inválido.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Pedir um novo link" })).toBeVisible();
  });

  test("valida senha curta e confirmação diferente antes de enviar", async ({ page }) => {
    await page.goto("/redefinir-senha?token=qualquer");
    await page.getByLabel("Nova senha", { exact: true }).fill("curta");
    await page.getByLabel("Confirmar nova senha").fill("outra");
    await page.getByRole("button", { name: "Redefinir senha" }).click();

    await expect(page.getByText("Senha precisa ter no mínimo 8 caracteres")).toBeVisible();
    await expect(page.getByText("As senhas não são iguais")).toBeVisible();
    await expect(page).toHaveURL(/\/redefinir-senha/);
  });

  test("e-mail inexistente mostra a mesma mensagem de uma conta real", async ({ page }) => {
    await requestReset(page, `nao-existe.${Date.now()}@shottrack.com`);
    await expect(page.getByText(SENT_MESSAGE)).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
  });

  test("formato de e-mail inválido é recusado no campo", async ({ page }) => {
    await requestReset(page, "isso-nao-e-email");
    await expect(page.getByText("Email precisa ter um formato válido")).toBeVisible();
    await expect(page.getByText(SENT_MESSAGE)).toHaveCount(0);
  });

  test("Voltar ao login leva para /login", async ({ page }) => {
    await page.goto("/esqueci-senha");
    await page.getByRole("link", { name: "Voltar ao login" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Rate limit — 429 (ADR-0018)", () => {
  const rateLimited = {
    status: 429,
    contentType: "application/json",
    headers: { "Retry-After": "600" },
    body: JSON.stringify({ error: { code: "TOO_MANY_REQUESTS", message: "Muitas tentativas" } }),
  };

  test("login mostra a mensagem com o tempo do Retry-After e o formulário continua utilizável", async ({ page }) => {
    await page.route("**/api/auth/login", (route) => route.fulfill(rateLimited));

    await page.goto("/login");
    await page.getByLabel("Email").fill("alguem@shottrack.com");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Muitas tentativas. Tente novamente em 10 minutos." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login sem Retry-After mostra a mensagem genérica", async ({ page }) => {
    await page.route("**/api/auth/login", (route) => route.fulfill({ ...rateLimited, headers: {} }));

    await page.goto("/login");
    await page.getByLabel("Email").fill("alguem@shottrack.com");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Muitas tentativas. Tente novamente em alguns minutos." })).toBeVisible();
  });

  test("cadastro mostra a mensagem de muitas tentativas", async ({ page }) => {
    await page.route("**/api/users/registration", (route) => route.fulfill(rateLimited));

    await page.goto("/cadastro");
    await page.getByLabel("Email").fill("novo@shottrack.com");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Muitas tentativas. Tente novamente em 10 minutos." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  test("esqueci-senha mostra a mensagem de muitas tentativas", async ({ page }) => {
    await page.route("**/api/auth/password-reset/request", (route) => route.fulfill(rateLimited));

    await requestReset(page, "alguem@shottrack.com");

    await expect(page.getByRole("alert").filter({ hasText: "Muitas tentativas. Tente novamente em 10 minutos." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar link" })).toBeEnabled();
  });

  test("o BFF repassa o 429 e o Retry-After reais do backend no pedido de redefinição", async ({ request }) => {
    // Limite padrão: 5 pedidos/hora por e-mail. Insiste até estourar (máx. 12).
    const email = randomEmail();
    let limited;
    for (let attempt = 0; attempt < 12 && !limited; attempt++) {
      const response = await request.post("/api/auth/password-reset/request", { data: { email } });
      if (response.status() === 429) limited = response;
    }

    expect(limited, "o backend deveria aplicar rate limit no pedido de redefinição").toBeDefined();
    expect((await limited!.json()).error.code).toBe("TOO_MANY_REQUESTS");
    expect(Number(limited!.headers()["retry-after"])).toBeGreaterThan(0);
  });
});
