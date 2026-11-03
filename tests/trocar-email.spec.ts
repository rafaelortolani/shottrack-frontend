import { test, expect, type Page } from "@playwright/test";
import {
  createUser,
  randomEmail,
  getLatestVerificationCode,
  getMessagesTo,
  loginAndGetToken,
  refreshSession,
} from "./helpers";

const SENHA = "senha12345";

async function loginAndGoToEmailChange(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas/);

  await page.goto("/usuario/perfil");
  await page.getByRole("link", { name: "Alterar" }).first().click();
  await expect(page).toHaveURL(/\/usuario\/email/);
}

async function requestChange(page: Page, newEmail: string, password = SENHA) {
  await page.getByLabel("Novo email").fill(newEmail);
  await page.getByLabel("Senha atual").fill(password);
  await page.getByRole("button", { name: "Enviar código" }).click();
}

async function fillCode(page: Page, code: string) {
  for (let i = 0; i < code.length; i++) {
    await page.getByLabel(`Dígito ${i + 1} do código`).fill(code[i]);
  }
}

test.describe("Usuário > Trocar email (FUC04)", () => {
  test("pede a senha atual, confirma o código e, como o backend revoga as sessões, leva ao login com aviso", async ({
    page,
    context,
  }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAndGoToEmailChange(page, email);
    const refresh = (await context.cookies()).find((c) => c.name === "shottrack_refresh")!.value;

    const newEmail = randomEmail();
    await expect(page.getByLabel("Senha atual")).toHaveAttribute("type", "password");
    await requestChange(page, newEmail);
    await expect(page.getByText(newEmail)).toBeVisible();

    await fillCode(page, await getLatestVerificationCode(newEmail));
    await page.getByRole("button", { name: "Confirmar" }).click();

    // sessão encerrada: login com mensagem clara, cookies limpos e refresh antigo revogado
    await expect(page).toHaveURL(/\/login\?email=alterado/);
    await expect(page.getByText("Email alterado. Entre novamente com o novo email.")).toBeVisible();
    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("shottrack_access");
    expect(names).not.toContain("shottrack_refresh");
    expect((await refreshSession(refresh)).status).toBe(401);

    // o e-mail antigo foi avisado (pedido + troca) e deixou de entrar; o novo entra
    await expect
      .poll(async () => (await getMessagesTo(email)).map((m) => m.subject).join("|"))
      .toMatch(/alterado|changed/i);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Email ou senha incorretos." })).toBeVisible();

    await page.getByLabel("Email").fill(newEmail);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/boas-vindas/);
    await page.goto("/usuario/perfil");
    await expect(page.getByText(newEmail)).toBeVisible();
  });

  test("senha atual incorreta aparece inline no campo, sem enviar código", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAndGoToEmailChange(page, email);

    const newEmail = randomEmail();
    await requestChange(page, newEmail, "senhaErrada999");

    // 401 do backend: NÃO é sessão expirada, então fica na tela e mostra o erro no campo
    await expect(page.getByRole("alert").filter({ hasText: "Senha atual incorreta" })).toBeVisible();
    await expect(page).toHaveURL(/\/usuario\/email/);
    await expect(page.getByRole("button", { name: "Enviar código" })).toBeEnabled();
    expect(await getMessagesTo(newEmail)).toEqual([]);

    // e com a senha certa o fluxo segue
    await page.getByLabel("Senha atual").fill(SENHA);
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByText(newEmail)).toBeVisible();
  });

  test("não envia sem a senha atual", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAndGoToEmailChange(page, email);

    await page.getByLabel("Novo email").fill(randomEmail());
    await page.getByRole("button", { name: "Enviar código" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Informe a senha atual" })).toBeVisible();
    await expect(page).toHaveURL(/\/usuario\/email/);
  });

  test("email de outra conta: a resposta é neutra (segue pro código) e nada muda na conta", async ({ page }) => {
    const email = randomEmail();
    const otherEmail = randomEmail();
    await createUser(email);
    await createUser(otherEmail);
    await loginAndGoToEmailChange(page, email);

    await requestChange(page, otherEmail);

    // o backend não revela o conflito (S05): a tela segue pro passo do código
    await expect(page.getByText(`Enviamos um código pra ${otherEmail}.`)).toBeVisible();
    await fillCode(page, "000000");
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText(/código incorreto/i)).toBeVisible();

    // a conta continua com o e-mail e a sessão de antes
    await page.goto("/usuario/perfil");
    await expect(page.getByText(email)).toBeVisible();
    expect(await loginAndGetToken(email)).toBeTruthy();
  });

  test("mostra erro ao confirmar com código incorreto", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAndGoToEmailChange(page, email);

    const newEmail = randomEmail();
    await requestChange(page, newEmail);
    await expect(page.getByText(newEmail)).toBeVisible();

    await fillCode(page, "000000");
    await page.getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByText(/código incorreto/i)).toBeVisible();
    await expect(page).toHaveURL(/\/usuario\/email/);
  });

  test("reenviar o código usa a senha já informada e voltar mantém o formulário", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAndGoToEmailChange(page, email);

    const newEmail = randomEmail();
    await requestChange(page, newEmail);
    await expect(page.getByText(newEmail)).toBeVisible();

    await page.getByRole("button", { name: "Reenviar código" }).click();
    await expect(page.getByText("Código reenviado")).toBeVisible();

    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page.getByLabel("Novo email")).toHaveValue(newEmail);
  });

  test("sem sessão (cookies apagados) leva ao login com a mensagem de sessão expirada", async ({ page, context }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAndGoToEmailChange(page, email);

    await context.clearCookies();
    await requestChange(page, randomEmail());

    await expect(page).toHaveURL(/\/login\?sessao=expirada/);
    await expect(page.getByText("Sua sessão expirou. Entre novamente.")).toBeVisible();
  });

  test("muitas tentativas de senha errada mostram a mensagem de limite no próprio campo (429 real do backend)", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAndGoToEmailChange(page, email);

    // Limite padrão: 5 pedidos/hora por atleta — o 6º é recusado.
    const newEmail = randomEmail();
    for (let attempt = 0; attempt < 5; attempt++) {
      await requestChange(page, newEmail, "senhaErrada999");
      await expect(page.getByRole("alert").filter({ hasText: "Senha atual incorreta" })).toBeVisible();
    }
    await requestChange(page, newEmail, "senhaErrada999");

    await expect(
      page.getByRole("alert").filter({ hasText: /^Muitas tentativas\. Tente novamente em \d+ (minutos?|horas?)\.$/ })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/usuario\/email/);
  });

  test("o BFF exige sessão e repassa a senha: sem sessão 401; senha errada 401 INVALID_CURRENT_PASSWORD; certa 200", async ({
    request,
  }) => {
    expect((await request.post("/api/users/me/email", { data: { email: randomEmail(), currentPassword: SENHA } })).status()).toBe(401);

    const email = randomEmail();
    await createUser(email);
    await request.post("/api/auth/login", { data: { email, password: SENHA } });

    const wrong = await request.post("/api/users/me/email", { data: { email: randomEmail(), currentPassword: "errada" } });
    expect(wrong.status()).toBe(401);
    expect((await wrong.json()).error.code).toBe("INVALID_CURRENT_PASSWORD");

    const missing = await request.post("/api/users/me/email", { data: { email: randomEmail() } });
    expect(missing.status()).toBe(400);

    const ok = await request.post("/api/users/me/email", { data: { email: randomEmail(), currentPassword: SENHA } });
    expect(ok.status()).toBe(200);
  });
});
