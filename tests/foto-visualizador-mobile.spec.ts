import { test, expect, type Locator, type Page } from "@playwright/test";
import { backendPhotos, seedPhotos, setup } from "./foto-helpers";

/**
 * FUC26 — visualizador de fotos no celular (390 px). Defeito encontrado na verificação: os controles de baixo ficavam
 * ATRÁS da barra de navegação do app (mesmo z-index, e a barra vem depois no DOM). Agora o visualizador é um portal em
 * `document.body` com `z-viewer` (acima da barra). O teste prova, para cada controle, que está visível E que o ponto
 * central dele pertence a ele (`document.elementFromPoint`), e que o clique funciona. Backend real.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

/** Visível, dentro da tela e NÃO coberto: o elemento no centro do controle é o próprio controle ou um filho dele. */
async function expectUncovered(locator: Locator, label: string) {
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

/** Deslizar com toque de verdade (eventos de toque do Chromium → pointer events), da direita para a esquerda ou o inverso. */
async function swipe(page: Page, stage: Locator, direction: "left" | "right") {
  const box = (await stage.boundingBox())!;
  const y = box.y + box.height / 2;
  const [from, to] = direction === "left" ? [box.x + box.width * 0.85, box.x + box.width * 0.15] : [box.x + box.width * 0.15, box.x + box.width * 0.85];
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] });
  for (let i = 1; i <= 8; i++) {
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from + ((to - from) * i) / 8, y }] });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();
}

test.describe("Visualizador de fotos no celular (390 px)", () => {
  test("todos os controles ficam visíveis e livres da barra do app; os cliques funcionam; excluir com confirmação reduz o photoCount", async ({ page }, testInfo) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 3);
    await page.goto("/treinos/visitas");
    await expect(page.getByTestId("photo-count-1")).toHaveText("3");
    await expect(page.getByRole("navigation").filter({ hasText: "Treinos" }).first()).toBeVisible(); // a barra do app está na tela

    await page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first().tap();
    const viewer = page.getByRole("dialog", { name: /foto 1 de 3/ });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole("img", { name: "Foto do alvo da série 1" })).toBeVisible();

    // portal em document.body e camada acima da barra do app
    await expect(page.locator("body > [role=dialog]")).toHaveCount(1);
    const layers = await page.evaluate(() => {
      const nav = document.querySelector("nav.fixed") as HTMLElement;
      const dialog = document.querySelector("body > [role=dialog]") as HTMLElement;
      return { nav: Number(getComputedStyle(nav).zIndex), viewer: Number(getComputedStyle(dialog).zIndex) };
    });
    expect(layers.viewer).toBeGreaterThan(layers.nav);

    // foto 1 de 3: fechar, excluir e próxima
    await expectUncovered(viewer.getByRole("button", { name: "Fechar" }), "Fechar");
    await expectUncovered(viewer.getByRole("button", { name: "Excluir foto" }), "Excluir foto");
    await expectUncovered(viewer.getByRole("button", { name: "Próxima foto" }), "Próxima foto");
    await page.screenshot({ path: testInfo.outputPath("mobile-390-visualizador.png") });

    await viewer.getByRole("button", { name: "Próxima foto" }).tap();
    const second = page.getByRole("dialog", { name: /foto 2 de 3/ });
    await expect(second).toBeVisible();
    await expectUncovered(second.getByRole("button", { name: "Foto anterior" }), "Foto anterior");
    await second.getByRole("button", { name: "Foto anterior" }).tap();
    await expect(page.getByRole("dialog", { name: /foto 1 de 3/ })).toBeVisible();

    // excluir: cancelar mantém, confirmar remove
    await page.getByRole("dialog", { name: /foto 1 de 3/ }).getByRole("button", { name: "Excluir foto" }).tap();
    const confirm = page.getByRole("dialog", { name: "Excluir foto" });
    await expect(confirm.getByText("Esta foto será removida definitivamente")).toBeVisible();
    await expectUncovered(confirm.getByRole("button", { name: "Confirmar" }), "Confirmar");
    await expectUncovered(confirm.getByRole("button", { name: "Cancelar" }), "Cancelar");
    await page.screenshot({ path: testInfo.outputPath("mobile-390-confirmar-exclusao.png") });

    await confirm.getByRole("button", { name: "Cancelar" }).tap();
    await expect(confirm).toHaveCount(0);
    await expect(page.getByTestId("photo-count-1")).toHaveText("3");
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(3);

    await page.getByRole("dialog", { name: /foto 1 de 3/ }).getByRole("button", { name: "Excluir foto" }).tap();
    await page.getByRole("dialog", { name: "Excluir foto" }).getByRole("button", { name: "Confirmar" }).tap();
    await expect(page.getByTestId("photo-count-1")).toHaveText("2");
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(2);
    await expect(page.getByRole("dialog", { name: /foto 1 de 2/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("mobile-390-apos-excluir.png") });

    await page.getByRole("dialog", { name: /foto 1 de 2/ }).getByRole("button", { name: "Fechar" }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("deslizar com o dedo troca de foto (esquerda = próxima, direita = anterior)", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 3);
    await page.goto("/treinos/visitas");
    await page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first().tap();
    const viewer = page.getByRole("dialog");
    await expect(viewer.getByText("Foto 1 de 3")).toBeVisible();
    await expect(viewer.getByRole("img", { name: "Foto do alvo da série 1" })).toBeVisible();

    const stage = viewer.getByTestId("photo-stage");
    await swipe(page, stage, "left");
    await expect(viewer.getByText("Foto 2 de 3")).toBeVisible();
    await expect(viewer.getByRole("img", { name: "Foto do alvo da série 1" })).toBeVisible();
    await swipe(page, stage, "left");
    await expect(viewer.getByText("Foto 3 de 3")).toBeVisible();
    await swipe(page, stage, "right");
    await expect(viewer.getByText("Foto 2 de 3")).toBeVisible();
  });
});
