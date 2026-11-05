import { test, expect, type Page } from "@playwright/test";
import { backendPhotos, cameraButton, gallery, makeImage, seedPhotos, setup } from "./foto-helpers";
import {
  assignPlanByEmail,
  createAdmin,
  editLimits,
  myPlan,
  openAdminPlans,
  planCard,
  sharedPlan,
} from "./planos-helpers";

/**
 * FUC28 — Meu plano e uso (atleta) e os ajustes do FUC26. Backend REAL: planos, limites, fotos e uso vêm do backend de
 * teste. O plano do atleta é atribuído pela API do admin (um plano por teste, copiado do Gratuito, para os limites
 * serem só dele). `page.route` só aparece para injetar falha de carregamento do cartão.
 */
const card = (page: Page) => page.getByTestId("my-plan-card");
const bar = (page: Page, label: string) => card(page).getByRole("progressbar", { name: label });

async function upload(page: Page, n = 1) {
  await gallery(page).setInputFiles({ name: "alvo.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 400, 300, "image/jpeg") });
  await expect(page.getByTestId(`photo-count-${n}`)).not.toHaveText("0");
}

test.describe("Meu plano (FUC28) — cartão no Perfil", () => {
  test("mostra o plano, os limites em texto e as barras de uso; alerta a 80% e limite a 100%", async ({ page }, testInfo) => {
    const admin = await createAdmin();
    const plan = await sharedPlan(admin.token, "CARD", testInfo);
    await editLimits(admin.token, plan.code, { PHOTOS_PER_ATHLETE: 5, UPLOADS_PER_HOUR: 17 });
    const { token, seriesIds, email } = await setup(page);
    await assignPlanByEmail(admin.token, email, plan.code);

    await page.goto("/usuario/perfil");
    await expect(card(page).getByTestId("my-plan-name")).toHaveText(plan.name);
    await expect(card(page).getByText("Seu plano permite até 5 fotos por série e 17 envios por hora.")).toBeVisible();
    await expect(bar(page, "Fotos")).toHaveAttribute("aria-valuenow", "0");
    await expect(card(page).getByText("0 de 5")).toBeVisible();
    await expect(card(page).getByText("0 MB de 512 MB")).toBeVisible();
    await expect(card(page).locator("[data-level=ok]")).toHaveCount(2);
    await expect(card(page).getByText("Perto do limite")).toHaveCount(0);

    // 4 de 5 = 80%: alerta
    await seedPhotos(page, token, seriesIds[0], 4);
    await page.reload();
    await expect(card(page).getByText("4 de 5")).toBeVisible();
    await expect(bar(page, "Fotos")).toHaveAttribute("aria-valuenow", "80");
    await expect(card(page).locator("[data-level=warning]")).toHaveCount(1);
    await expect(card(page).getByText("Perto do limite")).toBeVisible();
    // o espaço usado vem do backend e aparece em MB
    const used = (await myPlan(token)).usage.storageBytes;
    expect(used).toBeGreaterThan(0);
    await expect(card(page).getByText(/\d+(,\d)? MB de 512 MB/)).toBeVisible();

    // 5 de 5 = 100%: limite
    await seedPhotos(page, token, seriesIds[0], 1);
    await page.reload();
    await expect(card(page).getByText("5 de 5")).toBeVisible();
    await expect(bar(page, "Fotos")).toHaveAttribute("aria-valuenow", "100");
    await expect(card(page).locator("[data-level=limit]")).toHaveCount(1);
    await expect(card(page).getByText("Limite atingido")).toBeVisible();
  });

  test("falha ao carregar mostra o erro com 'Tentar de novo', e o cartão carrega depois", async ({ page }) => {
    await setup(page);
    let fail = true;
    await page.route("**/api/users/me/plan", (route) =>
      fail ? route.fulfill({ status: 500, json: { error: { code: "X", message: "erro simulado" } } }) : route.fallback()
    );
    await page.goto("/usuario/perfil");
    await expect(card(page).getByRole("alert")).toContainText("erro simulado");
    fail = false;
    await card(page).getByRole("button", { name: "Tentar de novo" }).click();
    await expect(card(page).getByTestId("my-plan-name")).toHaveText("Gratuito");
    await expect(card(page).getByRole("alert")).toHaveCount(0);
  });

  test("o admin edita um limite e troca o plano pela tela; o atleta (outra sessão) vê o novo limite e o novo plano", async ({ page, browser }, testInfo) => {
    // atleta numa sessão própria, no plano padrão
    const athleteContext = await browser.newContext();
    const athletePage = await athleteContext.newPage();
    const { email: athleteEmail } = await setup(athletePage);
    await athletePage.goto("/usuario/perfil");
    await expect(card(athletePage).getByTestId("my-plan-name")).toHaveText("Gratuito");
    await expect(card(athletePage).getByText(/até 5 fotos por série/)).toBeVisible();

    // admin: cria o plano pela API, muda o limite e atribui o plano pela tela
    const admin = await openAdminPlans(page);
    const plan = await sharedPlan(admin.token, "CROSS", testInfo);
    await page.reload();
    const planBox = planCard(page, plan.code);
    await planBox.getByLabel("Fotos por série", { exact: true }).fill("8");
    await planBox.getByRole("button", { name: "Salvar alterações" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("status").filter({ hasText: /salvos\./ })).toBeVisible();

    await page.getByRole("tab", { name: "Atletas" }).click();
    await page.getByLabel("E-mail do atleta").fill(athleteEmail);
    await page.getByRole("button", { name: "Buscar" }).click();
    const row = page.getByRole("list", { name: "Resultado da busca" }).getByRole("listitem").filter({ hasText: athleteEmail });
    await row.getByLabel("Novo plano").selectOption({ label: plan.name });
    await row.getByRole("button", { name: /Alterar plano de/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(row.getByText("Plano atual:")).toContainText(plan.name);

    // o atleta recarrega e vê (sem cache obsoleto)
    await athletePage.reload();
    await expect(card(athletePage).getByTestId("my-plan-name")).toHaveText(plan.name);
    await expect(card(athletePage).getByText(/até 8 fotos por série/)).toBeVisible();
    await athleteContext.close();
  });
});

test.describe("Fotos do alvo (FUC26) com os limites do plano (FUC28)", () => {
  test("o limite da série vem do plano; atingir desabilita o envio com explicação; o uso é atualizado ao enviar e ao excluir; aumentar o limite libera", async ({ page }, testInfo) => {
    const admin = await createAdmin();
    const plan = await sharedPlan(admin.token, "SERIES", testInfo);
    await editLimits(admin.token, plan.code, { PHOTOS_PER_SERIES: 3 }); // 3, não 5: o número não está fixo no código
    const { token, seriesIds, email } = await setup(page);
    await assignPlanByEmail(admin.token, email, plan.code);
    await seedPhotos(page, token, seriesIds[0], 2);

    const planReads: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/users/me/plan")) planReads.push(request.url());
    });
    await page.goto("/treinos/visitas");
    await expect(page.getByTestId("photo-limit-1")).toHaveText("2 de 3 fotos nesta série");
    await cameraButton(page).click();
    await expect(page.getByRole("button", { name: "Tirar foto" })).toBeEnabled();

    // enviar a 3ª: o limite é atingido, o envio fica desabilitado com a explicação, e o uso foi lido de novo
    const readsBefore = planReads.length;
    await upload(page);
    await expect(page.getByTestId("photo-count-1")).toHaveText("3");
    await expect(page.getByTestId("photo-limit-1")).toHaveText("3 de 3 fotos nesta série");
    await expect(page.getByRole("button", { name: "Tirar foto" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Escolher da galeria" })).toBeDisabled();
    await expect(page.getByText("Você atingiu o limite de 3 fotos por série do seu plano. Exclua uma foto para enviar outra.")).toBeVisible();
    expect(planReads.length).toBeGreaterThan(readsBefore);
    expect((await myPlan(token)).usage.photos).toBe(3);

    // excluir uma foto no visualizador: libera o envio e o uso é atualizado de novo
    const readsAfterUpload = planReads.length;
    await page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first().click();
    await page.getByRole("button", { name: "Excluir foto" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("button", { name: "Confirmar" })).toHaveCount(0);
    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByTestId("photo-limit-1")).toHaveText("2 de 3 fotos nesta série");
    await expect(page.getByRole("button", { name: "Tirar foto" })).toBeEnabled();
    expect(planReads.length).toBeGreaterThan(readsAfterUpload);
    expect((await myPlan(token)).usage.photos).toBe(2);

    // reduzir o limite abaixo do uso não apaga nem esconde nada; só bloqueia novos envios
    await editLimits(admin.token, plan.code, { PHOTOS_PER_SERIES: 1 });
    await page.reload();
    await expect(page.getByTestId("photo-count-1")).toHaveText("2");
    await expect(page.getByTestId("photo-limit-1")).toHaveText("2 de 1 foto nesta série");
    await expect(page.getByRole("button", { name: /^Abrir foto do alvo da série 1/ })).toHaveCount(2);
    await cameraButton(page).click();
    await expect(page.getByRole("button", { name: "Tirar foto" })).toBeDisabled();
    await expect(page.getByText("Você atingiu o limite de 1 foto por série do seu plano. Exclua uma foto para enviar outra.")).toBeVisible();
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(2);

    // o backend também recusa (não só a tela)
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(await makeImage(page, 100, 80, "image/jpeg"))], { type: "image/jpeg" }), "a.jpg");
    const direct = await fetch(`${process.env.E2E_BACKEND_URL ?? "http://localhost:8090"}/api/series/${seriesIds[0]}/photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(direct.status).toBe(409);
    expect((await direct.json()).error.code).toBe("PHOTO_LIMIT_PER_SERIES_REACHED");

    // aumentar o limite libera de novo
    await editLimits(admin.token, plan.code, { PHOTOS_PER_SERIES: 4 });
    await page.reload();
    await expect(page.getByTestId("photo-limit-1")).toHaveText("2 de 4 fotos nesta série");
    await cameraButton(page).click();
    await expect(page.getByRole("button", { name: "Tirar foto" })).toBeEnabled();
  });

  test("mensagens do backend real: limite de fotos da conta e espaço do plano esgotado", async ({ page }, testInfo) => {
    const admin = await createAdmin();
    const plan = await sharedPlan(admin.token, "ACCT", testInfo);
    await editLimits(admin.token, plan.code, { PHOTOS_PER_ATHLETE: 2 });
    const { token, seriesIds, email } = await setup(page, { series: 2 });
    await assignPlanByEmail(admin.token, email, plan.code);
    await seedPhotos(page, token, seriesIds[0], 2);

    // série 2 está vazia (limite da série não atingido), mas a conta já tem 2 de 2 fotos
    await page.goto("/treinos/visitas");
    await cameraButton(page, 2).click();
    await expect(page.getByRole("button", { name: "Tirar foto" })).toBeEnabled();
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("alert").filter({ hasText: "Você chegou ao limite de fotos da conta. Exclua alguma para enviar outra." })).toBeVisible();
    expect(await backendPhotos(token, seriesIds[1])).toHaveLength(0);

    // espaço do plano esgotado (limite de espaço em 0)
    await editLimits(admin.token, plan.code, { PHOTOS_PER_ATHLETE: 100, STORAGE_BYTES_PER_ATHLETE: 0 });
    await page.reload();
    await cameraButton(page, 2).click();
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("alert").filter({ hasText: "Você atingiu o espaço do seu plano. Exclua fotos antigas para enviar novas." })).toBeVisible();
    expect(await backendPhotos(token, seriesIds[1])).toHaveLength(0);
    expect((await myPlan(token)).limits.storageBytesPerAthlete).toBe(0);
  });
});

