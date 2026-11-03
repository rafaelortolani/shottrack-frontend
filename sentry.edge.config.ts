// Sentry no runtime edge (ex: src/proxy.ts) — ADR-0017, Onda 1: só erro.
import * as Sentry from "@sentry/nextjs";
import { sentryPrivacyOptions } from "./src/lib/sentryScrub";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Sem PII por padrão e sem query string em URLs de evento/breadcrumb (A09)
  ...sentryPrivacyOptions,
});
