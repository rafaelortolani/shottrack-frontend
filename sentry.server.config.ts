// Sentry no servidor Node (Route Handlers do BFF, Server Components) —
// ADR-0017, Onda 1: só rastreamento de erro, sem tracing nem replay.
// Sem SENTRY_DSN (dev local, testes E2E) o SDK fica desligado.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});
