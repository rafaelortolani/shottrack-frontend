import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * Privacidade dos eventos do Sentry (auditoria A09): a URL da página e a das chamadas de rede
 * acompanham o evento, e a query pode carregar token de uso único (`?token=`) ou e-mail.
 * Os três `Sentry.init` (navegador, Node e edge) usam estas opções.
 */

/** Remove a query string (`?a=b`) de uma URL, absoluta ou relativa, preservando o fragmento. */
export function stripQuery(url: string): string {
  return url.replace(/\?[^#]*/, "");
}

function stripIfString(value: unknown): unknown {
  return typeof value === "string" ? stripQuery(value) : value;
}

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = stripQuery(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    const headers = event.request.headers;
    if (headers) {
      for (const name of Object.keys(headers)) {
        if (/^(referer|referrer)$/i.test(name)) headers[name] = stripQuery(headers[name]);
      }
    }
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }
  return event;
}

/** Navegação (`from`/`to`) e fetch/xhr (`url`) levam a URL nos dados do breadcrumb. */
export function scrubBreadcrumb<T extends Breadcrumb>(breadcrumb: T): T {
  if (breadcrumb.data) {
    for (const key of ["url", "from", "to"]) {
      if (key in breadcrumb.data) breadcrumb.data[key] = stripIfString(breadcrumb.data[key]);
    }
  }
  return breadcrumb;
}

export const sentryPrivacyOptions = {
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
