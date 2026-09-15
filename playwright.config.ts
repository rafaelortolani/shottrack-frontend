import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E rodam contra o frontend E o backend reais, rodando localmente.
 * Suba os dois antes de rodar `npm run test:e2e`:
 *   - shottrack-backend: docker compose up -d && ./mvnw spring-boot:run
 *   - shottrack-frontend: npm run dev
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // testes criam usuários reais no backend; evita corrida entre eles
  retries: 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});