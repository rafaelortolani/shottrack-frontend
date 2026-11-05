import { test, expect, type Locator, type Page } from "@playwright/test";
import { seedPhotos, setup } from "./foto-helpers";
import { assignPlanByEmail, createAdmin, editLimits, loginAs, planCard, sharedPlan } from "./planos-helpers";

/**
 * FUC27/FUC28 no celular (projetos mobile-iphone e mobile-pixel; capturas a 390 px). Backend real. Cada controle
 * conferido está visível, dentro da tela e NÃO coberto (`document.elementFromPoint`), com alvo de toque ≥ 44 px e
 * sem rolagem horizontal. Os diálogos ficam acima da barra de navegação de baixo (camada z-dialog).
 */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "a página rola na horizontal").toBeLessThanOrEqual(1);
}

/** Botões e campos visíveis (dentro de `root`) com ao menos 44 px de altura; campos com fonte de 16 px. */
async function expectTouchFriendly(root: Locator) {
  const problems = await root.evaluate((container) => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const label = (el: Element) => (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.id || el.tagName).trim().slice(0, 40);
    const controls = [...container.querySelectorAll("button, select, input:not([type=hidden]):not([type=checkbox])")].filter(visible);
    return {
      small: controls.filter((el) => el.getBoundingClientRect().height < 43.5).map((el) => `${el.tagName} "${label(el)}" ${Math.round(el.getBoundingClientRect().height)}px`),
      zoom: controls
        .filter((el) => el.matches("input, select"))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => `${el.tagName} "${label(el)}" ${getComputedStyle(el).fontSize}`),
    };
  });
  expect(problems.small, "alvos de toque menores que 44px").toEqual([]);
  expect(problems.zoom, "campos com fonte menor que 16px (zoom no iOS)").toEqual([]);
}

async function expectUncovered(locator: Locator, label: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator, label).toBeVisible();
  const info = await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      inside: rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth,
      covered: !(top && (top === el || el.contains(top))),
      topmost: top ? `${top.tagName.toLowerCase()}${top.getAttribute("aria-label") ? `[${top.getAttribute("aria-label")}]` : ""}` : null,
    };
  });
  expect(info.inside, `${label}: dentro da tela`).toBe(true);
  expect(info.covered, `${label}: coberto por ${info.topmost}`).toBe(false);
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe("Planos e limites no celular (390 px)", () => {
  test("admin: cartões de plano, tabela vira lista, diálogos acima da barra de baixo, controles livres e com alvo de 44 px", async ({ page, browser }, testInfo) => {
    // atleta com fotos reais (sessão própria) para a busca com uso
    const athleteContext = await browser.newContext();
    const athletePage = await athleteContext.newPage();
    const athlete = await setup(athletePage);
    await seedPhotos(athletePage, athlete.token, athlete.seriesIds[0], 2);
    await athleteContext.close();

    const admin = await createAdmin();
    const plan = await sharedPlan(admin.token, "MOB", testInfo);
    await editLimits(admin.token, plan.code, { PHOTOS_PER_SERIES: 8 });
    await loginAs(page, admin.email);
    await page.goto("/admin/planos");
    await expect(page.getByRole("heading", { name: "Planos e limites", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const card = planCard(page, plan.code);
    await card.scrollIntoViewIfNeeded();
    await expectTouchFriendly(card);
    for (const name of ["Renomear", "Desativar", "Definir como padrão", "Salvar alterações"]) {
      await expectUncovered(card.getByRole("button", { name }), name);
    }
    for (const label of ["Fotos por série", "Fotos por atleta", "Espaço total por atleta", "Envios de foto por hora"]) {
      await expectUncovered(card.getByLabel(label, { exact: true }), label);
    }
    // cada linha de limite é um bloco empilhado (sem tabela larga): rótulo e campo na mesma largura da tela
    const labelBox = (await card.getByText("Fotos por série", { exact: true }).first().boundingBox())!;
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath("mobile-390-planos-lista.png"), fullPage: false });

    // diálogo "Novo plano"
    await page.getByRole("button", { name: "Novo plano" }).tap();
    const dialog = page.getByRole("dialog", { name: "Novo plano" });
    await expectTouchFriendly(dialog);
    for (const [label, locator] of [
      ["Nome", dialog.getByLabel("Nome")],
      ["Código", dialog.getByLabel("Código")],
      ["Copiar limites de", dialog.getByLabel("Copiar limites de (opcional)")],
      ["Criar plano", dialog.getByRole("button", { name: "Criar plano" })],
      ["Cancelar", dialog.getByRole("button", { name: "Cancelar" })],
    ] as const) {
      await expectUncovered(locator, `Novo plano › ${label}`);
    }
    await page.screenshot({ path: testInfo.outputPath("mobile-390-planos-novo.png") });
    await dialog.getByRole("button", { name: "Cancelar" }).tap();
    await expect(dialog).toHaveCount(0);

    // confirmação do resumo ao salvar limites
    await card.getByLabel("Fotos por série", { exact: true }).fill("3");
    await card.getByRole("button", { name: "Salvar alterações" }).tap();
    const confirm = page.getByRole("dialog", { name: "Salvar alterações nos limites?" });
    await expect(confirm.getByText("Fotos por série: 8 → 3")).toBeVisible();
    await expectUncovered(confirm.getByRole("button", { name: "Confirmar" }), "Confirmar");
    await expectUncovered(confirm.getByRole("button", { name: "Cancelar" }), "Cancelar");
    await page.screenshot({ path: testInfo.outputPath("mobile-390-planos-confirmar.png") });
    await confirm.getByRole("button", { name: "Confirmar" }).tap();
    await expect(page.getByRole("status").filter({ hasText: /salvos\./ })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // aba Atletas
    await page.getByRole("tab", { name: "Atletas" }).tap();
    await expectTouchFriendly(page.getByRole("tabpanel"));
    await expectUncovered(page.getByLabel("E-mail do atleta"), "E-mail do atleta");
    await expectUncovered(page.getByRole("button", { name: "Buscar" }), "Buscar");
    await expectNoHorizontalScroll(page);

    // busca com uso: o dado cabe no cartão, sem rolagem horizontal e com alvos de 44 px
    await page.getByLabel("E-mail do atleta").fill(athlete.email);
    await page.getByRole("button", { name: "Buscar" }).tap();
    const row = page.getByRole("list", { name: "Resultado da busca" }).getByRole("listitem").filter({ hasText: athlete.email });
    await expect(row.getByTestId("athlete-usage")).toContainText("Uso: 2 fotos ·");
    await expectUncovered(row.getByTestId("athlete-usage"), "uso do atleta");
    const usageBox = (await row.getByTestId("athlete-usage").boundingBox())!;
    expect(usageBox.x + usageBox.width).toBeLessThanOrEqual(390);
    await expectTouchFriendly(row);
    await expectNoHorizontalScroll(page);
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("mobile-390-planos-busca-uso.png") });

    // histórico no fim da página
    await page.getByRole("tab", { name: "Limites" }).tap();
    await page.getByRole("region", { name: "Histórico" }).scrollIntoViewIfNeeded();
    await expectNoHorizontalScroll(page);
  });

  test("atleta: cartão 'Meu plano' cabe na tela, com barras visíveis", async ({ page }, testInfo) => {
    const admin = await createAdmin();
    const plan = await sharedPlan(admin.token, "MOB", testInfo);
    const { email } = await setup(page);
    await assignPlanByEmail(admin.token, email, plan.code);
    await page.goto("/usuario/perfil");

    const card = page.getByTestId("my-plan-card");
    await expect(card.getByTestId("my-plan-name")).toHaveText(plan.name);
    await expectUncovered(card.getByRole("progressbar", { name: "Fotos" }), "barra de fotos");
    await expectUncovered(card.getByRole("progressbar", { name: "Espaço" }), "barra de espaço");
    await expectNoHorizontalScroll(page);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("mobile-390-meu-plano.png") });
  });
});
