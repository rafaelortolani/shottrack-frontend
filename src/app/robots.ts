import type { MetadataRoute } from "next";

/**
 * Telas autenticadas e a API do BFF ficam fora dos buscadores (A13). Sem sessão, essas rotas só
 * redirecionam para /login; o noindex está também no cabeçalho X-Robots-Tag (next.config.ts).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/api/", "/dashboard", "/boas-vindas", "/usuario", "/acervo", "/treinos", "/admin"],
    },
  };
}
