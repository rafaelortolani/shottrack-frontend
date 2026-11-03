import { test, expect } from "@playwright/test";
import { createUser, randomEmail, getLatestRegistrationToken, getMessagesTo, loginAndGetToken } from "./helpers";

/**
 * Os seletores (getByLabel, getByRole) assumem os rótulos usados no FUC01
 * revisado (docs/use-cases/FUC01-cadastro.md). Se o Claude Code implementou
 * com texto ligeiramente diferente, ajuste os textos abaixo pra bater com o
 * que existe de fato na tela — não force a tela a se adequar ao teste.
 */
/** A8: o backend responde igual exista a conta ou não — a tela só pode dizer isto. */
const NEUTRAL_MESSAGE = "Se o e-mail puder ser cadastrado, enviamos um link para continuar. Confira sua caixa de entrada.";

const RESEND_MESSAGE = "Se o e-mail puder ser cadastrado, reenviamos o link.";

test.describe("Cadastro (FUC01)", () => {
  test("solicita cadastro e reenvia o link de confirmação", async ({ page }) => {
    const email = randomEmail();

    await page.goto("/cadastro");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText(/verifique seu email/i)).toBeVisible();
    await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();

    const firstToken = await getLatestRegistrationToken(email);
    expect(firstToken).toBeTruthy();

    await page.getByRole("button", { name: "Reenviar" }).click();
    await expect(page.getByText(RESEND_MESSAGE)).toBeVisible();

    const secondToken = await getLatestRegistrationToken(email);
    expect(secondToken).toBeTruthy();
    expect(secondToken).not.toBe(firstToken);
  });

  test("email já existente: a mesma mensagem de um email novo, sem revelar a conta; o dono recebe só um aviso, sem link de cadastro", async ({
    page,
  }) => {
    const existing = randomEmail();
    const fresh = randomEmail();
    await createUser(existing);

    async function submittedMessage(email: string) {
      await page.goto("/cadastro");
      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();
      return page.locator("main").innerText();
    }

    const forExisting = await submittedMessage(existing);
    const forFresh = await submittedMessage(fresh);

    // a tela é idêntica nos dois casos (só dá pra distinguir olhando a caixa de entrada do dono)
    expect(forExisting).toBe(forFresh);
    expect(forExisting).not.toMatch(/já existe|já está|já cadastrad/i);
    await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toHaveCount(0);
    await expect(page).toHaveURL(/\/cadastro$/);

    // o dono do e-mail é avisado da tentativa; o aviso não leva link de cadastro
    await expect
      .poll(async () => (await getMessagesTo(existing)).map((m) => m.subject).join("|"))
      .toMatch(/tentativa de cadastro|registration attempt/i);
    const attempt = (await getMessagesTo(existing)).find((m) => /tentativa de cadastro|registration attempt/i.test(m.subject));
    expect(attempt!.snippet).not.toMatch(/token=/);
    // e o e-mail novo recebeu o link normalmente
    expect(await getLatestRegistrationToken(fresh)).toBeTruthy();

    // a conta existente segue intacta
    expect(await loginAndGetToken(existing)).toBeTruthy();
  });

  test("o reenvio de um email que já tem conta também não revela nada", async ({ page }) => {
    const existing = randomEmail();
    await createUser(existing);

    await page.goto("/cadastro");
    await page.getByLabel("Email").fill(existing);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();

    await page.getByRole("button", { name: "Reenviar" }).click();
    await expect(page.getByText(RESEND_MESSAGE)).toBeVisible();
    await expect(page.getByText(/já existe|já está/i)).toHaveCount(0);
  });

  test("email com maiúsculas: o cadastro conclui e o login vale em minúsculas e como foi digitado", async ({ page }) => {
    const mixed = `Atleta.${Date.now()}@ShotTrack.COM`;
    const lower = mixed.toLowerCase();

    await page.goto("/cadastro");
    await page.getByLabel("Email").fill(mixed);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();

    const token = await getLatestRegistrationToken(lower);
    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Atleta Maiúsculo");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Concluir cadastro" }).click();
    await expect(page).toHaveURL(/\/login/);

    for (const typed of [lower, mixed]) {
      await page.goto("/login");
      await page.getByLabel("Email").fill(typed);
      await page.getByLabel("Senha").fill("senha12345");
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/boas-vindas/);
      await page.request.post("/api/auth/logout");
    }

    // pedir cadastro do mesmo e-mail com outra capitalização é "e-mail já existente": mesma tela neutra
    await page.goto("/cadastro");
    await page.getByLabel("Email").fill(mixed.toUpperCase());
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();
  });
});
