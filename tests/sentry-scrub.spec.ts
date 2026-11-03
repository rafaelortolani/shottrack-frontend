import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { maskEmails, scrubBreadcrumb, scrubEvent, sentryPrivacyOptions, stripQuery } from "../src/lib/sentryScrub";

/** Auditoria A09: nada de query string (token de uso único, e-mail) nos eventos enviados ao Sentry. Teste unitário, sem navegador. */
test.describe("Sentry — scrubber de URLs (A09)", () => {
  test("stripQuery tira a query de URL absoluta e relativa e preserva caminho e fragmento", () => {
    expect(stripQuery("https://app.shottrack.com/redefinir-senha?token=abc123")).toBe("https://app.shottrack.com/redefinir-senha");
    expect(stripQuery("/cadastro/completar?token=abc&x=1")).toBe("/cadastro/completar");
    expect(stripQuery("/login?conta=excluida#topo")).toBe("/login#topo");
    expect(stripQuery("/dashboard")).toBe("/dashboard");
    expect(stripQuery("")).toBe("");
  });

  test("o evento perde a query de request.url, query_string, cookies e a query do Referer", () => {
    const event = {
      type: undefined,
      request: {
        url: "https://app.shottrack.com/redefinir-senha?token=abc123",
        query_string: "token=abc123",
        cookies: { shottrack_access: "jwt" },
        headers: { Referer: "https://app.shottrack.com/esqueci-senha?email=a@b.com", "User-Agent": "x" },
      },
      breadcrumbs: [{ category: "navigation", data: { from: "/login?a=1", to: "/redefinir-senha?token=abc123" } }],
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);
    expect(scrubbed.request?.url).toBe("https://app.shottrack.com/redefinir-senha");
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers?.Referer).toBe("https://app.shottrack.com/esqueci-senha");
    expect(scrubbed.request?.headers?.["User-Agent"]).toBe("x");
    expect(scrubbed.breadcrumbs?.[0].data).toEqual({ from: "/login", to: "/redefinir-senha" });
    expect(JSON.stringify(scrubbed)).not.toContain("abc123");
  });

  test("evento sem request nem breadcrumbs passa intacto", () => {
    const event = { message: "erro" } as ErrorEvent;
    expect(scrubEvent(event)).toEqual({ message: "erro" });
  });

  test("breadcrumbs de navegação e de fetch/xhr perdem a query; os demais não mudam", () => {
    const navigation = scrubBreadcrumb({ category: "navigation", data: { from: "/a?x=1", to: "/b?token=t" } } as Breadcrumb);
    expect(navigation.data).toEqual({ from: "/a", to: "/b" });

    const fetchCrumb = scrubBreadcrumb({
      category: "fetch",
      data: { url: "/api/series/history?modalityId=1&from=2026-01-01", method: "GET", status_code: 200 },
    } as Breadcrumb);
    expect(fetchCrumb.data).toEqual({ url: "/api/series/history", method: "GET", status_code: 200 });

    const xhr = scrubBreadcrumb({ category: "xhr", data: { url: "https://x.com/api?token=1" } } as Breadcrumb);
    expect(xhr.data?.url).toBe("https://x.com/api");

    const click = scrubBreadcrumb({ category: "ui.click", message: "button#entrar" } as Breadcrumb);
    expect(click).toEqual({ category: "ui.click", message: "button#entrar" });

    // dado que não é string não quebra
    expect(() => scrubBreadcrumb({ data: { url: 42, from: null } } as unknown as Breadcrumb)).not.toThrow();
  });

  test("maskEmails troca e-mails por [email] e deixa o resto do texto", () => {
    expect(maskEmails("Email atleta.teste+1@shottrack.com.br já existe")).toBe("Email [email] já existe");
    expect(maskEmails("a@b.com e c.d@e.org")).toBe("[email] e [email]");
    expect(maskEmails("pacote @sentry/nextjs, sem e-mail")).toBe("pacote @sentry/nextjs, sem e-mail");
    expect(maskEmails("")).toBe("");
  });

  test("transaction perde a query e o e-mail", () => {
    const event = { transaction: "GET /usuario/email?from=atleta@shottrack.com" } as ErrorEvent;
    expect(scrubEvent(event).transaction).toBe("GET /usuario/email");
    expect(scrubEvent({ transaction: "GET /dashboard" } as ErrorEvent).transaction).toBe("GET /dashboard");
  });

  test("contexts: e-mail mascarado e URL sem query em qualquer nível; ciclos e valores não-string não quebram", () => {
    const contexts: Record<string, unknown> = {
      user_info: { contact: "atleta@shottrack.com", nested: { list: ["x@y.com", 7, null], url: "https://app.shottrack.com/redefinir-senha?token=abc123" } },
      route: { path: "/cadastro/completar?token=abc123", note: "texto com ? no meio, sem URL" },
    };
    contexts.self = contexts; // ciclo
    const scrubbed = scrubEvent({ contexts } as unknown as ErrorEvent);
    const user = scrubbed.contexts?.user_info as { contact: string; nested: { list: unknown[]; url: string } };
    expect(user.contact).toBe("[email]");
    expect(user.nested.list).toEqual(["[email]", 7, null]);
    expect(user.nested.url).toBe("https://app.shottrack.com/redefinir-senha");
    const route = scrubbed.contexts?.route as { path: string; note: string };
    expect(route.path).toBe("/cadastro/completar");
    expect(route.note).toBe("texto com ? no meio, sem URL");
  });

  test("mensagem das exceções tem o e-mail mascarado; o tipo e as demais exceções ficam", () => {
    const event = {
      exception: {
        values: [
          { type: "Error", value: "Já existe conta para atleta@shottrack.com" },
          { type: "TypeError", value: undefined },
          { type: "Error", value: "sem e-mail" },
        ],
      },
    } as unknown as ErrorEvent;
    const values = scrubEvent(event).exception?.values;
    expect(values?.[0]).toEqual({ type: "Error", value: "Já existe conta para [email]" });
    expect(values?.[1].value).toBeUndefined();
    expect(values?.[2].value).toBe("sem e-mail");
    expect(JSON.stringify(event)).not.toContain("@shottrack.com");
  });

  test("as opções desligam o PII padrão e ligam os dois hooks", () => {
    expect(sentryPrivacyOptions.sendDefaultPii).toBe(false);
    expect(sentryPrivacyOptions.beforeSend).toBe(scrubEvent);
    expect(sentryPrivacyOptions.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });

  test("navegador, servidor Node e edge usam as opções (nenhum Sentry.init sem scrubbing)", () => {
    for (const file of ["src/instrumentation-client.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("...sentryPrivacyOptions");
      expect(source.match(/Sentry\.init\(/g)?.length, file).toBe(1);
    }
  });
});
