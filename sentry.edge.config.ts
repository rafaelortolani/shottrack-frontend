// Sentry no runtime edge (ex: src/proxy.ts) — ADR-0017, Onda 1: só erro.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});
