import { defineConfig, devices } from "@playwright/test";
import {
  assertTestEnvironment,
  restoreNextGeneratedFilesOnExit,
  BACKEND_URL,
  BASE_URL,
  E2E_FRONT_PORT,
  E2E_PWA_PORT,
  PWA_BASE_URL,
} from "./tests/e2e-env";

// Trava: recusa rodar se alguma URL não for a do ambiente de teste
assertTestEnvironment();
restoreNextGeneratedFilesOnExit();

const reuseExistingServer = process.env.E2E_REUSE === "1";
// O build de produção (projeto pwa) é lento: só entra quando o pwa vai rodar (sem --project, ou com --project=pwa)
const projectArgs = process.argv.filter((arg) => arg.startsWith("--project"));
const needsProductionServer = projectArgs.length === 0 || projectArgs.some((arg) => arg.includes("pwa"));
// Os servidores de front do E2E usam o backend de teste, sem Sentry e sem upload de source maps
const frontEnv = { BACKEND_URL, SENTRY_DSN: "", SENTRY_AUTH_TOKEN: "" };

/**
 * Testes E2E rodam contra o frontend E o backend reais, mas em AMBIENTE ISOLADO de teste:
 * backend na porta 8090, banco `shottrack_test`, vhost próprio no RabbitMQ e Mailpit próprio
 * (nada do desenvolvimento). `npm run test:e2e` sobe tudo sozinho (webServer abaixo) e recria
 * o banco do zero a cada execução. Pré-requisito: `docker compose up -d` no shottrack-backend.
 * Detalhes no README ("Ambiente de teste do E2E") e em tests/e2e-env.ts (a trava).
 *
 * Projetos:
 *   - chromium: a suíte inteira, desktop, contra `next dev` de teste (porta 3091)
 *   - mobile-iphone / mobile-pixel: smoke dos fluxos principais em celular
 *     (tests/mobile-*.spec.ts). "iPhone 13" roda no Chromium com o viewport,
 *     o user-agent e o toque do iPhone — emulação, não WebKit.
 *   - pwa: service worker e manifest, que só existem em PRODUÇÃO — contra o
 *     build de teste (`next build` + `next start`, porta 3092)
 *
 * E2E_REUSE=1 reaproveita servidores já no ar (sem recriar o banco) — para rodar um
 * spec várias vezes; o banco então acumula dados até a próxima subida limpa.
 */
const MOBILE_SPECS = /mobile-.*\.spec\.ts/;
const PWA_SPECS = /pwa\.spec\.ts/;


export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // testes criam usuários reais no backend; evita corrida entre eles
  retries: 0,
  reporter: "html",
  globalSetup: "./tests/global-setup.ts",
  webServer: [
    {
      command: "bash scripts/e2e-backend.sh",
      url: `${BACKEND_URL}/actuator/health`,
      timeout: 240_000,
      reuseExistingServer,
      stdout: "pipe",
    },
    {
      // distDir próprio: não colide com o `next dev` do desenvolvimento (.next)
      command: `npx next dev -p ${E2E_FRONT_PORT}`,
      url: `${BASE_URL}/login`,
      timeout: 120_000,
      reuseExistingServer,
      env: { ...frontEnv, NEXT_DIST_DIR: ".next-e2e" },
    },
    ...(needsProductionServer
      ? [
          {
            command: `npx next build && npx next start -p ${E2E_PWA_PORT}`,
            url: `${PWA_BASE_URL}/login`,
            timeout: 360_000,
            reuseExistingServer,
            env: { ...frontEnv, NEXT_DIST_DIR: ".next-e2e-prod" },
          },
        ]
      : []),
  ],
  use: {
    baseURL: BASE_URL,
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
