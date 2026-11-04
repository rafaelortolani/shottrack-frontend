import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { resolveBackendUrl } from "../src/lib/backend";
import { createUser, randomEmail } from "./helpers";

/**
 * Lote 5 da auditoria de segurança do frontend: autoComplete (A11), cache do service worker (A12, em pwa.spec.ts)
 * e acabamento (A13): BACKEND_URL obrigatória em produção, noindex nas telas autenticadas e INPUT_CLASS único.
 */
const SENHA = "senha12345";

async function loginUi(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas/);
}

test.describe("A11 — autoComplete dos campos de e-mail e senha", () => {
  test("login: e-mail é username e senha é current-password", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "username");
    await expect(page.getByLabel("Senha")).toHaveAttribute("autocomplete", "current-password");
  });

  test("completar cadastro: a senha é new-password", async ({ page }) => {
    await page.goto("/cadastro/completar?token=qualquer");
    await expect(page.getByLabel("Senha")).toHaveAttribute("autocomplete", "new-password");
  });

  test("redefinir senha: nova senha e confirmação são new-password", async ({ page }) => {
    await page.goto("/redefinir-senha?token=qualquer");
    await expect(page.getByLabel("Nova senha", { exact: true })).toHaveAttribute("autocomplete", "new-password");
    await expect(page.getByLabel("Confirmar nova senha")).toHaveAttribute("autocomplete", "new-password");
  });

  test("trocar senha logado: senha atual é current-password e a nova é new-password", async ({ page }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);

    await page.goto("/usuario/senha");
    await expect(page.getByLabel("Senha atual")).toHaveAttribute("autocomplete", "current-password");
    await expect(page.getByLabel("Nova senha")).toHaveAttribute("autocomplete", "new-password");
  });

  test("os campos de e-mail de cadastro, esqueci-senha e troca de e-mail são email", async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");

    await page.goto("/esqueci-senha");
    await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");

    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);
    await page.goto("/usuario/email");
    await expect(page.getByLabel("Novo email")).toHaveAttribute("autocomplete", "email");
  });

  test("excluir conta: a senha de confirmação segue current-password", async ({ page }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);

    await page.goto("/usuario/privacidade");
    await page.getByRole("button", { name: /excluir (minha )?conta/i }).first().click();
    await expect(page.getByLabel(/senha/i).last()).toHaveAttribute("autocomplete", "current-password");
  });
});

test.describe("A13a — BACKEND_URL obrigatória em produção", () => {
  test("em produção sem BACKEND_URL (ou vazia) falha em vez de usar localhost", () => {
    expect(() => resolveBackendUrl({ NODE_ENV: "production" })).toThrow(/BACKEND_URL/);
    expect(() => resolveBackendUrl({ NODE_ENV: "production", BACKEND_URL: "" })).toThrow(/BACKEND_URL/);
    expect(() => resolveBackendUrl({ NODE_ENV: "production", BACKEND_URL: "   " })).toThrow(/BACKEND_URL/);
  });

  test("em produção com BACKEND_URL usa o valor configurado", () => {
    expect(resolveBackendUrl({ NODE_ENV: "production", BACKEND_URL: "https://api.shottrack.example" })).toBe(
      "https://api.shottrack.example"
    );
  });

  test("fora de produção mantém o padrão local, e a variável vence quando existe", () => {
    expect(resolveBackendUrl({ NODE_ENV: "development" })).toBe("http://localhost:8080");
    expect(resolveBackendUrl({})).toBe("http://localhost:8080");
    expect(resolveBackendUrl({ NODE_ENV: "test", BACKEND_URL: "http://localhost:8090" })).toBe("http://localhost:8090");
  });
});

test.describe("A13b — fora dos buscadores", () => {
  test("robots.txt bloqueia a API e as áreas autenticadas e deixa as telas públicas abertas", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    for (const path of ["/api/", "/dashboard", "/boas-vindas", "/usuario", "/acervo", "/treinos", "/admin"]) {
      expect(body, path).toContain(`Disallow: ${path}`);
    }
    for (const path of ["/login", "/cadastro", "/termos", "/privacidade"]) {
      expect(body, path).not.toContain(`Disallow: ${path}`);
    }
  });

  test("telas autenticadas respondem X-Robots-Tag: noindex, nofollow; as públicas não", async ({ request }) => {
    for (const path of ["/dashboard", "/boas-vindas", "/treinos/visitas", "/acervo/armas", "/usuario/perfil", "/admin"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
    }
    for (const path of ["/login", "/cadastro", "/termos"]) {
      expect((await request.get(path)).headers()["x-robots-tag"], path).toBeUndefined();
    }
  });

  test("com sessão a tela renderizada também leva o noindex", async ({ page }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);
    const response = await page.request.get("/acervo/armas", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });
});

test.describe("A13c — INPUT_CLASS único", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  }

  test("a classe padrão dos campos existe num único módulo e as telas importam dele", () => {
    const shared = readFileSync("src/lib/formStyles.ts", "utf8");
    const classString = /INPUT_CLASS =\s*"([^"]+)"/.exec(shared)?.[1];
    expect(classString).toBeTruthy();

    // (className literal inline em telas de autenticação não é a constante duplicada: fora deste teste)
    const declaration = new RegExp(`INPUT_CLASS\\s*=\\s*"${classString!.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"`);
    const copies = sourceFiles("src").filter((file) => file !== "src/lib/formStyles.ts" && declaration.test(readFileSync(file, "utf8")));
    expect(copies, "declarações duplicadas de INPUT_CLASS fora do módulo compartilhado").toEqual([]);

    const importers = sourceFiles("src").filter((file) => readFileSync(file, "utf8").includes('from "@/lib/formStyles"'));
    expect(importers.length).toBeGreaterThanOrEqual(9);
  });

  test("a aparência não mudou: o campo continua com o padding, a borda e o raio de sempre", async ({ page }) => {
    const email = randomEmail();
    await createUser(email, SENHA);
    await loginUi(page, email);

    for (const path of ["/treinos/locais/novo", "/acervo/municoes/nova", "/acervo/acessorios/novo"]) {
      await page.goto(path);
      const input = page.locator("input[type=text], input:not([type])").first();
      await expect(input, path).toBeVisible();
      const style = await input.evaluate((el) => {
        const css = getComputedStyle(el);
        return {
          paddingLeft: css.paddingLeft,
          paddingTop: css.paddingTop,
          borderTopWidth: css.borderTopWidth,
          borderTopLeftRadius: css.borderTopLeftRadius,
          width: Math.round(el.getBoundingClientRect().width) > 100,
        };
      });
      expect(style, path).toEqual({
        paddingLeft: "12px",
        paddingTop: "8px",
        borderTopWidth: "1px",
        borderTopLeftRadius: "6px",
        width: true,
      });
    }
  });
});
