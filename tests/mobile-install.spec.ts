import { test, expect, type Page } from "@playwright/test";
import { createUser, randomEmail } from "./helpers";

/**
 * Convite de instalação (FUC22): botão nativo no Android/Chrome, instruções no
 * iPhone, cartão dispensável em Boas-vindas, seção "Aplicativo" no Perfil.
 */
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/boas-vindas/);
}

/** O Chrome dispara beforeinstallprompt sozinho; no teste, simulamos o evento. */
async function fireInstallPrompt(page: Page) {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    (window as unknown as { __installPrompted: boolean }).__installPrompted = false;
    event.prompt = async () => {
      (window as unknown as { __installPrompted: boolean }).__installPrompted = true;
    };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
}

// O indicador do `next dev` (botão "N") fica sobre a nav inferior e intercepta o toque;
// em produção ele não existe. Só some pra não atrapalhar o teste em dev.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(style);
    });
  });
});

test.describe("Convite de instalação (FUC22)", () => {
  test("Android/Chrome: botão Instalar app usa o prompt nativo; o cartão é dispensável e a dispensa é lembrada", async ({
    page,
    isMobile,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-pixel", "fluxo do prompt nativo (Android)");
    expect(isMobile).toBe(true);
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    // sem o evento do navegador, não há o que oferecer
    await expect(page.getByRole("heading", { name: "Instale o ShotTrack" })).toHaveCount(0);

    await fireInstallPrompt(page);
    const card = page.getByRole("region", { name: "Instale o ShotTrack" });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Instalar app" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __installPrompted: boolean }).__installPrompted)).toBe(true);
    await expect(card).toHaveCount(0); // o evento só vale uma vez

    // dispensa: some e continua sumido depois de recarregar
    await fireInstallPrompt(page);
    await expect(card).toBeVisible();
    const dismiss = card.getByRole("button", { name: "Dispensar convite de instalação" });
    expect((await dismiss.boundingBox())!.width).toBeGreaterThanOrEqual(43.5);
    await dismiss.click();
    await expect(card).toHaveCount(0);

    await page.reload();
    await fireInstallPrompt(page);
    await expect(page.getByText("Treine. Registre. Evolua.").or(page.getByText(/Bem-vindo/)).first()).toBeVisible();
    await expect(card).toHaveCount(0);
  });

  test("Perfil mostra a seção Aplicativo com o botão, mesmo depois de dispensar o cartão", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-pixel", "fluxo do prompt nativo (Android)");
    const email = randomEmail();
    await createUser(email);
    await login(page, email);
    await page.evaluate(() => localStorage.setItem("shottrack_install_dismissed", "1"));

    await page.goto("/usuario/perfil");
    await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible(); // hidratou
    await fireInstallPrompt(page);
    const section = page.getByRole("region", { name: "Aplicativo" });
    await expect(section).toBeVisible();
    await expect(section.getByRole("button", { name: "Instalar app" })).toBeVisible();
  });

  test("iPhone: mostra as instruções de Compartilhar > Adicionar à Tela de Início, sem botão", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-iphone", "instruções específicas do iOS");
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    const card = page.getByRole("region", { name: "Instale o ShotTrack" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Toque em Compartilhar e depois em Adicionar à Tela de Início");
    await expect(card.getByRole("button", { name: "Instalar app" })).toHaveCount(0);

    await card.getByRole("button", { name: "Dispensar convite de instalação" }).click();
    await expect(card).toHaveCount(0);

    await page.goto("/usuario/perfil");
    await expect(page.getByRole("region", { name: "Aplicativo" })).toContainText("Adicionar à Tela de Início");
  });

  test("já instalado (modo standalone): o convite não aparece", async ({ page, context }) => {
    await context.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query.includes("display-mode: standalone")
          ? ({ matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } as unknown as MediaQueryList)
          : original(query);
    });
    const email = randomEmail();
    await createUser(email);
    await login(page, email);

    await fireInstallPrompt(page);
    await expect(page.getByText(/Bem-vindo/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Instale o ShotTrack" })).toHaveCount(0);

    await page.goto("/usuario/perfil");
    await fireInstallPrompt(page);
    await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Aplicativo" })).toHaveCount(0);
  });
});
