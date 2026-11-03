import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  createUser,
  randomEmail,
  loginAndGetToken,
  getValidWeaponCombo,
  registerWeapon,
} from "./helpers";

async function login(page: Page, email: string, password = "senha12345") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas/);
}

async function openExportDialog(page: Page) {
  await page.getByRole("button", { name: "Baixar meus dados" }).click();
  const dialog = page.getByRole("dialog", { name: "Baixar meus dados" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Usuário > Privacidade (FUC21)", () => {
  test("aba Privacidade aparece no menu de Usuário e abre com os dois cartões e os links legais", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await page.goto("/usuario");
    await page.getByRole("link", { name: /^Privacidade/ }).first().click();
    await expect(page).toHaveURL(/\/usuario\/privacidade$/);

    await expect(page.getByRole("heading", { name: "Privacidade", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Excluir minha conta", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("href", "/termos");
    await expect(page.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", "/privacidade");
  });

  test("baixa os dados: arquivo shottrack-dados-AAAAMMDD.json com as seções esperadas e sem segredos", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { model, caliber } = await getValidWeaponCombo(token);
    await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });

    await login(page, email);
    await page.goto("/usuario/privacidade");

    const dialog = await openExportDialog(page);
    await dialog.getByLabel("Senha atual").fill("senha12345");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: "Baixar" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^shottrack-dados-\d{8}\.json$/);

    const content = readFileSync((await download.path())!, "utf-8");
    const data = JSON.parse(content);
    for (const section of [
      "exportedAt",
      "profile",
      "practicedModalities",
      "weapons",
      "ammunitions",
      "accessories",
      "trainingLocations",
      "visits",
    ]) {
      expect(data, `seção ${section}`).toHaveProperty(section);
    }
    expect(data.profile.email).toBe(email);
    expect(data.profile.termsAcceptedAt).toBeTruthy();
    expect(data.weapons).toHaveLength(1);
    expect(data.weapons[0].model).toBe(model.name);
    expect(content).not.toMatch(/password|hash|refreshToken|accessToken/i);
    await expect(dialog).toHaveCount(0); // fecha depois de baixar
  });

  test("exportação: o diálogo exige a senha; senha errada aparece inline, sem baixar nada, e a certa baixa", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);
    await page.goto("/usuario/privacidade");

    // o botão da página só abre o diálogo: nada é baixado nem pedido sem a senha
    const exportRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/users/me/export")) exportRequests.push(req.method());
    });
    const dialog = await openExportDialog(page);
    expect(exportRequests).toEqual([]);

    const confirm = dialog.getByRole("button", { name: "Baixar" });
    await expect(confirm).toBeDisabled();

    let downloaded = false;
    page.on("download", () => (downloaded = true));
    await dialog.getByLabel("Senha atual").fill("senhaErrada999");
    await confirm.click();

    // 401 do backend por senha errada NÃO é sessão expirada: continua no diálogo, com o erro inline
    await expect(dialog.getByRole("alert")).toHaveText("Senha atual incorreta");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/usuario\/privacidade$/);
    expect(downloaded).toBe(false);
    expect(exportRequests).toEqual(["POST"]);

    await dialog.getByLabel("Senha atual").fill("senha12345");
    const [download] = await Promise.all([page.waitForEvent("download"), confirm.click()]);
    expect(download.suggestedFilename()).toMatch(/^shottrack-dados-\d{8}\.json$/);
  });

  test("exportação: cancelar fecha o diálogo sem pedir nada ao BFF", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);
    await page.goto("/usuario/privacidade");

    const exportRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/users/me/export")) exportRequests.push(req.method());
    });
    const dialog = await openExportDialog(page);
    await dialog.getByLabel("Senha atual").fill("senha12345");
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    await expect(dialog).toHaveCount(0);
    expect(exportRequests).toEqual([]);

    // reabrir começa limpo
    const reopened = await openExportDialog(page);
    await expect(reopened.getByLabel("Senha atual")).toHaveValue("");
  });

  test("exportação acima do limite mostra a mensagem de muitas tentativas no diálogo (429 real do backend)", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);
    await page.goto("/usuario/privacidade");

    const dialog = await openExportDialog(page);
    await dialog.getByLabel("Senha atual").fill("senhaErrada999");

    // Limite padrão: 3 tentativas/hora por atleta (senha errada também conta) — a 4ª é recusada.
    for (let attempt = 0; attempt < 3; attempt++) {
      await dialog.getByRole("button", { name: "Baixar" }).click();
      await expect(dialog.getByRole("alert")).toHaveText("Senha atual incorreta");
    }
    await dialog.getByRole("button", { name: "Baixar" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(/^Muitas tentativas\. Tente novamente em \d+ (minutos?|horas?)\.$/);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Baixar" })).toBeEnabled();
  });

  test("exclusão: botão do diálogo exige senha; senha errada mostra erro e a conta permanece", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);
    await page.goto("/usuario/privacidade");

    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    const dialog = page.getByRole("dialog", { name: "Excluir minha conta" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/definitivo/i)).toBeVisible();
    await expect(dialog.getByRole("listitem")).toHaveCount(4);

    const confirm = dialog.getByRole("button", { name: "Excluir definitivamente" });
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel("Senha atual").fill("senhaErrada999");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(dialog.getByRole("alert")).toHaveText("Senha atual incorreta");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/usuario\/privacidade$/);

    // a conta segue de pé: sessão e login continuam funcionando
    await page.goto("/usuario/perfil");
    await expect(page).toHaveURL(/\/usuario\/perfil$/);
    expect(await loginAndGetToken(email)).toBeTruthy();
  });

  test("cancelar fecha o diálogo sem excluir", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);
    await page.goto("/usuario/privacidade");

    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    const dialog = page.getByRole("dialog", { name: "Excluir minha conta" });
    await dialog.getByLabel("Senha atual").fill("senha12345");
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    await expect(dialog).toHaveCount(0);
    expect(await loginAndGetToken(email)).toBeTruthy();
  });

  test("exclui a conta com a senha correta: vai ao login com aviso, sessão encerrada e a conta antiga não entra mais", async ({
    page,
    context,
  }) => {
    const email = randomEmail();
    await createUser(email);
    const token = await loginAndGetToken(email);
    const { model, caliber } = await getValidWeaponCombo(token);
    await registerWeapon(token, { modelId: model.id, caliberId: caliber.id });

    await login(page, email);
    await page.goto("/usuario/privacidade");

    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    const dialog = page.getByRole("dialog", { name: "Excluir minha conta" });
    await dialog.getByLabel("Senha atual").fill("senha12345");
    await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();

    await expect(page).toHaveURL(/\/login\?conta=excluida/);
    await expect(page.getByText("Sua conta foi excluída.")).toBeVisible();

    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("shottrack_access");
    expect(names).not.toContain("shottrack_refresh");

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill("senha12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Email ou senha incorretos." })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("exclusão acima do limite mostra a mensagem de muitas tentativas no diálogo (429 real do backend)", async ({
    page,
  }) => {
    const email = randomEmail();
    await createUser(email);
    await login(page, email);
    await page.goto("/usuario/privacidade");

    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    const dialog = page.getByRole("dialog", { name: "Excluir minha conta" });
    await dialog.getByLabel("Senha atual").fill("senhaErrada999");

    // Limite padrão: 5 tentativas/hora por atleta — a 6ª é recusada.
    for (let attempt = 0; attempt < 5; attempt++) {
      await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();
      await expect(dialog.getByRole("alert")).toHaveText("Senha atual incorreta");
    }
    await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(/^Muitas tentativas\. Tente novamente em \d+ (minutos?|horas?)\.$/);
    await expect(dialog).toBeVisible();
  });

  test("a API do BFF de privacidade responde 401 sem sessão", async ({ request }) => {
    expect((await request.post("/api/users/me/export", { data: { currentPassword: "x" } })).status()).toBe(401);
    expect((await request.post("/api/users/me/deletion", { data: { password: "x" } })).status()).toBe(401);
  });

  test("BFF da exportação: exige a senha (POST), repassa o arquivo com Content-Disposition e nunca guarda em cache", async ({
    request,
  }) => {
    const email = randomEmail();
    await createUser(email);
    await request.post("/api/auth/login", { data: { email, password: "senha12345" } });

    // a rota antiga (GET, sem senha) não existe mais
    expect((await request.get("/api/users/me/export")).status()).toBe(405);

    const wrong = await request.post("/api/users/me/export", { data: { currentPassword: "errada" } });
    expect(wrong.status()).toBe(401);
    expect((await wrong.json()).error.code).toBe("INVALID_CURRENT_PASSWORD");
    expect(wrong.headers()["cache-control"]).toBe("no-store");

    const ok = await request.post("/api/users/me/export", { data: { currentPassword: "senha12345" } });
    expect(ok.status()).toBe(200);
    expect(ok.headers()["cache-control"]).toBe("no-store");
    expect(ok.headers()["content-type"]).toContain("application/json");
    expect(ok.headers()["content-disposition"]).toMatch(/filename="?shottrack-dados-\d{8}\.json"?/);
    expect((await ok.json()).profile.email).toBe(email);
  });
});
