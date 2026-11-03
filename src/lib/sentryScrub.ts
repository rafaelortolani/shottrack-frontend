import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * Privacidade dos eventos do Sentry (auditoria A09): a URL da página e a das chamadas de rede
 * acompanham o evento, e a query pode carregar token de uso único (`?token=`) ou e-mail.
 * Também mascara e-mails em `transaction`, `contexts` e na mensagem das exceções.
 * Os três `Sentry.init` (navegador, Node e edge) usam estas opções.
 */

/** Remove a query string (`?a=b`) de uma URL, absoluta ou relativa, preservando o fragmento. */
export function stripQuery(url: string): string {
  return url.replace(/\?[^#]*/, "");
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Troca qualquer e-mail dentro de um texto por `[email]` (mensagens de erro do backend repetem o e-mail do atleta). */
export function maskEmails(text: string): string {
  return text.replace(EMAIL, "[email]");
}

const URL_LIKE = /^(?:https?:\/\/|\/)\S*$/;

/** Percorre `contexts` (objetos aninhados): mascara e-mails e tira a query de valores que são URL. Tolera ciclos. */
function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return maskEmails(URL_LIKE.test(value) ? stripQuery(value) : value);
  }
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      value[index] = scrubValue(item, seen);
    });
  } else {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) record[key] = scrubValue(record[key], seen);
  }
  return value;
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
  if (event.transaction) event.transaction = maskEmails(stripQuery(event.transaction));
  if (event.contexts) scrubValue(event.contexts, new WeakSet());
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = maskEmails(exception.value);
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
