import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Páginas públicas /termos e /privacidade (FUC21): abrem sem login e exibem
 * o texto de docs/legal/ — o teste lê o próprio arquivo pra garantir fidelidade.
 */
const DOCUMENTS = [
  { route: "/termos", file: "termos-de-uso.md", title: "Termos de Uso do ShotTrack" },
  { route: "/privacidade", file: "politica-de-privacidade.md", title: "Política de Privacidade do ShotTrack" },
];

function legalText(file: string) {
  return readFileSync(path.join(process.cwd(), "docs", "legal", file), "utf-8");
}

test.describe("Termos e Política de Privacidade (FUC21)", () => {
  for (const { route, file, title } of DOCUMENTS) {
    test(`${route} abre sem login e reproduz o texto de docs/legal/${file}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

      const markdown = legalText(file);
      const sections = [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
      expect(sections.length).toBeGreaterThan(5);
      for (const section of sections) {
        await expect(page.getByRole("heading", { level: 2, name: section })).toBeVisible();
      }

      // O 1º parágrafo sob um "##" (quebras de linha do arquivo viram espaço) aparece inteiro
      const lines = markdown.split("\n");
      const start = lines.findIndex((line) => line.startsWith("## ")) + 1;
      const end = lines.findIndex((line, i) => i >= start && line.trim() === "");
      const firstParagraph = lines
        .slice(start, end)
        .map((line) => line.trim())
        .join(" ")
        .replace(/\*\*/g, "");
      expect(firstParagraph.length).toBeGreaterThan(40);
      await expect(page.getByRole("article")).toContainText(firstParagraph);
    });
  }

  test("a política renderiza a tabela de finalidades e bases legais", async ({ page }) => {
    await page.goto("/privacidade");
    await expect(page.getByRole("columnheader", { name: "Base legal (LGPD, art. 7º)" })).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(6); // cabeçalho + 5 finalidades
  });

  test("a minuta mantém os campos [entre colchetes] literais", async ({ page }) => {
    await page.goto("/termos");
    await expect(page.getByRole("article")).toContainText("[e-mail de contato]");
  });

  test("login e cadastro linkam Termos e Privacidade no rodapé", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Termos", exact: true }).click();
    await expect(page).toHaveURL(/\/termos$/);

    await page.goto("/cadastro");
    await page.getByRole("link", { name: "Privacidade", exact: true }).click();
    await expect(page).toHaveURL(/\/privacidade$/);
  });

  test("voltar ao login a partir das páginas legais", async ({ page }) => {
    await page.goto("/termos");
    await page.getByRole("link", { name: "Voltar ao login", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
