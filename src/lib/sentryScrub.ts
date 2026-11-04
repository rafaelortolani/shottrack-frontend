import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * Privacidade dos eventos do Sentry (auditoria A09): a URL da página e a das chamadas de rede
 * acompanham o evento, e a query pode carregar token de uso único (`?token=`) ou e-mail.
 * Também mascara e-mails em `transaction`, `contexts`, `message` e na mensagem das exceções e dos breadcrumbs,
 * e troca ids (UUID) de caminhos de URL por `:id` (FUC26: série e foto aparecem em `/api/series/{id}/photos/{id}`).
 * Os três `Sentry.init` (navegador, Node e edge) usam estas opções.
 */

/** Remove a query string (`?a=b`) de uma URL, absoluta ou relativa, preservando o fragmento. */
export function stripQuery(url: string): string {
  return url.replace(/\?[^#]*/, "");
}

// sticky: confere só a partir do `lastIndex` (logo depois de uma "/"), nunca varre o texto
const UUID_AT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iy;
const ID_CHAR = /[A-Za-z0-9_-]/;

/**
 * Troca segmentos de caminho que são UUID por `:id` (`/api/series/<uuid>/photos/<uuid>/thumbnail` vira
 * `/api/series/:id/photos/:id/thumbnail`): o id de uma série ou foto identifica um dado do atleta e não ajuda a
 * achar o erro. Funciona em URL (absoluta ou relativa) e em texto com URL dentro (mensagem de exceção).
 *
 * Custo linear: parte de cada "/" e confere os 36 caracteres seguintes (uma checagem de tamanho fixo), sem regex
 * que recomece em toda posição — a mesma lição do `maskEmails`.
 */
export function maskPathIds(text: string): string {
  let slash = text.indexOf("/");
  if (slash === -1) return text;

  let masked = "";
  let copiedUntil = 0;
  while (slash !== -1) {
    const end = slash + 37;
    UUID_AT.lastIndex = slash + 1;
    if (UUID_AT.test(text) && (end >= text.length || !ID_CHAR.test(text[end]))) {
      masked += text.slice(copiedUntil, slash + 1) + ":id";
      copiedUntil = end;
      slash = text.indexOf("/", end);
    } else {
      slash = text.indexOf("/", slash + 1);
    }
  }
  return masked + text.slice(copiedUntil);
}

/** URL sem query e sem ids no caminho. */
function scrubUrl(url: string): string {
  return maskPathIds(stripQuery(url));
}

const LOCAL_CHAR = /[A-Za-z0-9._%+-]/;
// sticky: casa só a partir do `lastIndex` (o que vem depois do "@"), sem varrer o texto inteiro
const DOMAIN = /[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/y;

/**
 * Troca qualquer e-mail dentro de um texto por `[email]` (mensagens de erro do backend repetem o e-mail do atleta).
 *
 * A busca parte de cada "@" e expande para os lados. Uma regex única (`[local]+@dominio`) tenta casar a partir de
 * cada posição de uma sequência longa de caracteres de palavra e custa tempo quadrático (50 000 caracteres sem "@"
 * levavam ~10 s no `beforeSend`). Aqui o custo é linear: a parte local para no "@" anterior e o domínio, no seguinte.
 */
export function maskEmails(text: string): string {
  let at = text.indexOf("@");
  if (at === -1) return text;

  let masked = "";
  let copiedUntil = 0;
  while (at !== -1) {
    let start = at;
    while (start > copiedUntil && LOCAL_CHAR.test(text[start - 1])) start--;

    DOMAIN.lastIndex = at + 1;
    const domain = start < at ? DOMAIN.exec(text) : null;
    if (domain) {
      masked += text.slice(copiedUntil, start) + "[email]";
      copiedUntil = at + 1 + domain[0].length;
      at = text.indexOf("@", copiedUntil);
    } else {
      at = text.indexOf("@", at + 1);
    }
  }
  return masked + text.slice(copiedUntil);
}

const URL_LIKE = /^(?:https?:\/\/|\/)\S*$/;

/** Percorre `contexts` (objetos aninhados): mascara e-mails e tira a query de valores que são URL. Tolera ciclos. */
function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return maskEmails(URL_LIKE.test(value) ? scrubUrl(value) : value);
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
  return typeof value === "string" ? scrubUrl(value) : value;
}

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    const headers = event.request.headers;
    if (headers) {
      for (const name of Object.keys(headers)) {
        if (/^(referer|referrer)$/i.test(name)) headers[name] = scrubUrl(headers[name]);
      }
    }
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }
  if (event.message) event.message = maskPathIds(maskEmails(event.message));
  if (event.logentry?.message) event.logentry.message = maskPathIds(maskEmails(event.logentry.message));
  if (event.transaction) event.transaction = maskEmails(scrubUrl(event.transaction));
  if (event.contexts) scrubValue(event.contexts, new WeakSet());
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = maskPathIds(maskEmails(exception.value));
  }
  return event;
}

/** Navegação (`from`/`to`) e fetch/xhr (`url`) levam a URL nos dados do breadcrumb; a mensagem pode ter e-mail. */
export function scrubBreadcrumb<T extends Breadcrumb>(breadcrumb: T): T {
  if (breadcrumb.message) breadcrumb.message = maskPathIds(maskEmails(breadcrumb.message));
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
