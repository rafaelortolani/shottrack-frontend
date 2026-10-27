import { test, expect } from "@playwright/test";
import { randomEmail, getLatestRegistrationToken, expireRegistrationToken } from "./helpers";

/**
 * Os seletores assumem os rótulos usados no FUC10
 * (docs/use-cases/FUC10-completar-cadastro.md). Ajuste os textos abaixo pra
 * bater com o que existe de fato na tela, se necessário.
 */
test.describe("Completar cadastro (FUC10)", () => {
  test("fluxo completo: solicita, pega o link no Mailpit, completa e loga", async ({ page }) => {
    const email = randomEmail();

    await page.goto("/cadastro");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText(/verifique seu email/i)).toBeVisible();

    const token = await getLatestRegistrationToken(email);

    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/conta criada com sucesso/i)).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/boas-vindas/);
  });

  test("mostra erro claro quando o token já foi usado", async ({ page }) => {
    const email = randomEmail();

    await fetch("http://localhost:3000/api/users/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const token = await getLatestRegistrationToken(email);

    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Concluir cadastro" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Outra Tentativa");
    await page.getByLabel("Senha").fill("outrasenha123");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(page.getByText(/cadastro já foi concluído/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o login" })).toBeVisible();
  });

  test("mostra erro claro quando o token expirou", async ({ page }) => {
    const email = randomEmail();

    await fetch("http://localhost:3000/api/users/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const token = await getLatestRegistrationToken(email);
    expireRegistrationToken(token);

    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(page.getByText(/link expirou/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitar novo cadastro" })).toBeVisible();
  });

  test("mostra erro claro quando o token é inválido ou inexistente", async ({ page }) => {
    await page.goto("/cadastro/completar?token=token-que-nunca-existiu");
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(page.getByText(/link de cadastro é inválido/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitar novo cadastro" })).toBeVisible();
  });

  test("aceite dos Termos é obrigatório: sem marcar o botão fica desabilitado e os links abrem em nova aba", async ({
    page,
  }) => {
    const email = randomEmail();
    await fetch("http://localhost:3000/api/users/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const token = await getLatestRegistrationToken(email);

    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill("senha12345");

    const submit = page.getByRole("button", { name: "Concluir cadastro" });
    const accept = page.getByLabel(/Li e aceito/);
    await expect(accept).not.toBeChecked();
    await expect(submit).toBeDisabled();

    await expect(page.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("target", "_blank");
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("link", { name: "Termos de Uso" }).click(),
    ]);
    await expect(popup).toHaveURL(/\/termos$/);
    await popup.close();

    await accept.check();
    await expect(submit).toBeEnabled();
    await accept.uncheck();
    await expect(submit).toBeDisabled();

    await accept.check();
    await submit.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("o backend recusa o cadastro sem aceite (TERMS_NOT_ACCEPTED) e a tela mostra o erro", async ({ page }) => {
    const email = randomEmail();
    await fetch("http://localhost:3000/api/users/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const token = await getLatestRegistrationToken(email);

    // Pelo BFF, sem acceptedTerms: erro real do backend
    const response = await page.request.post("/api/users/registration/completion", {
      data: { token, name: "Atleta de Teste", password: "senha12345" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("TERMS_NOT_ACCEPTED");

    // Na tela: o token segue válido (nada foi consumido) e a recusa aparece inline
    await page.route("**/api/users/registration/completion", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "TERMS_NOT_ACCEPTED", message: "Aceite os termos" } }),
      })
    );
    await page.goto(`/cadastro/completar?token=${token}`);
    await page.getByLabel("Nome").fill("Atleta de Teste");
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "É preciso aceitar os Termos de Uso e a Política de Privacidade" })
    ).toBeVisible();
  });
});
