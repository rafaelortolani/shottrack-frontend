/**
 * Ambiente isolado do E2E. TUDO aqui é de teste: backend em porta própria, banco
 * `shottrack_test`, vhost próprio no RabbitMQ e Mailpit próprio — nada do ambiente
 * de desenvolvimento (backend 8080, banco `shottrack`, front 3000).
 *
 * `assertTestEnvironment` é a trava: roda ao carregar o playwright.config e
 * recusa a execução se alguma URL não for a de teste. Quem sobe o ambiente é o
 * `scripts/e2e-backend.sh` (chamado pelo `webServer` do Playwright).
 */
import { readFileSync, writeFileSync } from "node:fs";

export const E2E_BACKEND_PORT = 8090;
export const E2E_FRONT_PORT = 3091; // next build + start (chromium, mobile e pwa)
export const E2E_DEV_PORT = 3093; // next dev (só o projeto "dev", testes marcados com @dev)
export const E2E_MAILPIT_PORT = 8026;
export const E2E_DB = "shottrack_test";
export const E2E_RABBIT_VHOST = "shottrack_test";

/** Portas do ambiente de DESENVOLVIMENTO: o E2E nunca pode apontar para elas. */
const DEV_PORTS = [8080, 3000];

export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? `http://localhost:${E2E_BACKEND_PORT}`;
export const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${E2E_FRONT_PORT}`;
export const DEV_BASE_URL = process.env.E2E_DEV_BASE_URL ?? `http://localhost:${E2E_DEV_PORT}`;
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? `http://localhost:${E2E_MAILPIT_PORT}`;

function expectLocalPort(name: string, value: string, expectedPort: number) {
  const url = new URL(value);
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  if (DEV_PORTS.includes(port) || !local || port !== expectedPort) {
    throw new Error(
      `E2E recusado: ${name}=${value} não é o ambiente de teste (esperado http://localhost:${expectedPort}). ` +
        `O E2E nunca roda contra o desenvolvimento (portas ${DEV_PORTS.join("/")}, banco "shottrack"). ` +
        `Veja "Ambiente de teste do E2E" no README.`
    );
  }
}

export function assertTestEnvironment() {
  expectLocalPort("E2E_BACKEND_URL", BACKEND_URL, E2E_BACKEND_PORT);
  expectLocalPort("E2E_BASE_URL", BASE_URL, E2E_FRONT_PORT);
  expectLocalPort("E2E_DEV_BASE_URL", DEV_BASE_URL, E2E_DEV_PORT);
  expectLocalPort("E2E_MAILPIT_URL", MAILPIT_URL, E2E_MAILPIT_PORT);
}

/**
 * O Next reescreve `next-env.d.ts` e o `tsconfig.json` (versionados) ao subir com outro
 * `distDir` (.next-e2e*). Guarda o conteúdo original ao carregar a config no processo
 * principal do Playwright e o devolve quando ele termina (sucesso, falha ou Ctrl-C).
 */
export function restoreNextGeneratedFilesOnExit() {
  if (process.env.TEST_WORKER_INDEX !== undefined) return; // só no processo principal, não nos workers

  const files = ["next-env.d.ts", "tsconfig.json"];
  const originals = files.map((file) => [file, readFileSync(file, "utf8")] as const);
  process.once("exit", () => {
    for (const [file, content] of originals) {
      try {
        if (readFileSync(file, "utf8") !== content) writeFileSync(file, content);
      } catch {
        // melhor esforço
      }
    }
  });
}
