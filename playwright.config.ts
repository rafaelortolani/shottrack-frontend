import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E rodam contra o frontend E o backend reais, rodando localmente.
 * Suba os dois antes de rodar `npm run test:e2e`:
 *   - shottrack-backend: docker compose up -d && ./mvnw spring-boot:run
 *   - shottrack-frontend: npm run dev
 *
 * Projetos:
 *   - chromium: a suíte inteira, desktop, contra `npm run dev` (porta 3000)
 *   - mobile-iphone / mobile-pixel: smoke dos fluxos principais em celular
 *     (tests/mobile-*.spec.ts). "iPhone 13" roda no Chromium com o viewport,
 *     o user-agent e o toque do iPhone — emulação, não WebKit.
 *   - pwa: service worker e manifest, que só existem em PRODUÇÃO — rode contra
 *     o build: `npm run build && npm run start -- -p 3100` (porta 3100)
 */
const MOBILE_SPECS = /mobile-.*\.spec\.ts/;
const PWA_SPECS = /pwa\.spec\.ts/;

export const PWA_BASE_URL = "http://localhost:3100";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // testes criam usuários reais no backend; evita corrida entre eles
  retries: 0,
  reporter: "html",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [MOBILE_SPECS, PWA_SPECS],
    },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
      testMatch: MOBILE_SPECS,
    },
    {
      name: "mobile-pixel",
      use: { ...devices["Pixel 7"] },
      testMatch: MOBILE_SPECS,
    },
    {
      name: "pwa",
      use: { ...devices["Desktop Chrome"], baseURL: PWA_BASE_URL },
      testMatch: PWA_SPECS,
    },
  ],
});
