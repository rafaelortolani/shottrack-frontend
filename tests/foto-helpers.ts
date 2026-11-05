import { expect, type Page } from "@playwright/test";
import {
  addPracticedModality,
  BACKEND_URL,
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
 * Apoio dos testes da foto do alvo (FUC26). Treino, série, fotos e login são REAIS (backend de teste, porta 8090).
 * O que é simulado no navegador (`page.route`) serve só para INJETAR falhas (503, 429, 401, rede) e para o estado
 * "velho" de uma lista; o armazenamento e as regras das fotos são do backend de verdade.
 */
export type PhotoMeta = { id: string; position: number; widthPx: number; heightPx: number; sizeBytes: number; createdAt: string };
export type Upload = { seriesId: string; size: number; startsWithJpeg: boolean; uploadHeader: string | undefined };

/** Imagem de teste gerada no navegador (canvas), no formato pedido. */
export async function makeImage(page: Page, width: number, height: number, type: "image/jpeg" | "image/png"): Promise<Buffer> {
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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Fotos da série direto no backend (o que de fato está guardado, sem passar pela tela). */
export async function backendPhotos(token: string, seriesId: string): Promise<PhotoMeta[]> {
  const response = await fetch(`${BACKEND_URL}/api/series/${seriesId}/photos`, { headers: auth(token) });
  expect(response.status).toBe(200);
  return (await response.json()).data;
}

export async function backendUpload(token: string, seriesId: string, jpeg: Buffer): Promise<PhotoMeta> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "alvo.jpg");
  const response = await fetch(`${BACKEND_URL}/api/series/${seriesId}/photos`, { method: "POST", headers: auth(token), body: form });
  expect(response.status).toBe(201);
  return (await response.json()).data;
}

export async function backendDelete(token: string, seriesId: string, photoId: string) {
  const response = await fetch(`${BACKEND_URL}/api/series/${seriesId}/photos/${photoId}`, { method: "DELETE", headers: auth(token) });
  expect(response.status).toBe(204);
}

/** Anexa `count` fotos reais à série, direto no backend. */
export async function seedPhotos(page: Page, token: string, seriesId: string, count: number): Promise<PhotoMeta[]> {
  const jpeg = await makeImage(page, 300, 200, "image/jpeg");
  const created: PhotoMeta[] = [];
  for (let i = 0; i < count; i++) created.push(await backendUpload(token, seriesId, jpeg));
  return created;
}

/**
 * Cria atleta, visita, treino e `series` séries (todos reais), entra pela tela de login e devolve token e ids.
 * `closed` encerra o treino depois de criar as séries.
 */
export async function setup(page: Page, options: { series?: number; closed?: boolean } = {}) {
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

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/treinos\/visitas/);
  return { seriesIds, token, email };
}

/**
 * Observa os envios (POST) da tela e, se pedido, faz os próximos falharem com o erro indicado, sem tocar o backend.
 * Os envios que não falham seguem para o BFF e o backend reais.
 */
export async function watchUploads(page: Page) {
  const state = {
    uploads: [] as Upload[],
    fail: null as { status: number; code: string; times: number } | null,
  };
  await page.route(/\/api\/series\/[^/]+\/photos$/, async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    const body = request.postDataBuffer() ?? Buffer.alloc(0);
    state.uploads.push({
      seriesId: request.url().match(/\/series\/([^/]+)\/photos/)![1],
      size: body.length,
      startsWithJpeg: body.indexOf(Buffer.from([0xff, 0xd8, 0xff])) > 0,
      uploadHeader: request.headers()["x-shottrack-upload"],
    });
    if (state.fail && state.fail.times > 0) {
      state.fail.times--;
      const { status, code } = state.fail;
      return route.fulfill({
        status,
        headers: status === 429 ? { "retry-after": "60" } : {},
        json: { error: { code, message: "erro simulado" } },
      });
    }
    return route.fallback();
  });
  return state;
}

export const cameraButton = (page: Page, n = 1) => page.getByRole("button", { name: new RegExp(`^Fotos do alvo da série ${n}:`) });
export const gallery = (page: Page) => page.getByTestId("photo-input-gallery");
