import { test, expect, type Page } from "@playwright/test";
import { createUser, randomEmail } from "./helpers";
import { backendDelete, backendPhotos, cameraButton, gallery, makeImage, seedPhotos, setup, watchUploads } from "./foto-helpers";

/**
 * FUC26 — foto do alvo na série (telas), contra o backend REAL do ambiente de teste (porta 8090): treino, série,
 * fotos, exclusão, limite da série e isolamento são do backend de verdade. `page.route` só injeta falhas (503, 429,
 * 401 de sessão, rede) e uma lista "velha" (foto já excluída em outro aparelho).
 * O visualizador no celular (390 px) está em foto-visualizador-mobile.spec.ts.
 */
const GHOST = "00000000-0000-4000-8000-0000000000ee"; // UUID válido de uma foto que não existe

const photoThumbs = (page: Page) => page.getByRole("img", { name: "Foto do alvo da série 1" });

test.describe("Foto do alvo (FUC26) — série existente", () => {
  test("anexa JPEG e PNG: a imagem é reduzida no navegador (≤ 2000 px), enviada como JPEG e a contagem e as miniaturas atualizam", async ({ page }) => {
    const { seriesIds, token } = await setup(page);
    const watch = await watchUploads(page);
    await page.goto("/treinos/visitas");
    await expect(cameraButton(page)).toBeVisible();
    await expect(page.getByTestId("photo-count-1")).toHaveText("0");

    const grande = await makeImage(page, 4000, 3000, "image/jpeg");
    await cameraButton(page).click();
    await expect(page.getByRole("button", { name: "Tirar foto" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Escolher da galeria" })).toBeVisible();
    await gallery(page).setInputFiles({ name: "alvo.jpg", mimeType: "image/jpeg", buffer: grande });

    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    await expect(photoThumbs(page)).toHaveCount(1);
    expect(watch.uploads).toHaveLength(1);
    expect(watch.uploads[0]).toMatchObject({ seriesId: seriesIds[0], startsWithJpeg: true, uploadHeader: "1" });
    expect(watch.uploads[0].size).toBeLessThan(grande.length); // 4000x3000 virou 2000x1500
    // o que o backend guardou: 2000x1500 (a redução do navegador chegou inteira)
    const guardadas = await backendPhotos(token, seriesIds[0]);
    expect(guardadas).toHaveLength(1);
    expect([guardadas[0].widthPx, guardadas[0].heightPx]).toEqual([2000, 1500]);

    const png = await makeImage(page, 800, 600, "image/png");
    await gallery(page).setInputFiles({ name: "alvo.png", mimeType: "image/png", buffer: png });
    await expect(page.getByTestId("photo-count-1")).toHaveText("2");
    expect(watch.uploads[1].startsWithJpeg).toBe(true); // PNG também sobe como JPEG
    await expect(photoThumbs(page)).toHaveCount(2);
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(2);
  });

  test("a câmera usa capture=environment e a galeria não", async ({ page }) => {
    await setup(page);
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();
    await expect(page.getByTestId("photo-input-camera")).toHaveAttribute("capture", "environment");
    await expect(page.getByTestId("photo-input-camera")).toHaveAttribute("accept", "image/*");
    await expect(gallery(page)).not.toHaveAttribute("capture", /.*/);
  });

  test("treino encerrado também aceita foto", async ({ page }) => {
    const { token, seriesIds } = await setup(page, { closed: true });
    await page.goto("/treinos/visitas");
    await page.getByRole("button", { name: "Séries" }).click();
    await cameraButton(page).click();
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 400, 300, "image/jpeg") });
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(1);
  });

  test("com fotos já salvas, a contagem e as miniaturas vêm do carregamento da lista (até 5)", async ({ page }) => {
    const { token, seriesIds } = await setup(page, { series: 2 });
    await seedPhotos(page, token, seriesIds[0], 3);
    await page.goto("/treinos/visitas");
    await expect(page.getByTestId("photo-count-1")).toHaveText("3");
    await expect(photoThumbs(page)).toHaveCount(3);
    await expect(page.getByTestId("photo-count-2")).toHaveText("0");
  });

  test("limite do plano (5 no Gratuito): '5 de 5 fotos nesta série', botões desabilitados e explicação", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 5);
    await page.goto("/treinos/visitas");
    await expect(page.getByTestId("photo-count-1")).toHaveText("5");
    await cameraButton(page).click();
    await expect(page.getByTestId("photo-limit-1")).toHaveText("5 de 5 fotos nesta série");
    await expect(page.getByText("Você atingiu o limite de 5 fotos por série do seu plano. Exclua uma foto para enviar outra.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tirar foto" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Escolher da galeria" })).toBeDisabled();
    await expect(photoThumbs(page)).toHaveCount(5);
  });

  test("limite atingido em outro aparelho: o backend recusa (409 real), a mensagem aparece e a lista é recarregada", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();
    await seedPhotos(page, token, seriesIds[0], 5); // outro aparelho anexou 5 enquanto esta tela estava aberta
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("alert").filter({ hasText: "Você atingiu o limite de fotos por série do seu plano. Exclua uma foto para enviar outra." })).toBeVisible();
    await expect(page.getByTestId("photo-count-1")).toHaveText("5");
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(5);
  });

  test("arquivo que não é imagem: erro claro no navegador e nada é enviado; formato recusado pelo backend também tem mensagem", async ({ page }) => {
    await setup(page);
    const watch = await watchUploads(page);
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();

    await gallery(page).setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("não sou uma foto") });
    await expect(page.getByRole("alert").filter({ hasText: "não é uma imagem" })).toBeVisible();
    expect(watch.uploads).toHaveLength(0);

    // imagem corrompida (ou HEIC que o navegador não abre)
    await gallery(page).setInputFiles({ name: "quebrada.jpg", mimeType: "image/jpeg", buffer: Buffer.from([1, 2, 3, 4, 5]) });
    await expect(page.getByRole("alert").filter({ hasText: "Não consegui abrir essa foto" })).toBeVisible();
    expect(watch.uploads).toHaveLength(0);

    // o backend recusa o tipo (ex.: política mudou): injetado, a mensagem usa o texto do backend ("JPEG ou PNG")
    watch.fail = { status: 415, code: "PHOTO_UNSUPPORTED_TYPE", times: 1 };
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("alert").filter({ hasText: "Formato não aceito. Use uma foto JPEG ou PNG." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toHaveCount(0); // não adianta repetir a mesma foto
  });

  test("falha de rede/servidor no envio: mensagem com 'Tentar de novo', que reenvia a mesma foto (503 injetado, depois backend real)", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    const watch = await watchUploads(page);
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();
    watch.fail = { status: 503, code: "SERVICE_UNAVAILABLE", times: 1 };
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("alert").filter({ hasText: "Não foi possível enviar a foto" })).toBeVisible();
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    expect(watch.uploads).toHaveLength(2);
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(1);
  });

  test("PHOTO_PROCESSING_BUSY (503): mensagem própria em português e 'Tentar de novo'", async ({ page }) => {
    await setup(page);
    const watch = await watchUploads(page);
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();
    watch.fail = { status: 503, code: "PHOTO_PROCESSING_BUSY", times: 1 };
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("alert").filter({ hasText: "O servidor está processando outras fotos. Tente de novo em instantes." })).toBeVisible();
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
  });

  test("429 (limite de envios): mensagem de espera e 'Tentar de novo'", async ({ page }) => {
    await setup(page);
    const watch = await watchUploads(page);
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();
    watch.fail = { status: 429, code: "TOO_MANY_REQUESTS", times: 1 };
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("alert").filter({ hasText: "Muitos envios em pouco tempo. Aguarde um pouco e tente de novo." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
  });

  test("cancelar o envio em andamento: nada é anexado e os botões voltam", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/api\/series\/[^/]+\/photos$/, async (route) => {
      if (route.request().method() === "POST") await hold; // envio "travado" no navegador
      await route.fallback();
    });
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("progressbar")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tirar foto" })).toBeVisible();
    release();
    await expect(page.getByTestId("photo-count-1")).toHaveText("0");
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(0);
  });
});

test.describe("Foto do alvo (FUC26) — registro rápido", () => {
  async function openNewSeriesForm(page: Page) {
    await page.goto("/treinos/visitas");
    await expect(page.getByRole("button", { name: "Séries" })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Registrar série", exact: true }).click();
  }

  test("a foto fica no aparelho (nada é enviado antes) e sobe logo depois de a série ser salva", async ({ page }) => {
    await setup(page, { series: 0 });
    const watch = await watchUploads(page);
    await openNewSeriesForm(page);

    await page.getByRole("button", { name: "Foto do alvo" }).click();
    await gallery(page).setInputFiles({ name: "alvo.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 3000, 2000, "image/jpeg") });
    await expect(page.getByRole("img", { name: "Foto do alvo escolhida" })).toBeVisible();
    expect(watch.uploads).toHaveLength(0); // ainda só em memória

    await page.getByRole("button", { name: "Salvar série" }).click();
    await expect(page.getByRole("button", { name: /^Série 1/ })).toBeVisible();
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    await expect(photoThumbs(page)).toHaveCount(1);
    expect(watch.uploads).toHaveLength(1);
    expect(watch.uploads[0].startsWithJpeg).toBe(true);
  });

  test("é possível tirar a foto escolhida antes de salvar: a série salva sem foto", async ({ page }) => {
    await setup(page, { series: 0 });
    const watch = await watchUploads(page);
    await openNewSeriesForm(page);
    await page.getByRole("button", { name: "Foto do alvo" }).click();
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await page.getByRole("button", { name: "Remover foto" }).click();
    await expect(page.getByRole("img", { name: "Foto do alvo escolhida" })).toHaveCount(0);
    await page.getByRole("button", { name: "Salvar série" }).click();
    await expect(page.getByRole("button", { name: /^Série 1/ })).toBeVisible();
    await expect(page.getByTestId("photo-count-1")).toHaveText("0");
    expect(watch.uploads).toHaveLength(0);
  });

  test("falha no envio: a série continua salva e aparece 'Série salva. A foto não foi enviada'; 'tentar de novo' reenvia (backend real)", async ({ page }) => {
    await setup(page, { series: 0 });
    const watch = await watchUploads(page);
    watch.fail = { status: 503, code: "SERVICE_UNAVAILABLE", times: 1 };
    await openNewSeriesForm(page);
    await page.getByRole("button", { name: "Foto do alvo" }).click();
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 600, 400, "image/jpeg") });
    await page.getByRole("button", { name: "Salvar série" }).click();

    await expect(page.getByRole("button", { name: /^Série 1/ })).toBeVisible(); // a série ficou
    await expect(page.getByRole("alert").filter({ hasText: "Série salva. A foto não foi enviada" })).toBeVisible();
    await expect(page.getByTestId("photo-count-1")).toHaveText("0");

    await page.getByRole("button", { name: "tentar de novo" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "A foto não foi enviada" })).toHaveCount(0);
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    expect(watch.uploads).toHaveLength(2);

    // recarregar não duplica a série nem perde a foto; e a foto está guardada no backend
    await page.reload();
    await expect(page.getByRole("button", { name: /^Série \d/ })).toHaveCount(1);
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
  });

  test("foto com tipo inválido no registro rápido: erro inline e a série salva normalmente sem foto", async ({ page }) => {
    await setup(page, { series: 0 });
    const watch = await watchUploads(page);
    await openNewSeriesForm(page);
    await page.getByRole("button", { name: "Foto do alvo" }).click();
    await gallery(page).setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await expect(page.getByRole("alert").filter({ hasText: "não é uma imagem" })).toBeVisible();
    await page.getByRole("button", { name: "Salvar série" }).click();
    await expect(page.getByRole("button", { name: /^Série 1/ })).toBeVisible();
    expect(watch.uploads).toHaveLength(0);
  });
});

test.describe("Foto do alvo (FUC26) — visualizador e exclusão", () => {
  test("abre em tela cheia com foco no fechar, navega entre fotos, e Esc fecha devolvendo o foco", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 3);
    await page.goto("/treinos/visitas");

    const thumb = page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first();
    await thumb.focus();
    await thumb.press("Enter");
    const viewer = page.getByRole("dialog", { name: /Foto do alvo da série 1, foto 1 de 3/ });
    await expect(viewer).toBeVisible();
    const photoDialog = page.getByRole("dialog", { name: /^Foto do alvo da série 1, foto/ }); // o nome muda a cada foto
    await expect(viewer.getByRole("img", { name: "Foto do alvo da série 1" })).toBeVisible();
    await expect(viewer.getByRole("button", { name: "Fechar" })).toBeFocused();
    await expect(viewer.getByRole("button", { name: "Foto anterior" })).toBeDisabled();

    await viewer.getByRole("button", { name: "Próxima foto" }).click();
    await expect(photoDialog.getByText("Foto 2 de 3")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(photoDialog.getByText("Foto 3 de 3")).toBeVisible();
    await expect(photoDialog.getByRole("button", { name: "Próxima foto" })).toBeDisabled();
    await page.keyboard.press("ArrowLeft");
    await expect(photoDialog.getByText("Foto 2 de 3")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(photoDialog).toHaveCount(0);
    await expect(thumb).toBeFocused();
  });

  test("duplo toque amplia e desfaz; deslizar para o lado troca de foto (mouse)", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 2);
    await page.goto("/treinos/visitas");
    await page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first().click();
    const viewer = page.getByRole("dialog");
    const stage = viewer.getByTestId("photo-stage");
    const image = viewer.getByRole("img", { name: "Foto do alvo da série 1" });
    await expect(image).toHaveAttribute("data-scale", "1");

    await stage.dblclick();
    await expect(image).toHaveAttribute("data-scale", "2.5");
    await stage.dblclick();
    await expect(image).toHaveAttribute("data-scale", "1");

    const box = (await stage.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, y, { steps: 6 });
    await page.mouse.up();
    await expect(viewer.getByText("Foto 2 de 2")).toBeVisible();
  });

  test("excluir pede confirmação: cancelar mantém; confirmar remove no backend, atualiza contagem e miniaturas", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 2);
    await page.goto("/treinos/visitas");
    await expect(page.getByTestId("photo-count-1")).toHaveText("2");
    await page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first().click();
    const viewer = page.getByRole("dialog", { name: /foto 1 de 2/ });

    await viewer.getByRole("button", { name: "Excluir foto" }).click();
    const confirm = page.getByRole("dialog", { name: "Excluir foto" });
    await expect(confirm.getByText("Esta foto será removida definitivamente")).toBeVisible();
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm).toHaveCount(0);
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(2);
    await expect(page.getByTestId("photo-count-1")).toHaveText("2");

    await viewer.getByRole("button", { name: "Excluir foto" }).click();
    await page.getByRole("dialog", { name: "Excluir foto" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(1);
    await expect(page.getByRole("dialog", { name: /foto 1 de 1/ })).toBeVisible(); // segue para a que restou

    await page.getByRole("dialog", { name: /foto 1 de 1/ }).getByRole("button", { name: "Excluir foto" }).click();
    await page.getByRole("dialog", { name: "Excluir foto" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByTestId("photo-count-1")).toHaveText("0");
    await expect(page.getByRole("dialog")).toHaveCount(0); // sem fotos, o visualizador fecha
    await expect(photoThumbs(page)).toHaveCount(0);
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(0);
  });

  test("falha ao carregar a imagem grande (rede/servidor) mostra erro com 'Tentar de novo'", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 1);
    let falhar = true;
    await page.route(/\/photos\/[^/]+\/content/, (route) => (falhar ? route.fulfill({ status: 502, json: { error: { code: "PHOTO_LOAD_FAILED", message: "x" } } }) : route.fallback()));
    await page.goto("/treinos/visitas");
    await page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first().click();
    await expect(page.getByRole("alert").filter({ hasText: "Não foi possível carregar a foto" })).toBeVisible();
    falhar = false;
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByRole("dialog").getByRole("img", { name: "Foto do alvo da série 1" })).toBeVisible();
  });

  test("áreas de toque de pelo menos 44 px nos controles de foto (inclui confirmar e cancelar)", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 1);
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();
    for (const locator of [cameraButton(page), page.getByRole("button", { name: "Tirar foto" }), page.getByRole("button", { name: "Escolher da galeria" }), page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first()]) {
      const box = (await locator.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first().click();
    for (const name of ["Fechar", "Excluir foto", "Foto anterior", "Próxima foto"]) {
      const box = (await page.getByRole("dialog").getByRole("button", { name }).boundingBox())!;
      expect(box.width, name).toBeGreaterThanOrEqual(44);
      expect(box.height, name).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("dialog").getByRole("button", { name: "Excluir foto" }).click();
    for (const name of ["Confirmar", "Cancelar"]) {
      const box = (await page.getByRole("dialog", { name: "Excluir foto" }).getByRole("button", { name }).boundingBox())!;
      expect(box.height, name).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("Foto do alvo (FUC26) — foto inexistente (404) e sessão nas imagens", () => {
  /**
   * A lista vem "velha": traz também uma foto que já não existe (excluída em outro aparelho). Ela continua velha até
   * o servidor confirmar o 404 da foto (aí a lista volta ao normal), então não depende de qual leitura chega primeiro.
   * `thumbnailStub`: a miniatura da fantasma "carrega" (como se estivesse em cache), para dar para abri-la no visualizador.
   */
  async function staleListWithGhost(page: Page, thumbnailStub?: Buffer) {
    let stale = true;
    await page.route(/\/api\/series\/[^/]+\/photos$/, async (route) => {
      if (route.request().method() !== "GET" || !stale) return route.fallback();
      const response = await route.fetch();
      const json = await response.json();
      json.data.push({ id: GHOST, position: json.data.length + 1, widthPx: 100, heightPx: 80, sizeBytes: 1000, createdAt: new Date().toISOString() });
      return route.fulfill({ response, json });
    });
    await page.route(new RegExp(`/photos/${GHOST}/(content|thumbnail)`), async (route) => {
      if (thumbnailStub && route.request().url().includes("/thumbnail")) {
        return route.fulfill({ status: 200, contentType: "image/jpeg", body: thumbnailStub });
      }
      const response = await route.fetch(); // 404 real do backend
      stale = false;
      return route.fulfill({ response });
    });
  }

  function watchSessionFlow(page: Page) {
    const refreshCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/auth/refresh")) refreshCalls.push(request.url());
    });
    return refreshCalls;
  }

  test("miniatura de foto inexistente: o backend real responde 404, a miniatura sai da lista com 'Foto não encontrada.', sem renovar sessão nem sair da tela", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 2);
    const refreshCalls = watchSessionFlow(page);
    await staleListWithGhost(page);
    await page.goto("/treinos/visitas");

    await expect(page.getByRole("alert").filter({ hasText: "Foto não encontrada." })).toBeVisible();
    await expect(photoThumbs(page)).toHaveCount(2); // a fantasma saiu; as reais ficaram
    await expect(page.getByTestId("photo-count-1")).toHaveText("2");
    await expect(page.getByRole("button", { name: /Tentar de novo carregar a miniatura/ })).toHaveCount(0); // 404 não tem "tentar de novo"
    expect(refreshCalls).toEqual([]); // 404 de foto não dispara o fluxo de sessão
    await expect(page).toHaveURL(/\/treinos\/visitas/);
  });

  test("visualizador: a foto grande vem 404 → mensagem no visualizador, a foto sai da lista e ele segue para a vizinha", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 2);
    const jpeg = await makeImage(page, 120, 90, "image/jpeg");
    const refreshCalls = watchSessionFlow(page);
    await staleListWithGhost(page, jpeg); // a foto grande da fantasma é o 404 real
    await page.goto("/treinos/visitas");
    await expect(photoThumbs(page)).toHaveCount(3);

    await page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).nth(2).click();
    const viewer = page.getByRole("dialog");
    await expect(viewer.getByRole("alert").filter({ hasText: "Foto não encontrada." })).toBeVisible();
    await expect(viewer.getByText("Foto 2 de 2")).toBeVisible(); // seguiu para a vizinha; a fantasma saiu
    await expect(viewer.getByRole("button", { name: "Tentar de novo" })).toHaveCount(0);
    await expect(page.getByTestId("photo-count-1")).toHaveText("2");
    expect(refreshCalls).toEqual([]);
    await expect(page).toHaveURL(/\/treinos\/visitas/);
  });

  test("401 de sessão numa imagem: renova a sessão uma única vez e a miniatura aparece", async ({ page }) => {
    const { token, seriesIds } = await setup(page);
    await seedPhotos(page, token, seriesIds[0], 1);
    const refreshCalls = watchSessionFlow(page);
    let hits = 0;
    // a imagem e a sondagem recebem 401 de sessão; a repetição depois da renovação vai ao backend real
    await page.route(/\/photos\/[^/]+\/thumbnail/, (route) =>
      hits++ < 2 ? route.fulfill({ status: 401, json: { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } } }) : route.fallback()
    );
    await page.goto("/treinos/visitas");
    const thumb = photoThumbs(page);
    await expect(thumb).toHaveCount(1);
    await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(refreshCalls).toHaveLength(1);
    await expect(page).toHaveURL(/\/treinos\/visitas/);
  });
});

test.describe("Foto do alvo (FUC26) — isolamento via BFF (backend real)", () => {
  test("atleta B recebe 404 exato em lista, imagem, miniatura, exclusão e envio de uma série/foto do atleta A", async ({ page, playwright, baseURL }) => {
    const { seriesIds, token } = await setup(page);
    const [foto] = await seedPhotos(page, token, seriesIds[0], 1);

    const emailB = randomEmail();
    await createUser(emailB);
    const b = await playwright.request.newContext({ baseURL });
    expect((await b.post("/api/auth/login", { data: { email: emailB, password: "senha12345" } })).status()).toBe(200);

    for (const path of [`/api/series/${seriesIds[0]}/photos`, `/api/series/${seriesIds[0]}/photos/${foto.id}/content`, `/api/series/${seriesIds[0]}/photos/${foto.id}/thumbnail`]) {
      const response = await b.get(path);
      expect(response.status(), path).toBe(404); // exatamente 404: nem 401 (sessão) nem 403
      expect(response.headers()["content-type"] ?? "", path).not.toContain("image/");
      expect(response.headers()["cache-control"] ?? "", path).toContain("no-store");
      expect((await response.json()).error.code, path).toMatch(/^(SERIES_NOT_FOUND|PHOTO_NOT_FOUND)$/);
    }
    expect((await b.delete(`/api/series/${seriesIds[0]}/photos/${foto.id}`)).status()).toBe(404);
    const envio = await b.post(`/api/series/${seriesIds[0]}/photos`, {
      headers: { "x-shottrack-upload": "1" },
      multipart: { file: { name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 100, 80, "image/jpeg") } },
    });
    expect(envio.status()).toBe(404);
    await b.dispose();

    // a foto do atleta A segue intacta
    expect(await backendPhotos(token, seriesIds[0])).toHaveLength(1);
  });

  test("o dono pedindo uma foto que não existe recebe 404 (e não 401 de sessão) nas duas imagens", async ({ page, playwright, baseURL }) => {
    const { seriesIds, token } = await setup(page);
    const [foto] = await seedPhotos(page, token, seriesIds[0], 1);
    await backendDelete(token, seriesIds[0], foto.id);

    // mesma sessão do atleta da tela: usa os cookies do navegador
    const dono = await playwright.request.newContext({ baseURL, storageState: await page.context().storageState() });
    for (const kind of ["content", "thumbnail"]) {
      const response = await dono.get(`/api/series/${seriesIds[0]}/photos/${foto.id}/${kind}`);
      expect(response.status(), kind).toBe(404);
      expect((await response.json()).error.code, kind).toBe("PHOTO_NOT_FOUND");
    }
    await dono.dispose();
  });
});
