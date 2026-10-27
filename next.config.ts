import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.16"],
  devIndicators: false,
  env: {
    // Mesmo DSN do servidor, embutido no bundle do cliente no build
    // (instrumentation-client.ts). Vazio = Sentry desligado.
    SENTRY_DSN: process.env.SENTRY_DSN ?? "",
  },
  async headers() {
    return [
      {
        // O navegador precisa rechecar o service worker a cada visita (FUC22)
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "home-4yg",
  project: "shottrack-frontend",

  // Só loga o upload de source maps no CI
  silent: !process.env.CI,

  // Source maps mais completos pra stack trace legível (build um pouco mais lento)
  widenClientFileUpload: true,

  // Envia os eventos do navegador via rota própria, contornando ad-blockers
  // (não pode casar com o matcher do src/proxy.ts)
  tunnelRoute: "/monitoring",

  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
