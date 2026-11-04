import type { NextResponse } from "next/server";

const ACCESS_COOKIE = "shottrack_access";
const REFRESH_COOKIE = "shottrack_refresh";

/**
 * O refresh token só viaja para `/api/auth/**` (login, logout e a futura renovação): nas demais
 * requisições o navegador não o envia (auditoria A07). O access token continua em `/`.
 */
export const REFRESH_COOKIE_PATH = "/api/auth";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const baseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
} as const;

/**
 * `response.cookies` guarda um cookie por nome: apagar o refresh antigo (Path=/) com ele sobrescreveria o novo
 * (Path=/api/auth). A variante legada vai como um `Set-Cookie` à parte, anexado por último (cada operação de
 * `response.cookies` reescreve os `Set-Cookie`, então esta tem que vir depois de todas).
 */
function expireLegacyRefreshCookie(response: NextResponse) {
  const secure = baseOptions.secure ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${REFRESH_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`
  );
}

/**
 * Cookies httpOnly da sessão. O JWT de acesso vale 1 h (ADR-0001), mas o cookie dura o mesmo que o refresh
 * (7 dias): com ele expirado o navegador ainda o envia, o backend responde 401 e o cliente renova a sessão
 * (`/api/auth/refresh`, A07). Se o cookie sumisse com o JWT, a página redirecionaria ao login antes de qualquer
 * renovação. O refresh vai só para `/api/auth`.
 */
export function setSessionCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  response.cookies.set(ACCESS_COOKIE, accessToken, { ...baseOptions, path: "/", maxAge: SESSION_MAX_AGE });
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    ...baseOptions,
    path: REFRESH_COOKIE_PATH,
    maxAge: SESSION_MAX_AGE,
  });
  // Sessão aberta antes da restrição de path: o cookie antigo (Path=/) seguiria indo em toda requisição
  expireLegacyRefreshCookie(response);
}

/** Limpa a sessão. O cookie só some se o `path` for o mesmo com que foi criado, por isso as duas variantes do refresh. */
export function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete({ name: REFRESH_COOKIE, path: REFRESH_COOKIE_PATH });
  expireLegacyRefreshCookie(response);
}
