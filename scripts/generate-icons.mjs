/**
 * Gera os PNGs do PWA em public/icons a partir da retícula de
 * src/app/icon.svg (a mesma do LogoIcon) — não redesenha o logo, só o
 * posiciona sobre o fundo #232323. Rodar manualmente quando o logo mudar:
 *   node scripts/generate-icons.mjs
 * e commitar os PNGs resultantes.
 */
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "icons");
mkdirSync(out, { recursive: true });

const BACKGROUND = "#232323";

// Elementos da retícula (tudo depois do <rect> de fundo do icon.svg)
const svg = readFileSync(path.join(root, "src", "app", "icon.svg"), "utf-8");
const reticle = svg.slice(svg.indexOf("<circle"), svg.indexOf("</svg>"));

/**
 * @param scale  fração do lado do canvas ocupada pela caixa 60x60 do logo
 * @param radius raio dos cantos do fundo, em unidades de 60 (0 = sangrado)
 */
function iconSvg({ scale, radius }) {
  const offset = (60 - 60 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
  <rect width="60" height="60" rx="${radius}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${reticle}</g>
</svg>`;
}

const targets = [
  // purpose "any": ocupa a caixa toda, cantos arredondados como o favicon
  { file: "icon-192.png", size: 192, scale: 1, radius: 12 },
  { file: "icon-512.png", size: 512, scale: 1, radius: 12 },
  // purpose "maskable": fundo sangrado + retícula na zona segura (~17% de margem)
  { file: "icon-maskable-512.png", size: 512, scale: 0.75, radius: 0 },
  // iOS arredonda sozinho: fundo sangrado, sem transparência
  { file: "apple-touch-icon.png", size: 180, scale: 0.86, radius: 0 },
];

for (const { file, size, scale, radius } of targets) {
  await sharp(Buffer.from(iconSvg({ scale, radius })), { density: (72 * size) / 60 })
    .resize(size, size)
    .png()
    .toFile(path.join(out, file));
  console.log(`public/icons/${file} (${size}x${size})`);
}
