// Sentry no navegador — ADR-0017, Onda 1: só erro, sem tracing nem Session
// Replay. SENTRY_DSN chega aqui pelo `env` do next.config.ts (embutido no
// bundle no build), então é a mesma variável do servidor.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});
