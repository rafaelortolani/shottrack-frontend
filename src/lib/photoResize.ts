/**
 * Redução da foto do alvo no navegador, antes do envio (FUC26): lado maior de até 2000 px, JPEG (~0,85),
 * orientação da câmera aplicada aos pixels, tamanho final conferido. Converte HEIC quando o navegador o decodifica
 * (Safari); onde não decodifica, devolve erro claro.
 */
export const MAX_SIDE_PX = 2000;
export const JPEG_QUALITY = 0.85;
/** Mesmo limite do backend (10 MB por envio). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type PhotoReduceErrorCode = "NOT_AN_IMAGE" | "CANNOT_DECODE" | "TOO_LARGE" | "CANVAS_UNAVAILABLE";

export class PhotoReduceError extends Error {
  constructor(
    readonly code: PhotoReduceErrorCode,
    message: string
  ) {
    super(message);
  }
}

/** Dimensões que cabem em `maxSide` mantendo a proporção; nunca amplia. */
export function fitWithin(width: number, height: number, maxSide: number = MAX_SIDE_PX): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Qualidades tentadas, da preferida à mais baixa, se o resultado passar do limite. */
const QUALITY_STEPS = [JPEG_QUALITY, 0.7, 0.55];

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Decodifica (com a orientação do arquivo), reduz e exporta JPEG. Se mesmo na menor qualidade passar de
 * `maxBytes`, tenta com o lado maior pela metade antes de desistir.
 */
export async function reducePhoto(
  file: Blob,
  options: { maxSide?: number; maxBytes?: number } = {}
): Promise<{ blob: Blob; width: number; height: number }> {
  const maxBytes = options.maxBytes ?? MAX_PHOTO_BYTES;
  let maxSide = options.maxSide ?? MAX_SIDE_PX;

  if (file.type && !file.type.startsWith("image/")) {
    throw new PhotoReduceError("NOT_AN_IMAGE", "Esse arquivo não é uma imagem. Escolha uma foto (JPEG, PNG ou WebP).");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoReduceError(
      "CANNOT_DECODE",
      "Não consegui abrir essa foto neste aparelho (formatos como HEIC nem sempre abrem). Tente tirar a foto em JPEG ou escolha outra."
    );
  }

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new PhotoReduceError("CANVAS_UNAVAILABLE", "Este navegador não conseguiu preparar a foto para envio.");
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of QUALITY_STEPS) {
        const blob = await toJpegBlob(canvas, quality);
        if (!blob) throw new PhotoReduceError("CANVAS_UNAVAILABLE", "Este navegador não conseguiu preparar a foto para envio.");
        if (blob.size <= maxBytes) return { blob, width, height };
      }
      maxSide = Math.floor(maxSide / 2);
    }
  } finally {
    bitmap.close();
  }

  throw new PhotoReduceError("TOO_LARGE", "A foto continua grande demais depois de reduzida. Escolha outra foto.");
}
