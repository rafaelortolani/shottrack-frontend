import { defineConfig, devices } from "@playwright/test";
import {
  assertTestEnvironment,
  restoreNextGeneratedFilesOnExit,
  BACKEND_URL,
  BASE_URL,
  DEV_BASE_URL,
  E2E_DEV_PORT,
  E2E_FRONT_PORT,
} from "./tests/e2e-env";

// Trava: recusa rodar se alguma URL não for a do ambiente de teste
assertTestEnvironment();
restoreNextGeneratedFilesOnExit();

const reuseExistingServer = process.env.E2E_REUSE === "1";
// O `next dev` só sobe quando o projeto "dev" vai rodar (sem --project, ou com --project=dev)
const projectArgs = process.argv.filter((arg) => arg.startsWith("--project"));
const needsDevServer = projectArgs.length === 0 || projectArgs.some((arg) => arg.includes("dev"));
// Os servidores de front do E2E usam o backend de teste, sem Sentry e sem upload de source maps
const frontEnv = { BACKEND_URL, SENTRY_DSN: "", SENTRY_AUTH_TOKEN: "" };

/**
 * Testes E2E rodam contra o frontend E o backend reais, mas em AMBIENTE ISOLADO de teste:
 * backend na porta 8090, banco `shottrack_test`, vhost próprio no RabbitMQ e Mailpit próprio
 * (nada do desenvolvimento). `npm run test:e2e` sobe tudo sozinho (webServer abaixo) e recria
 * o banco do zero a cada execução. Pré-requisito: `docker compose up -d` no shottrack-backend.
 * Detalhes no README ("Ambiente de teste do E2E") e em tests/e2e-env.ts (a trava).
 *
 * O front do E2E é um BUILD DE PRODUÇÃO (`next build` + `next start`, porta 3091): sem compilar
 * rota na 1ª visita (o `next dev` frio estoura os timeouts) e com o service worker real.
 *
 * Projetos:
 *   - chromium: a suíte inteira, desktop (menos os testes marcados @dev)
 *   - mobile-iphone / mobile-pixel: smoke dos fluxos principais em celular
 *     (tests/mobile-*.spec.ts). "iPhone 13" roda no Chromium com o viewport,
 *     o user-agent e o toque do iPhone — emulação, não WebKit.
 *   - pwa: service worker e manifest (só existem em produção)
 *   - dev: só os testes marcados @dev, contra `next dev` de teste (porta 3093) — comportamento
 *     que só existe em desenvolvimento (ex.: o service worker NÃO é registrado)
 *
 * E2E_REUSE=1 reaproveita servidores já no ar (sem recriar o banco) — para rodar um
 * spec várias vezes; o banco então acumula dados até a próxima subida limpa.
 */
const MOBILE_SPECS = /mobile-.*\.spec\.ts/;
const PWA_SPECS = /pwa\.spec\.ts/;
const DEV_ONLY = /@dev/;

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
      command: `npx next build && npx next start -p ${E2E_FRONT_PORT}`,
      url: `${BASE_URL}/login`,
      timeout: 360_000,
      reuseExistingServer,
      env: { ...frontEnv, NEXT_DIST_DIR: ".next-e2e" },
    },
    ...(needsDevServer
      ? [
          {
            command: `npx next dev -p ${E2E_DEV_PORT}`,
            url: `${DEV_BASE_URL}/login`,
            timeout: 120_000,
            reuseExistingServer,
            env: { ...frontEnv, NEXT_DIST_DIR: ".next-e2e-dev" },
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
      grepInvert: DEV_ONLY,
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
      use: { ...devices["Desktop Chrome"] },
      testMatch: PWA_SPECS,
    },
    {
      name: "dev",
      use: { ...devices["Desktop Chrome"], baseURL: DEV_BASE_URL },
      grep: DEV_ONLY,
    },
  ],
});
