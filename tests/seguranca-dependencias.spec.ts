import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

/**
 * Lote 1 da auditoria de segurança (A01): Next.js corrigido, otimizador de imagem desligado
 * e SVGs de exemplo removidos. Não precisam de login nem de dados.
 */
function installedVersion(pkg: string): number[] {
  const { version } = JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, "utf8"));
  return String(version).split("-")[0].split(".").map(Number);
}

function atLeast(actual: number[], minimum: number[]): boolean {
  for (let i = 0; i < minimum.length; i++) {
    if (actual[i] !== minimum[i]) return actual[i] > minimum[i];
  }
  return true;
}

test.describe("Dependências e Next.js (auditoria A01)", () => {
  test("o Next instalado é a versão corrigida (>= 16.4.3), e o eslint-config-next acompanha", () => {
    // 16.3.5 e anteriores até 16.4.0 têm 11 avisos de segurança (RCE/SSRF na otimização de imagem, cache poisoning...)
    expect(atLeast(installedVersion("next"), [16, 4, 3])).toBe(true);
    expect(installedVersion("eslint-config-next")).toEqual(installedVersion("next"));
  });

  test("o otimizador de imagem está desligado: /_next/image não responde", async ({ request }) => {
    const response = await request.get("/_next/image?url=%2Ficons%2Ficon-192.png&w=64&q=75", { maxRedirects: 0 });
    // antes (otimizador ligado): 200 com a imagem redimensionada
    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"] ?? "").not.toContain("image/");
  });

  test("a URL do otimizador também não aceita origem externa (SSRF)", async ({ request }) => {
    const response = await request.get("/_next/image?url=http%3A%2F%2F127.0.0.1%3A8090%2Factuator%2Fhealth&w=64&q=75", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain('"status"');
  });

  for (const file of ["file", "globe", "next", "vercel", "window"]) {
    test(`/${file}.svg (exemplo do create-next-app) foi removido`, async ({ request }) => {
      expect((await request.get(`/${file}.svg`, { maxRedirects: 0 })).status()).toBe(404);
    });
  }

  test("os ícones do PWA continuam sendo servidos (a limpeza não tirou nada em uso)", async ({ request }) => {
    for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
      const response = await request.get(`/icons/${icon}`, { maxRedirects: 0 });
      expect(response.status(), icon).toBe(200);
    }
  });
});
