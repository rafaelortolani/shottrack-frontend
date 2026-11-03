import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O E2E usa diretórios próprios (.next-e2e*) para não colidir com o `next dev` do desenvolvimento
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  allowedDevOrigins: ["192.168.100.16"],
  devIndicators: false,
  // Não anuncia o framework na resposta (X-Powered-By)
  poweredByHeader: false,
  // O app não usa next/image: desliga o otimizador (/_next/image) para não expor o endpoint
  images: { unoptimized: true },
  env: {
    // Mesmo DSN do servidor, embutido no bundle do cliente no build
    // (instrumentation-client.ts). Vazio = Sentry desligado.
    SENTRY_DSN: process.env.SENTRY_DSN ?? "",
  },
  async headers() {
    return [
      {
        // Cabeçalhos de segurança em tudo. A CSP não está aqui: ela leva nonce por requisição
        // e é montada no src/proxy.ts (src/lib/csp.ts).
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // câmera só na própria origem (será usada no futuro); o resto fica bloqueado
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        // Páginas que recebem token de uso único na URL (A04): nenhum Referer sai delas. Vem depois da regra
        // geral para sobrescrever o Referrer-Policy.
        source: "/:page(cadastro/completar|redefinir-senha)",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        // Resposta autenticada nunca fica em cache do navegador, de proxy ou de CDN
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Vary", value: "Cookie" },
        ],
      },
      {
        // HTML das telas autenticadas: sem cache compartilhado (um CDN serviria a casca sem passar
        // pelo proxy.ts). Mesma lista de prefixos de PROTECTED_PATHS em src/proxy.ts.
        source: "/:area(dashboard|boas-vindas|usuario|acervo|treinos|admin)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Vary", value: "Cookie" },
        ],
      },
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
