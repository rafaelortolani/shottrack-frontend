/**
 * Content-Security-Policy com nonce por requisição (auditoria A03), aplicada pelo
 * `src/proxy.ts` às páginas. Hoje em modo **somente relatório**
 * (`Content-Security-Policy-Report-Only`): o navegador acusa a violação no console e
 * em `securitypolicyviolation`, mas não bloqueia nada. Passar a bloquear é decisão
 * depois de observar em produção (trocar o nome do cabeçalho em `proxy.ts`).
 *
 * O Next lê o nonce do próprio cabeçalho da requisição e o aplica nos scripts e estilos
 * que ele gera — por isso as páginas são renderizadas dinamicamente (ver layout raiz).
 */
export const CSP_HEADER = "Content-Security-Policy-Report-Only";

export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function buildCsp(nonce: string, isDev = process.env.NODE_ENV === "development"): string {
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic': os scripts com nonce podem carregar os demais chunks do Next
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // BFF e túnel do Sentry (/monitoring) são da mesma origem
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}
