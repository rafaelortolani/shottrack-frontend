import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import {
  addPracticedModality,
  closeTraining,
  createUser,
  getModalityCatalog,
  loginAndGetToken,
  openTraining,
  randomEmail,
  registerSeries,
  registerTrainingLocation,
  startVisit,
} from "./helpers";

/**
 * FUC26 — foto do alvo na série (telas). O backend ainda NÃO implementa as rotas de foto (só os UC60–62), então
 * `/api/series/{id}/photos...` é simulado no navegador (`page.route`) com um armazenamento em memória; treino,
 * série e login são reais. O que roda de verdade aqui: redução no navegador, envio multipart, telas, visualizador.
 * O que o simulador NÃO prova: o BFF repassando ao backend real (coberto por foto-bff.spec.ts com backend simulado)
 * e o isolamento entre atletas, que é regra do backend.
 */
type FakePhoto = { id: string; position: number; widthPx: number; heightPx: number; sizeBytes: number; createdAt: string };
type Upload = { seriesId: string; size: number; startsWithJpeg: boolean; uploadHeader: string | undefined };

class FakePhotoBackend {
  photos = new Map<string, FakePhoto[]>();
  uploads: Upload[] = [];
  /** Próximos envios falham com este erro (null = normal). */
  failUploads: { status: number; code: string; times: number } | null = null;
  deletes: string[] = [];
  private jpeg: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private counter = 0;

  list(seriesId: string) {
    return this.photos.get(seriesId) ?? [];
  }

  seed(seriesId: string, count: number) {
    for (let i = 0; i < count; i++) this.add(seriesId);
  }

  private add(seriesId: string, size = 1000) {
    const list = this.list(seriesId);
    const photo = { id: `00000000-0000-4000-8000-${String(++this.counter).padStart(12, "0")}`, position: list.length + 1, widthPx: 100, heightPx: 80, sizeBytes: size, createdAt: new Date().toISOString() };
    this.photos.set(seriesId, [...list, photo]);
    return photo;
  }

  async install(page: BrowserContext) {
    // JPEG real para miniaturas e fotos grandes (gerado por uma aba descartável, no navegador)
    const probe = await page.newPage();
    this.jpeg = await makeImage(probe, 120, 90, "image/jpeg");
    await probe.close();

    await page.route("**/api/trainings/*/series", async (route) => {
      const response = await route.fetch();
      if (route.request().method() !== "GET" || !response.ok()) return route.fulfill({ response });
      const json = await response.json();
      json.data = json.data.map((s: { id: string }) => ({ ...s, photoCount: this.list(s.id).length }));
      return route.fulfill({ response, json });
    });

    await page.route(/\/api\/series\/[^/]+\/photos$/, (route) => this.collection(route));
    await page.route(/\/api\/series\/[^/]+\/photos\/[^/]+\/(content|thumbnail)(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: "image/jpeg", headers: { "cache-control": "private, no-store" }, body: Buffer.from(this.jpeg) })
    );
    await page.route(/\/api\/series\/[^/]+\/photos\/[^/]+$/, (route) => this.item(route));
  }

  private async collection(route: Route) {
    const request = route.request();
    const seriesId = request.url().match(/\/series\/([^/]+)\/photos/)![1];
    if (request.method() === "GET") return route.fulfill({ json: { data: this.list(seriesId) } });

    const body = request.postDataBuffer() ?? Buffer.alloc(0);
    const start = body.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
    this.uploads.push({ seriesId, size: body.length, startsWithJpeg: start > 0, uploadHeader: request.headers()["x-shottrack-upload"] });

    if (this.failUploads && this.failUploads.times > 0) {
      this.failUploads.times--;
      const { status, code } = this.failUploads;
      return route.fulfill({ status, json: { error: { code, message: "erro simulado" } } });
    }
    if (this.list(seriesId).length >= 5) {
      return route.fulfill({ status: 409, json: { error: { code: "PHOTO_LIMIT_PER_SERIES_REACHED", message: "limite" } } });
    }
    if (start < 0) {
      return route.fulfill({ status: 415, json: { error: { code: "PHOTO_UNSUPPORTED_TYPE", message: "tipo" } } });
    }
    return route.fulfill({ status: 201, json: { data: this.add(seriesId, body.length) } });
  }

  private async item(route: Route) {
    const [, seriesId, photoId] = route.request().url().match(/\/series\/([^/]+)\/photos\/([^/]+)$/)!;
    this.deletes.push(photoId);
    this.photos.set(seriesId, this.list(seriesId).filter((p) => p.id !== photoId).map((p, i) => ({ ...p, position: i + 1 })));
    return route.fulfill({ json: { ok: true } });
  }
}

/** Imagem de teste gerada no navegador (canvas), no formato pedido. */
async function makeImage(page: Page, width: number, height: number, type: "image/jpeg" | "image/png"): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ([w, h, t]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w as number;
      canvas.height = h as number;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#c33";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, canvas.height / 3, 0, Math.PI * 2);
      ctx.fill();
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), t as string, 0.9));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      return btoa(binary);
    },
    [width, height, type] as const
  );
  return Buffer.from(base64, "base64");
}

async function setup(page: Page, options: { series?: number; closed?: boolean } = {}) {
  const email = randomEmail();
  await createUser(email);
  const token = await loginAndGetToken(email);
  const location = await registerTrainingLocation(token, { name: "Clube de Tiro Alvorada", city: "Curitiba", state: "PR" });
  const [modality] = await getModalityCatalog(token);
  await addPracticedModality(token, modality.id);
  const visit = await startVisit(token, location.id);
  const training = await openTraining(token, visit.id, modality.id);
  const seriesIds: string[] = [];
  for (let i = 0; i < (options.series ?? 1); i++) seriesIds.push((await registerSeries(token, { trainingId: training.id })).id);
  if (options.closed) await closeTraining(token, training.id);

  const fake = new FakePhotoBackend();
  await fake.install(page.context());

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/treinos\/visitas/);
  return { fake, seriesIds, token, email };
}

const cameraButton = (page: Page, n = 1) => page.getByRole("button", { name: new RegExp(`^Fotos do alvo da série ${n}:`) });
const gallery = (page: Page) => page.getByTestId("photo-input-gallery");

test.describe("Foto do alvo (FUC26) — série existente", () => {
  test("anexa JPEG e PNG: a imagem é reduzida no navegador (≤ 2000 px), enviada como JPEG e a contagem e as miniaturas atualizam", async ({ page }) => {
    const { fake, seriesIds } = await setup(page);
    await page.goto("/treinos/visitas");
    await expect(cameraButton(page)).toBeVisible();
    await expect(page.getByTestId("photo-count-1")).toHaveText("0");

    const grande = await makeImage(page, 4000, 3000, "image/jpeg");
    await cameraButton(page).click();
    await expect(page.getByRole("button", { name: "Tirar foto" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Escolher da galeria" })).toBeVisible();
    await gallery(page).setInputFiles({ name: "alvo.jpg", mimeType: "image/jpeg", buffer: grande });

    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    await expect(page.getByRole("img", { name: "Foto do alvo da série 1" })).toHaveCount(1);
    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0]).toMatchObject({ seriesId: seriesIds[0], startsWithJpeg: true, uploadHeader: "1" });
    expect(fake.uploads[0].size).toBeLessThan(grande.length); // 4000x3000 virou 2000x1500

    const png = await makeImage(page, 800, 600, "image/png");
    await gallery(page).setInputFiles({ name: "alvo.png", mimeType: "image/png", buffer: png });
    await expect(page.getByTestId("photo-count-1")).toHaveText("2");
    expect(fake.uploads[1].startsWithJpeg).toBe(true); // PNG também sobe como JPEG
    await expect(page.getByRole("img", { name: "Foto do alvo da série 1" })).toHaveCount(2);
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
    const { fake } = await setup(page, { closed: true });
    await page.goto("/treinos/visitas");
    await page.getByRole("button", { name: "Séries" }).click();
    await cameraButton(page).click();
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 400, 300, "image/jpeg") });
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    expect(fake.uploads).toHaveLength(1);
  });

  test("com fotos já salvas, a contagem e as miniaturas vêm do carregamento da lista (até 5)", async ({ page }) => {
    const { fake, seriesIds } = await setup(page, { series: 2 });
    fake.seed(seriesIds[0], 3);
    await page.goto("/treinos/visitas");
    await expect(page.getByTestId("photo-count-1")).toHaveText("3");
    await expect(page.getByRole("img", { name: "Foto do alvo da série 1" })).toHaveCount(3);
    await expect(page.getByTestId("photo-count-2")).toHaveText("0");
  });

  test("limite de 5: os botões somem e aparece 'Limite de 5 fotos por série'; a recusa do backend também vira mensagem", async ({ page }) => {
    const { fake, seriesIds } = await setup(page);
    fake.seed(seriesIds[0], 5);
    await page.goto("/treinos/visitas");
    await expect(page.getByTestId("photo-count-1")).toHaveText("5");
    await cameraButton(page).click();
    await expect(page.getByText("Limite de 5 fotos por série")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tirar foto" })).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Foto do alvo da série 1" })).toHaveCount(5);
  });

  test("limite atingido em outro aparelho: o envio é recusado, a mensagem aparece e a lista é recarregada", async ({ page }) => {
    const { fake, seriesIds } = await setup(page);
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();
    fake.seed(seriesIds[0], 5); // outro aparelho anexou 5 enquanto esta tela estava aberta
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("alert").filter({ hasText: "Limite de 5 fotos por série." })).toBeVisible();
    await expect(page.getByTestId("photo-count-1")).toHaveText("5");
  });

  test("arquivo que não é imagem: erro claro no navegador e nada é enviado; formato recusado pelo backend também tem mensagem", async ({ page }) => {
    const { fake } = await setup(page);
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();

    await gallery(page).setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("não sou uma foto") });
    await expect(page.getByRole("alert").filter({ hasText: "não é uma imagem" })).toBeVisible();
    expect(fake.uploads).toHaveLength(0);

    // imagem corrompida (ou HEIC que o navegador não abre)
    await gallery(page).setInputFiles({ name: "quebrada.jpg", mimeType: "image/jpeg", buffer: Buffer.from([1, 2, 3, 4, 5]) });
    await expect(page.getByRole("alert").filter({ hasText: "Não consegui abrir essa foto" })).toBeVisible();
    expect(fake.uploads).toHaveLength(0);

    // o backend recusa o tipo (ex.: política mudou): mensagem na linguagem do atleta
    fake.failUploads = { status: 415, code: "PHOTO_UNSUPPORTED_TYPE", times: 1 };
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("alert").filter({ hasText: "Formato não aceito" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toHaveCount(0); // não adianta repetir a mesma foto
  });

  test("falha de rede no envio: mensagem com 'Tentar de novo', que reenvia a mesma foto", async ({ page }) => {
    const { fake } = await setup(page);
    await page.goto("/treinos/visitas");
    await cameraButton(page).click();
    fake.failUploads = { status: 503, code: "SERVICE_UNAVAILABLE", times: 1 };
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await expect(page.getByRole("alert").filter({ hasText: "Não foi possível enviar a foto" })).toBeVisible();
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    expect(fake.uploads).toHaveLength(2);
  });

  test("cancelar o envio em andamento: nada é anexado e os botões voltam", async ({ page }) => {
    const { fake } = await setup(page);
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/api\/series\/[^/]+\/photos$/, async (route) => {
      if (route.request().method() === "POST") await hold; // envio "travado"
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
    expect(fake.photos.size).toBe(0);
    await expect(page.getByTestId("photo-count-1")).toHaveText("0");
  });
});

test.describe("Foto do alvo (FUC26) — registro rápido", () => {
  async function openNewSeriesForm(page: Page) {
    await page.goto("/treinos/visitas");
    await expect(page.getByRole("button", { name: "Séries" })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Registrar série", exact: true }).click();
  }

  test("a foto fica no aparelho (nada é enviado antes) e sobe logo depois de a série ser salva", async ({ page }) => {
    const { fake } = await setup(page, { series: 0 });
    await openNewSeriesForm(page);

    await page.getByRole("button", { name: "Foto do alvo" }).click();
    await gallery(page).setInputFiles({ name: "alvo.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 3000, 2000, "image/jpeg") });
    await expect(page.getByRole("img", { name: "Foto do alvo escolhida" })).toBeVisible();
    expect(fake.uploads).toHaveLength(0); // ainda só em memória

    await page.getByRole("button", { name: "Salvar série" }).click();
    await expect(page.getByRole("button", { name: /^Série 1/ })).toBeVisible();
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    await expect(page.getByRole("img", { name: "Foto do alvo da série 1" })).toHaveCount(1);
    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0].startsWithJpeg).toBe(true);
  });

  test("é possível tirar a foto escolhida antes de salvar: a série salva sem foto", async ({ page }) => {
    const { fake } = await setup(page, { series: 0 });
    await openNewSeriesForm(page);
    await page.getByRole("button", { name: "Foto do alvo" }).click();
    await gallery(page).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await makeImage(page, 300, 200, "image/jpeg") });
    await page.getByRole("button", { name: "Remover foto" }).click();
    await expect(page.getByRole("img", { name: "Foto do alvo escolhida" })).toHaveCount(0);
    await page.getByRole("button", { name: "Salvar série" }).click();
    await expect(page.getByRole("button", { name: /^Série 1/ })).toBeVisible();
    await expect(page.getByTestId("photo-count-1")).toHaveText("0");
    expect(fake.uploads).toHaveLength(0);
  });

  test("falha no envio: a série continua salva e aparece 'Série salva. A foto não foi enviada'; 'tentar de novo' reenvia", async ({ page }) => {
    const { fake } = await setup(page, { series: 0 });
    fake.failUploads = { status: 503, code: "SERVICE_UNAVAILABLE", times: 1 };
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
    expect(fake.uploads).toHaveLength(2);

    // recarregar não duplica a série nem perde a foto
    await page.reload();
    await expect(page.getByRole("button", { name: /^Série \d/ })).toHaveCount(1);
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
  });

  test("foto com tipo inválido no registro rápido: erro inline e a série salva normalmente sem foto", async ({ page }) => {
    const { fake } = await setup(page, { series: 0 });
    await openNewSeriesForm(page);
    await page.getByRole("button", { name: "Foto do alvo" }).click();
    await gallery(page).setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await expect(page.getByRole("alert").filter({ hasText: "não é uma imagem" })).toBeVisible();
    await page.getByRole("button", { name: "Salvar série" }).click();
    await expect(page.getByRole("button", { name: /^Série 1/ })).toBeVisible();
    expect(fake.uploads).toHaveLength(0);
  });
});

test.describe("Foto do alvo (FUC26) — visualizador e exclusão", () => {
  test("abre em tela cheia com foco no fechar, navega entre fotos, e Esc fecha devolvendo o foco", async ({ page }) => {
    const { fake, seriesIds } = await setup(page);
    fake.seed(seriesIds[0], 3);
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

  test("duplo toque amplia e desfaz; deslizar para o lado troca de foto (mouse e toque)", async ({ page }) => {
    const { fake, seriesIds } = await setup(page);
    fake.seed(seriesIds[0], 2);
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

  test("excluir pede confirmação: cancelar mantém; confirmar remove, atualiza contagem e miniaturas", async ({ page }) => {
    const { fake, seriesIds } = await setup(page);
    fake.seed(seriesIds[0], 2);
    await page.goto("/treinos/visitas");
    await expect(page.getByTestId("photo-count-1")).toHaveText("2");
    await page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first().click();
    const viewer = page.getByRole("dialog", { name: /foto 1 de 2/ });

    await viewer.getByRole("button", { name: "Excluir foto" }).click();
    const confirm = page.getByRole("dialog", { name: "Excluir foto" });
    await expect(confirm.getByText("Esta foto será removida definitivamente")).toBeVisible();
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm).toHaveCount(0);
    expect(fake.deletes).toHaveLength(0);
    await expect(page.getByTestId("photo-count-1")).toHaveText("2");

    await viewer.getByRole("button", { name: "Excluir foto" }).click();
    await page.getByRole("dialog", { name: "Excluir foto" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByTestId("photo-count-1")).toHaveText("1");
    expect(fake.deletes).toHaveLength(1);
    await expect(page.getByRole("dialog", { name: /foto 1 de 1/ })).toBeVisible(); // segue para a que restou

    await page.getByRole("dialog", { name: /foto 1 de 1/ }).getByRole("button", { name: "Excluir foto" }).click();
    await page.getByRole("dialog", { name: "Excluir foto" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByTestId("photo-count-1")).toHaveText("0");
    await expect(page.getByRole("dialog")).toHaveCount(0); // sem fotos, o visualizador fecha
    await expect(page.getByRole("img", { name: "Foto do alvo da série 1" })).toHaveCount(0);
  });

  test("falha ao carregar a imagem grande mostra erro com 'Tentar de novo'", async ({ page }) => {
    const { fake, seriesIds } = await setup(page);
    fake.seed(seriesIds[0], 1);
    let falhar = true;
    await page.route(/\/photos\/[^/]+\/content/, (route) => (falhar ? route.fulfill({ status: 502, json: { error: { code: "PHOTO_LOAD_FAILED", message: "x" } } }) : route.fallback()));
    await page.goto("/treinos/visitas");
    await page.getByRole("button", { name: "Abrir foto do alvo da série 1" }).first().click();
    await expect(page.getByRole("alert").filter({ hasText: "Não foi possível carregar a foto" })).toBeVisible();
    falhar = false;
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByRole("dialog").getByRole("img", { name: "Foto do alvo da série 1" })).toBeVisible();
  });

  test("áreas de toque de pelo menos 44 px nos controles de foto", async ({ page }) => {
    const { fake, seriesIds } = await setup(page);
    fake.seed(seriesIds[0], 1);
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
  });
});

test.describe("Foto do alvo (FUC26) — isolamento via BFF (backend real)", () => {
  test("atleta B não abre lista, imagem nem miniatura de uma série do atleta A", async ({ page, playwright, baseURL }) => {
    const { seriesIds } = await setup(page);
    // sessão do atleta B, sem o simulador (rotas reais do BFF → backend)
    const emailB = randomEmail();
    await createUser(emailB);
    const b = await playwright.request.newContext({ baseURL });
    expect((await b.post("/api/auth/login", { data: { email: emailB, password: "senha12345" } })).status()).toBe(200);

    const fotoQualquer = "00000000-0000-4000-8000-0000000000aa";
    for (const path of [
      `/api/series/${seriesIds[0]}/photos`,
      `/api/series/${seriesIds[0]}/photos/${fotoQualquer}/content`,
      `/api/series/${seriesIds[0]}/photos/${fotoQualquer}/thumbnail`,
    ]) {
      const response = await b.get(path);
      expect([401, 403, 404], path).toContain(response.status());
      expect(response.headers()["content-type"] ?? "", path).not.toContain("image/");
      expect(response.headers()["cache-control"] ?? "", path).toContain("no-store");
    }
    const apagar = await b.delete(`/api/series/${seriesIds[0]}/photos/${fotoQualquer}`);
    expect([401, 403, 404]).toContain(apagar.status());
    await b.dispose();
  });
});
