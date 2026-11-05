import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import ts from "typescript";
import { fitWithin } from "../src/lib/photoResize";
import { photoErrorMessage } from "../src/lib/photoUpload";

/**
 * FUC26 — redução da foto no navegador. `fitWithin` e as mensagens rodam no Node; `reducePhoto` precisa de
 * decodificador e canvas, então o MESMO arquivo (`src/lib/photoResize.ts`) é transpilado e executado dentro do Chromium.
 */
test.describe("FUC26 — redução da foto (unidade)", () => {
  test("fitWithin: lado maior limitado a 2000, proporção mantida, nunca amplia", () => {
    expect(fitWithin(4000, 1000)).toEqual({ width: 2000, height: 500 });
    expect(fitWithin(1000, 4000)).toEqual({ width: 500, height: 2000 });
    expect(fitWithin(4032, 3024)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(2000, 2000)).toEqual({ width: 2000, height: 2000 });
    expect(fitWithin(100000, 1)).toEqual({ width: 2000, height: 1 }); // nunca zero
  });

  test("mensagens de erro na linguagem do atleta, por código do backend", () => {
    expect(photoErrorMessage("PHOTO_LIMIT_PER_SERIES_REACHED", 409, "x")).toBe("Você atingiu o limite de fotos por série do seu plano. Exclua uma foto para enviar outra.");
    expect(photoErrorMessage("PHOTO_UNSUPPORTED_TYPE", 415, "x")).toBe("Formato não aceito. Use uma foto JPEG ou PNG.");
    expect(photoErrorMessage(null, 429, "x")).toContain("Aguarde");
    expect(photoErrorMessage("PHOTO_INVALID_IMAGE", 400, "x")).toBe("Não foi possível ler essa imagem. Escolha outra foto.");
    expect(photoErrorMessage("PHOTO_DIMENSIONS_TOO_LARGE", 400, "x")).toBe("A imagem tem resolução alta demais. Escolha outra foto.");
    expect(photoErrorMessage("PHOTO_TOO_LARGE", 413, "x")).toBe("A foto é grande demais (máximo de 10 MB). Escolha outra ou tire de novo.");
    expect(photoErrorMessage("PHOTO_STORAGE_LIMIT_REACHED", 409, "x")).toBe("Você atingiu o espaço do seu plano. Exclua fotos antigas para enviar novas.");
    expect(photoErrorMessage("PHOTO_LIMIT_PER_ATHLETE_REACHED", 409, "x")).toBe("Você chegou ao limite de fotos da conta. Exclua alguma para enviar outra.");
    expect(photoErrorMessage("PHOTO_PROCESSING_BUSY", 503, "x")).toBe("O servidor está processando outras fotos. Tente de novo em instantes.");
    // o código vale mais que o status: 503 com código conhecido não cai na mensagem genérica
    expect(photoErrorMessage("PHOTO_PROCESSING_BUSY", 503, "texto técnico")).not.toContain("Não foi possível enviar");
    expect(photoErrorMessage("TOO_MANY_REQUESTS", 429, "x")).toContain("Aguarde"); // código real do backend no 429
    expect(photoErrorMessage("OUTRO", 400, "padrão")).toBe("padrão");
    expect(photoErrorMessage("OUTRO", 503, "texto técnico")).toBe("Não foi possível enviar a foto. Tente de novo.");
  });
});

async function loadResizer(page: Page) {
  await page.goto("/login");
  const source = readFileSync("src/lib/photoResize.ts", "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const script = js.replace(/^export /gm, "");
  await page.evaluate(`window.__photo = (() => { ${script}; return { reducePhoto, fitWithin, PhotoReduceError }; })();`);
}

/** Código executado no navegador: gera imagens de teste, com ou sem EXIF de orientação. */
const HELPERS = `
  window.__make = async (w, h, type, orientation, noisy) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#c33"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#39f"; ctx.fillRect(0, 0, Math.floor(w / 2), Math.floor(h / 2));
    if (noisy) { const d = ctx.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i++) d.data[i] = Math.random() * 255; ctx.putImageData(d, 0, 0); }
    const blob = await new Promise((r) => c.toBlob(r, type, 0.95));
    if (!orientation || type !== "image/jpeg") return blob;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const exif = new Uint8Array([0xff,0xe1,0x00,0x22,0x45,0x78,0x69,0x66,0,0, 0x49,0x49,0x2a,0,8,0,0,0, 1,0, 0x12,0x01,3,0,1,0,0,0,orientation,0,0,0, 0,0,0,0]);
    const out = new Uint8Array(bytes.length + exif.length);
    out.set(bytes.subarray(0, 2), 0); out.set(exif, 2); out.set(bytes.subarray(2), 2 + exif.length);
    return new Blob([out], { type: "image/jpeg" });
  };
  window.__size = async (blob) => { const b = await createImageBitmap(blob); const r = [b.width, b.height]; b.close(); return r; };
`;

test.describe("FUC26 — reducePhoto no navegador", () => {
  test.beforeEach(async ({ page }) => {
    await loadResizer(page);
    await page.evaluate(HELPERS);
  });

  test("foto grande e girada por EXIF (orientação 6): lado maior 2000 px, JPEG e já na orientação correta", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const w = window as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const original = await w.__make(4000, 1000, "image/jpeg", 6);
      // sem aplicar a orientação, o navegador veria 4000x1000; com "from-image" vê 1000x4000 (girada)
      const out = await w.__photo.reducePhoto(original);
      return { type: out.blob.type, size: out.blob.size, dims: await w.__size(out.blob), reported: [out.width, out.height] };
    });
    expect(r.type).toBe("image/jpeg");
    expect(r.dims).toEqual([500, 2000]); // girou: 1000x4000 → 500x2000
    expect(r.reported).toEqual([500, 2000]);
    expect(r.size).toBeLessThan(10 * 1024 * 1024);
  });

  test("orientação 1 (normal) mantém a forma; foto pequena não é ampliada", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const w = window as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const grande = await w.__photo.reducePhoto(await w.__make(4000, 1000, "image/jpeg", 1));
      const pequena = await w.__photo.reducePhoto(await w.__make(300, 200, "image/jpeg", 0));
      return { grande: await w.__size(grande.blob), pequena: await w.__size(pequena.blob) };
    });
    expect(r.grande).toEqual([2000, 500]);
    expect(r.pequena).toEqual([300, 200]);
  });

  test("PNG e WebP viram JPEG", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const w = window as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const png = await w.__photo.reducePhoto(await w.__make(800, 600, "image/png", 0));
      const webp = await w.__photo.reducePhoto(await w.__make(800, 600, "image/webp", 0));
      return { png: png.blob.type, webp: webp.blob.type };
    });
    expect(r).toEqual({ png: "image/jpeg", webp: "image/jpeg" });
  });

  test("arquivo que não é imagem → NOT_AN_IMAGE; imagem corrompida (ou HEIC que o navegador não abre) → CANNOT_DECODE", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const w = window as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const codigo = async (blob: Blob) => w.__photo.reducePhoto(blob).then(() => "ok", (e: { code: string }) => e.code);
      return {
        texto: await codigo(new Blob(["oi"], { type: "text/plain" })),
        pdf: await codigo(new Blob(["%PDF-1.4"], { type: "application/pdf" })),
        corrompida: await codigo(new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "image/jpeg" })),
        heic: await codigo(new Blob([new Uint8Array(64)], { type: "image/heic" })),
      };
    });
    expect(r).toEqual({ texto: "NOT_AN_IMAGE", pdf: "NOT_AN_IMAGE", corrompida: "CANNOT_DECODE", heic: "CANNOT_DECODE" });
  });

  test("tamanho final conferido: abaixo do limite passa; acima do limite mesmo na menor qualidade e no tamanho reduzido → TOO_LARGE", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const w = window as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const ruido = await w.__make(1500, 1500, "image/png", 0, true); // ruído: não comprime
      const ok = await w.__photo.reducePhoto(ruido);
      const limitado = await w.__photo.reducePhoto(ruido, { maxBytes: 1_500_000 }).then((o: { blob: Blob }) => o.blob.size, (e: { code: string }) => e.code);
      const impossivel = await w.__photo.reducePhoto(ruido, { maxBytes: 2000 }).then(() => "ok", (e: { code: string }) => e.code);
      return { okSize: ok.blob.size, limitado, impossivel };
    });
    expect(r.okSize).toBeLessThan(10 * 1024 * 1024);
    expect(typeof r.limitado === "number" ? r.limitado : 0).toBeLessThanOrEqual(1_500_000); // baixou qualidade/tamanho até caber
    expect(r.impossivel).toBe("TOO_LARGE");
  });
});
