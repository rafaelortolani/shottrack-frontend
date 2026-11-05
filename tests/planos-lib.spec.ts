import { test, expect } from "@playwright/test";
import {
  MB,
  bytesToMb,
  formatBytes,
  limitToInput,
  mbToBytes,
  parseLimitInput,
  parseMb,
  usageLevel,
  usagePercent,
  formatUsage,
  usageOverLimit,
  type Plan,
} from "../src/lib/plans";

/** FUC27/FUC28: conversão MB <-> bytes (arredondamento e limites) e barra de uso (80% / 100%). Teste unitário, sem navegador. */
test.describe("Planos — conversão MB <-> bytes", () => {
  test("512 MB é o padrão do backend (536.870.912 bytes) nos dois sentidos", () => {
    expect(mbToBytes(512)).toBe(536_870_912);
    expect(bytesToMb(536_870_912)).toBe(512);
    expect(limitToInput("BYTES", 536_870_912)).toBe("512");
  });

  test("limites da faixa: 0 e 100 GB (102.400 MB = 107.374.182.400 bytes)", () => {
    expect(mbToBytes(0)).toBe(0);
    expect(bytesToMb(0)).toBe(0);
    expect(mbToBytes(102_400)).toBe(107_374_182_400);
    expect(bytesToMb(107_374_182_400)).toBe(102_400);
    expect(Number.isSafeInteger(mbToBytes(102_400))).toBe(true);
  });

  test("uma casa decimal: 0,5 MB, 1,5 MB e arredondamento na 1ª casa", () => {
    expect(mbToBytes(0.5)).toBe(524_288);
    expect(mbToBytes(1.5)).toBe(1_572_864);
    expect(bytesToMb(524_288)).toBe(0.5);
    // 2 casas não existem na tela, mas a conversão é estável: 1,04 → 1,0 e 1,06 → 1,1
    expect(mbToBytes(1.04)).toBe(MB);
    expect(mbToBytes(1.06)).toBe(Math.round(1.1 * MB));
    // bytes que não são múltiplos de 0,1 MB arredondam para a 1ª casa ao exibir
    expect(bytesToMb(MB + 40_000)).toBe(1);
    expect(bytesToMb(MB + 60_000)).toBe(1.1);
    expect(limitToInput("BYTES", 1_572_864)).toBe("1,5");
  });

  test("ida e volta não muda o valor para qualquer MB de 1 casa", () => {
    for (let tenths = 0; tenths <= 5000; tenths += 7) {
      const mb = tenths / 10;
      expect(bytesToMb(mbToBytes(mb))).toBe(mb);
    }
  });

  test("parseMb aceita vírgula ou ponto, 1 casa decimal e recusa o resto", () => {
    expect(parseMb("512")).toBe(512);
    expect(parseMb(" 0,5 ")).toBe(0.5);
    expect(parseMb("1.5")).toBe(1.5);
    for (const bad of ["", " ", "abc", "-1", "1,25", "1,", ",5", "1e3", "1 000", "0x10", "1.5.2", "9999999", "+3"]) {
      expect(parseMb(bad), bad).toBeNull();
    }
  });

  test("parseLimitInput: espaço vira bytes; contagem aceita só inteiro", () => {
    expect(parseLimitInput("BYTES", "512")).toBe(536_870_912);
    expect(parseLimitInput("BYTES", "0,5")).toBe(524_288);
    expect(parseLimitInput("BYTES", "x")).toBeNull();
    expect(parseLimitInput("COUNT", "8")).toBe(8);
    expect(parseLimitInput("PER_HOUR", " 30 ")).toBe(30);
    for (const bad of ["", "1,5", "1.5", "-1", "abc", "1e2", "9999999999"]) {
      expect(parseLimitInput("COUNT", bad), bad).toBeNull();
    }
  });

  test("formatBytes: MB com vírgula e GB acima de 1024 MB", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(38 * MB)).toBe("38 MB");
    expect(formatBytes(524_288)).toBe("0,5 MB");
    expect(formatBytes(512 * MB)).toBe("512 MB");
    expect(formatBytes(2 * 1024 * MB)).toBe("2 GB");
  });
});

test.describe("Planos — barra de uso (alerta a 80%, limite a 100%)", () => {
  test("níveis: 79% ok, 80% alerta, 99% alerta, 100% e acima limite", () => {
    expect(usageLevel(0, 500)).toBe("ok");
    expect(usageLevel(399, 500)).toBe("ok"); // 79,8%
    expect(usageLevel(400, 500)).toBe("warning"); // 80%
    expect(usageLevel(499, 500)).toBe("warning");
    expect(usageLevel(500, 500)).toBe("limit");
    expect(usageLevel(600, 500)).toBe("limit"); // limite reduzido abaixo do uso
  });

  test("fronteira de 80% com limite pequeno (5 fotos: 4 já é 80%)", () => {
    expect(usageLevel(3, 5)).toBe("ok");
    expect(usageLevel(4, 5)).toBe("warning");
    expect(usageLevel(5, 5)).toBe("limit");
  });

  test("percentual da barra: arredonda para baixo e nunca passa de 100", () => {
    expect(usagePercent(0, 500)).toBe(0);
    expect(usagePercent(12, 500)).toBe(2);
    expect(usagePercent(499, 500)).toBe(99); // nunca mostra 100% antes do limite
    expect(usagePercent(500, 500)).toBe(100);
    expect(usagePercent(900, 500)).toBe(100);
    expect(usagePercent(38 * MB, 512 * MB)).toBe(7);
  });

  test("limite zero: sem envios permitidos conta como cheio, e uso negativo não quebra", () => {
    expect(usageLevel(0, 0)).toBe("limit");
    expect(usagePercent(0, 0)).toBe(0);
    expect(usagePercent(3, 0)).toBe(100);
    expect(usagePercent(-5, 100)).toBe(0);
  });
});

test.describe("Planos — uso do atleta na busca do admin", () => {
  const plan = (photos: number, storage: number): Plan => ({
    code: "X",
    name: "X",
    active: true,
    default: false,
    athleteCount: 0,
    limits: [
      { key: "PHOTOS_PER_ATHLETE", value: photos, unit: "COUNT", min: 0, max: 100000, defaultValue: 500, enforced: true, customized: false },
      { key: "STORAGE_BYTES_PER_ATHLETE", value: storage, unit: "BYTES", min: 0, max: 107374182400, defaultValue: 512 * MB, enforced: true, customized: false },
    ],
  });

  test("formatUsage: zero, singular, plural e MB com vírgula", () => {
    expect(formatUsage(0, 0)).toBe("0 fotos · 0 MB");
    expect(formatUsage(1, 524_288)).toBe("1 foto · 0,5 MB");
    expect(formatUsage(12, 38 * MB)).toBe("12 fotos · 38 MB");
    expect(formatUsage(500, 512 * MB)).toBe("500 fotos · 512 MB");
    expect(formatUsage(3, 2 * 1024 * MB)).toBe("3 fotos · 2 GB");
  });

  test("usageOverLimit: só passa do limite quando é ESTRITAMENTE maior; aponta fotos, espaço ou os dois", () => {
    const p = plan(10, 100 * MB);
    expect(usageOverLimit({ photoCount: 10, storageBytes: 100 * MB }, p)).toEqual([]); // no limite não é "acima"
    expect(usageOverLimit({ photoCount: 0, storageBytes: 0 }, p)).toEqual([]);
    expect(usageOverLimit({ photoCount: 11, storageBytes: 1 }, p)).toEqual(["fotos (limite 10)"]);
    expect(usageOverLimit({ photoCount: 1, storageBytes: 100 * MB + 1 }, p)).toEqual(["espaço (limite 100 MB)"]);
    expect(usageOverLimit({ photoCount: 11, storageBytes: 200 * MB }, p)).toEqual(["fotos (limite 10)", "espaço (limite 100 MB)"]);
    // limite 0 (nenhum envio): qualquer foto já passa
    expect(usageOverLimit({ photoCount: 1, storageBytes: 0 }, plan(0, 0))).toEqual(["fotos (limite 0)"]);
  });

  test("sem o plano na lista não há comparativo: nada é destacado", () => {
    expect(usageOverLimit({ photoCount: 999, storageBytes: 999 * MB }, undefined)).toEqual([]);
  });
});
