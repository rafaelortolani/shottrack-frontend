import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { maskEmails, maskPathIds, scrubBreadcrumb, scrubEvent, sentryPrivacyOptions, stripQuery } from "../src/lib/sentryScrub";

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

  test("maskEmails: 200 000 caracteres sem @ (e outras entradas adversárias) processam em menos de 500 ms", () => {
    const entradas = [
      "a".repeat(200_000),
      "a@".repeat(100_000),
      "a.".repeat(100_000) + "@x",
      "x@" + "a.".repeat(100_000),
      "@".repeat(200_000),
    ];
    for (const entrada of entradas) {
      const inicio = performance.now();
      maskEmails(entrada);
      expect(performance.now() - inicio, entrada.slice(0, 12)).toBeLessThan(500); // o custo quadrático levava ~109 s; 500 ms aguenta máquina carregada
    }
  });

  test("maskEmails: e-mails em posições variadas continuam mascarados", () => {
    expect(maskEmails("ana@x.com")).toBe("[email]");
    expect(maskEmails("Erro: ana@x.com.br.")).toBe("Erro: [email].");
    expect(maskEmails("(a.b-c+d%e_f@sub.dominio.io)")).toBe("([email])");
    expect(maskEmails("a@b.co,c@d.org;e@f.net")).toBe("[email],[email];[email]");
    expect(maskEmails("@ sozinho, a@b sem tld, @x.com sem local")).toBe("@ sozinho, a@b sem tld, @x.com sem local");
    expect(maskEmails("x@y.com " + "z".repeat(5000) + " fim@y.com")).toBe("[email] " + "z".repeat(5000) + " [email]");
  });

  test("event.message, logentry.message e a mensagem dos breadcrumbs têm o e-mail mascarado", () => {
    const event = {
      message: "Falha ao enviar para atleta@shottrack.com",
      logentry: { message: "Conta %s já existe", formatted: "x" },
      breadcrumbs: [
        { category: "console", message: "login de atleta@shottrack.com falhou" },
        { category: "ui.click", message: "button#entrar" },
      ],
    } as unknown as ErrorEvent;
    const scrubbed = scrubEvent(event);
    expect(scrubbed.message).toBe("Falha ao enviar para [email]");
    expect(scrubbed.breadcrumbs?.[0].message).toBe("login de [email] falhou");
    expect(scrubbed.breadcrumbs?.[1].message).toBe("button#entrar");
    expect(scrubBreadcrumb({ message: "a@b.com" } as Breadcrumb).message).toBe("[email]");
    expect(JSON.stringify(scrubbed)).not.toContain("@shottrack.com");
  });

  test("maskPathIds troca UUIDs de caminho por :id e preserva o resto", () => {
    const sid = "6a1c2f4e-1111-4222-8333-444455556666";
    const pid = "7B2D3E5F-AAAA-4BBB-8CCC-DDDDEEEEFFFF";
    expect(maskPathIds(`/api/series/${sid}/photos/${pid}/thumbnail`)).toBe("/api/series/:id/photos/:id/thumbnail");
    expect(maskPathIds(`https://app.shottrack.com/api/series/${sid}/photos`)).toBe("https://app.shottrack.com/api/series/:id/photos");
    expect(maskPathIds(`/api/series/${sid}`)).toBe("/api/series/:id");
    expect(maskPathIds(`/${sid}/`)).toBe("/:id/");
    expect(maskPathIds(`Falha ao buscar /api/series/${sid}/photos (404)`)).toBe("Falha ao buscar /api/series/:id/photos (404)");
    // não é UUID de caminho: nada muda
    expect(maskPathIds("/api/series/history")).toBe("/api/series/history");
    expect(maskPathIds(`/api/x/${sid}extra`)).toBe(`/api/x/${sid}extra`); // UUID colado em mais caracteres
    expect(maskPathIds(`/api/x/${sid.slice(0, 35)}`)).toBe(`/api/x/${sid.slice(0, 35)}`); // curto demais
    expect(maskPathIds(`id=${sid}`)).toBe(`id=${sid}`); // sem "/" antes: não é segmento de caminho
    expect(maskPathIds("sem barra")).toBe("sem barra");
    expect(maskPathIds("")).toBe("");
  });

  test("breadcrumbs, request, transaction, contexts e exceções perdem os ids de caminho", () => {
    const sid = "6a1c2f4e-1111-4222-8333-444455556666";
    const pid = "7b2d3e5f-aaaa-4bbb-8ccc-ddddeeeeffff";
    const fetchCrumb = scrubBreadcrumb({ category: "fetch", data: { url: `/api/series/${sid}/photos/${pid}/thumbnail?t=1`, method: "GET" } } as Breadcrumb);
    expect(fetchCrumb.data?.url).toBe("/api/series/:id/photos/:id/thumbnail");
    const xhr = scrubBreadcrumb({ category: "xhr", data: { url: `https://app.shottrack.com/api/series/${sid}/photos` } } as Breadcrumb);
    expect(xhr.data?.url).toBe("https://app.shottrack.com/api/series/:id/photos");
    const nav = scrubBreadcrumb({ category: "navigation", data: { from: `/treinos/${sid}`, to: "/dashboard" } } as Breadcrumb);
    expect(nav.data).toEqual({ from: "/treinos/:id", to: "/dashboard" });

    const event = {
      transaction: `GET /api/series/${sid}/photos/${pid}/content`,
      request: { url: `https://app.shottrack.com/api/series/${sid}/photos?x=1`, headers: { Referer: `https://app.shottrack.com/treinos/${sid}?a=1` } },
      contexts: { rota: { path: `/api/series/${sid}/photos/${pid}` } },
      exception: { values: [{ type: "TypeError", value: `Failed to fetch /api/series/${sid}/photos/${pid}/thumbnail` }] },
      message: `erro em /api/series/${sid}`,
    } as unknown as ErrorEvent;
    const scrubbed = scrubEvent(event);
    expect(scrubbed.transaction).toBe("GET /api/series/:id/photos/:id/content");
    expect(scrubbed.request?.url).toBe("https://app.shottrack.com/api/series/:id/photos");
    expect(scrubbed.request?.headers?.Referer).toBe("https://app.shottrack.com/treinos/:id");
    expect((scrubbed.contexts?.rota as { path: string }).path).toBe("/api/series/:id/photos/:id");
    expect(scrubbed.exception?.values?.[0].value).toBe("Failed to fetch /api/series/:id/photos/:id/thumbnail");
    expect(scrubbed.message).toBe("erro em /api/series/:id");
    expect(JSON.stringify(scrubbed)).not.toContain(sid);
    expect(JSON.stringify(scrubbed)).not.toContain(pid);
  });

  test("maskPathIds: 200 000 caracteres (barras, hex e UUIDs repetidos) processam em menos de 500 ms", () => {
    const uuid = "6a1c2f4e-1111-4222-8333-444455556666";
    const entradas = [
      "/".repeat(200_000),
      "a".repeat(200_000),
      ("/" + "a".repeat(35)).repeat(5_500),
      ("/" + uuid).repeat(5_400),
      ("/" + uuid.slice(0, 35)).repeat(5_500),
      "/".repeat(100_000) + uuid + "/".repeat(100_000),
    ];
    for (const entrada of entradas) {
      const inicio = performance.now();
      maskPathIds(entrada);
      expect(performance.now() - inicio, entrada.slice(0, 12)).toBeLessThan(500);
    }
    expect(maskPathIds(("/" + uuid).repeat(3))).toBe("/:id/:id/:id");
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
