import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { NextRequest } from "next/server";
import { createUser, randomEmail } from "./helpers";
import { GET as listPhotos, POST as uploadPhoto } from "../src/app/api/series/[id]/photos/route";
import { DELETE as deletePhoto } from "../src/app/api/series/[id]/photos/[photoId]/route";
import { GET as photoContent } from "../src/app/api/series/[id]/photos/[photoId]/content/route";
import { GET as photoThumbnail } from "../src/app/api/series/[id]/photos/[photoId]/thumbnail/route";

/**
 * FUC26 (foto do alvo), Lote 1 — BFF. O backend ainda não implementa as rotas de foto (só os UC60–62), então:
 *  - a primeira parte roda contra o BFF real e só cobre o que independe do backend (id, sessão, origem, tamanho);
 *  - a segunda chama os handlers direto, com o `fetch` do backend substituído, para conferir streaming,
 *    cabeçalhos e repasse de erros.
 */
const SENHA = "senha12345";
const SERIE = "11111111-1111-4111-8111-111111111111";
const FOTO = "22222222-2222-4222-8222-222222222222";
const MB = 1024 * 1024;

async function login(request: APIRequestContext) {
  const email = randomEmail();
  await createUser(email);
  expect((await request.post("/api/auth/login", { data: { email, password: SENHA } })).status()).toBe(200);
}

function multipart(bytes: number) {
  const boundary = "----shottrack";
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { boundary, body: Buffer.concat([head, Buffer.alloc(bytes, 1), tail]) };
}

test.describe("FUC26 — BFF de fotos (BFF real)", () => {
  test("ids que não são UUID dão 400 nas cinco rotas, sem chegar ao backend", async ({ request }) => {
    await login(request);
    const ruim = "..%2F..%2Fapi%2Fusers%2Fme%3F";
    expect((await request.get(`/api/series/${ruim}/photos`)).status()).toBe(400);
    expect((await request.get(`/api/series/${SERIE}/photos/${ruim}/content`)).status()).toBe(400);
    expect((await request.get(`/api/series/${SERIE}/photos/nao-uuid/thumbnail`)).status()).toBe(400);
    expect((await request.delete(`/api/series/${SERIE}/photos/${ruim}`)).status()).toBe(400);
    const { boundary, body } = multipart(10);
    const up = await request.post(`/api/series/nao-uuid/photos`, {
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "x-shottrack-upload": "1" },
      data: body,
    });
    expect(up.status()).toBe(400);
  });

  test("sem sessão: 401 em todas as rotas", async ({ playwright, baseURL }) => {
    const anon = await playwright.request.newContext({ baseURL });
    expect((await anon.get(`/api/series/${SERIE}/photos`)).status()).toBe(401);
    expect((await anon.get(`/api/series/${SERIE}/photos/${FOTO}/content`)).status()).toBe(401);
    expect((await anon.get(`/api/series/${SERIE}/photos/${FOTO}/thumbnail`)).status()).toBe(401);
    expect((await anon.delete(`/api/series/${SERIE}/photos/${FOTO}`)).status()).toBe(401);
    const { boundary, body } = multipart(10);
    const up = await anon.post(`/api/series/${SERIE}/photos`, {
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "x-shottrack-upload": "1" },
      data: body,
    });
    expect(up.status()).toBe(401);
    await anon.dispose();
  });

  test("upload: origem de outro site → 403; multipart sem o cabeçalho próprio → 415; corpo não multipart → 415", async ({ request }) => {
    await login(request);
    const { boundary, body } = multipart(10);
    const contentType = `multipart/form-data; boundary=${boundary}`;

    const cross = await request.post(`/api/series/${SERIE}/photos`, {
      headers: { "Content-Type": contentType, "x-shottrack-upload": "1", Origin: "https://evil.example" },
      data: body,
    });
    expect(cross.status()).toBe(403);

    const crossSite = await request.post(`/api/series/${SERIE}/photos`, {
      headers: { "Content-Type": contentType, "x-shottrack-upload": "1", "Sec-Fetch-Site": "cross-site" },
      data: body,
    });
    expect(crossSite.status()).toBe(403);

    // formulário HTML cross-site não manda o cabeçalho próprio
    const semCabecalho = await request.post(`/api/series/${SERIE}/photos`, { headers: { "Content-Type": contentType }, data: body });
    expect(semCabecalho.status()).toBe(415);

    const json = await request.post(`/api/series/${SERIE}/photos`, { data: { a: 1 }, headers: { "x-shottrack-upload": "1" } });
    expect(json.status()).toBe(415);

    // a exceção vale só para essa rota: multipart em outra rota segue 415
    const outra = await request.post(`/api/weapons`, { headers: { "Content-Type": contentType, "x-shottrack-upload": "1" }, data: body });
    expect(outra.status()).toBe(415);
  });

  test("upload com Content-Length acima de 11 MB → 413 PHOTO_TOO_LARGE antes de falar com o backend", async ({ request }) => {
    await login(request);
    const { boundary, body } = multipart(12 * MB);
    const response = await request.post(`/api/series/${SERIE}/photos`, {
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "x-shottrack-upload": "1" },
      data: body,
    });
    expect(response.status()).toBe(413);
    expect((await response.json()).error.code).toBe("PHOTO_TOO_LARGE");
  });

  test("respostas das rotas de foto não são cacheáveis (no-store)", async ({ request }) => {
    await login(request);
    const response = await request.get(`/api/series/${SERIE}/photos/${FOTO}/content`);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });
});

/** Chama o handler com o `fetch` do backend substituído; devolve o que o BFF enviou ao backend. */
async function comBackendSimulado<T>(responder: (url: string, init: RequestInit) => Response | Promise<Response>, rodar: () => Promise<T>) {
  const original = globalThis.fetch;
  const chamadas: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    chamadas.push({ url, init });
    return responder(url, init);
  }) as typeof fetch;
  try {
    return { resultado: await rodar(), chamadas };
  } finally {
    globalThis.fetch = original;
  }
}

function req(path: string, init: RequestInit & { duplex?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", "shottrack_access=jwt-do-atleta");
  return new NextRequest(`http://localhost:3091${path}`, { ...init, headers } as ConstructorParameters<typeof NextRequest>[1]);
}

const ctx = (extra: Record<string, string> = {}) => ({ params: Promise.resolve({ id: SERIE, photoId: FOTO, ...extra }) });

test.describe("FUC26 — handlers de fotos (backend simulado)", () => {
  test("GET content/thumbnail: repassa em streaming só como image/jpeg, com no-store e nosniff, usando o token do cookie", async () => {
    for (const [handler, kind] of [[photoContent, "content"], [photoThumbnail, "thumbnail"]] as const) {
      const { resultado, chamadas } = await comBackendSimulado(
        () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { status: 200, headers: { "Content-Type": "image/jpeg", "Content-Length": "4" } }),
        () => handler(req(`/api/series/${SERIE}/photos/${FOTO}/${kind}`), ctx())
      );
      expect(resultado.status).toBe(200);
      expect(resultado.headers.get("content-type")).toBe("image/jpeg");
      expect(resultado.headers.get("cache-control")).toBe("private, no-store");
      expect(resultado.headers.get("x-content-type-options")).toBe("nosniff");
      expect(new Uint8Array(await resultado.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
      expect(chamadas[0].url).toContain(`/api/series/${SERIE}/photos/${FOTO}/${kind}`);
      expect(new Headers(chamadas[0].init.headers).get("authorization")).toBe("Bearer jwt-do-atleta");
    }
  });

  test("GET content: tipo diferente de image/jpeg vindo do backend vira 502 (nunca repassa tipo ativo como HTML/SVG)", async () => {
    const { resultado } = await comBackendSimulado(
      () => new Response("<svg onload=alert(1)>", { status: 200, headers: { "Content-Type": "image/svg+xml" } }),
      () => photoContent(req(`/api/series/${SERIE}/photos/${FOTO}/content`), ctx())
    );
    expect(resultado.status).toBe(502);
    expect(resultado.headers.get("content-type")).not.toContain("svg");
  });

  test("GET content: PHOTO_NOT_FOUND e SERIES_NOT_FOUND do backend passam com o mesmo status", async () => {
    const { resultado } = await comBackendSimulado(
      () => Response.json({ error: { code: "PHOTO_NOT_FOUND", message: "Foto não encontrada" } }, { status: 404 }),
      () => photoContent(req(`/api/series/${SERIE}/photos/${FOTO}/content`), ctx())
    );
    expect(resultado.status).toBe(404);
    expect((await resultado.json()).error.code).toBe("PHOTO_NOT_FOUND");
  });

  test("POST: repassa o multipart em streaming com o mesmo Content-Type/Length e devolve { data }", async () => {
    const { boundary, body } = multipart(1000);
    const contentType = `multipart/form-data; boundary=${boundary}`;
    let recebido = 0;
    const { resultado, chamadas } = await comBackendSimulado(
      async (_url, init) => {
        const reader = (init.body as ReadableStream<Uint8Array>).getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          recebido += value.byteLength;
        }
        return Response.json({ data: { id: FOTO, position: 1 } }, { status: 201 });
      },
      () =>
        uploadPhoto(
          req(`/api/series/${SERIE}/photos`, {
            method: "POST",
            headers: { "content-type": contentType, "content-length": String(body.length), "x-shottrack-upload": "1" },
            body,
            duplex: "half",
          } as RequestInit),
          ctx()
        )
    );
    expect(resultado.status).toBe(201);
    expect((await resultado.json()).data.id).toBe(FOTO);
    expect(recebido).toBe(body.length);
    const enviado = chamadas[0].init as RequestInit & { duplex?: string };
    expect(enviado.duplex).toBe("half");
    expect(new Headers(enviado.headers).get("content-type")).toBe(contentType);
    expect(new Headers(enviado.headers).get("authorization")).toBe("Bearer jwt-do-atleta");
  });

  test("POST: sem Content-Length → 411; Content-Length acima de 11 MB → 413; corpo que passa do limite no meio do envio → 413", async () => {
    const { boundary, body } = multipart(100);
    const contentType = `multipart/form-data; boundary=${boundary}`;
    const base = { method: "POST", body, duplex: "half" } as RequestInit;
    const semLength = new NextRequest(`http://localhost:3091/api/series/${SERIE}/photos`, {
      ...base,
      headers: { cookie: "shottrack_access=j", "content-type": contentType, "x-shottrack-upload": "1" },
      body: new ReadableStream({ start: (c) => { c.enqueue(body); c.close(); } }),
    } as ConstructorParameters<typeof NextRequest>[1]);
    semLength.headers.delete("content-length");
    expect((await uploadPhoto(semLength, ctx())).status).toBe(411);

    const grande = await uploadPhoto(
      req(`/api/series/${SERIE}/photos`, { ...base, headers: { "content-type": contentType, "content-length": String(11 * MB + 1), "x-shottrack-upload": "1" } }),
      ctx()
    );
    expect(grande.status).toBe(413);

    // Content-Length mentiroso (diz 100 bytes, manda 12 MB): o contador de bytes aborta o repasse
    const enorme = Buffer.alloc(12 * MB, 1);
    const { resultado } = await comBackendSimulado(
      async (_url, init) => {
        const reader = (init.body as ReadableStream<Uint8Array>).getReader();
        for (;;) if ((await reader.read()).done) break; // lança quando o limite estoura
        return Response.json({ data: {} }, { status: 201 });
      },
      () =>
        uploadPhoto(
          req(`/api/series/${SERIE}/photos`, {
            method: "POST",
            headers: { "content-type": contentType, "content-length": "100", "x-shottrack-upload": "1" },
            body: new ReadableStream({ start: (c) => { c.enqueue(enorme); c.close(); } }),
            duplex: "half",
          } as RequestInit),
          ctx()
        )
    );
    expect(resultado.status).toBe(413);
  });

  test("POST: erros do backend (PHOTO_UNSUPPORTED_TYPE 415, PHOTO_LIMIT_PER_SERIES_REACHED 409, 429 com Retry-After) passam como vieram", async () => {
    const { boundary, body } = multipart(50);
    const casos = [
      { status: 415, code: "PHOTO_UNSUPPORTED_TYPE" },
      { status: 409, code: "PHOTO_LIMIT_PER_SERIES_REACHED" },
      { status: 429, code: "RATE_LIMITED", retry: "120" },
    ];
    for (const caso of casos) {
      const { resultado } = await comBackendSimulado(
        async (_url, init) => {
          const reader = (init.body as ReadableStream<Uint8Array>).getReader();
          for (;;) if ((await reader.read()).done) break;
          return Response.json({ error: { code: caso.code, message: "x" } }, { status: caso.status, headers: caso.retry ? { "Retry-After": caso.retry } : {} });
        },
        () =>
          uploadPhoto(
            req(`/api/series/${SERIE}/photos`, {
              method: "POST",
              headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(body.length), "x-shottrack-upload": "1" },
              body,
              duplex: "half",
            } as RequestInit),
            ctx()
          )
      );
      expect(resultado.status).toBe(caso.status);
      expect((await resultado.json()).error.code).toBe(caso.code);
      if (caso.retry) expect(resultado.headers.get("retry-after")).toBe(caso.retry);
    }
  });

  test("DELETE: backend responde 204 sem corpo → { ok: true }; PHOTO_NOT_FOUND passa", async () => {
    const ok = await comBackendSimulado(() => new Response(null, { status: 204 }), () =>
      deletePhoto(req(`/api/series/${SERIE}/photos/${FOTO}`, { method: "DELETE" }), ctx())
    );
    expect(ok.resultado.status).toBe(200);
    expect(await ok.resultado.json()).toEqual({ ok: true });
    expect(ok.chamadas[0].init.method).toBe("DELETE");

    const naoAchou = await comBackendSimulado(
      () => Response.json({ error: { code: "PHOTO_NOT_FOUND", message: "x" } }, { status: 404 }),
      () => deletePhoto(req(`/api/series/${SERIE}/photos/${FOTO}`, { method: "DELETE" }), ctx())
    );
    expect(naoAchou.resultado.status).toBe(404);
    expect((await naoAchou.resultado.json()).error.code).toBe("PHOTO_NOT_FOUND");
  });

  test("GET lista: devolve { data } do backend e repassa SERIES_NOT_FOUND", async () => {
    const lista = await comBackendSimulado(() => Response.json({ data: [{ id: FOTO, position: 1 }] }), () =>
      listPhotos(req(`/api/series/${SERIE}/photos`), ctx())
    );
    expect((await lista.resultado.json()).data).toHaveLength(1);
    const erro = await comBackendSimulado(() => Response.json({ error: { code: "SERIES_NOT_FOUND", message: "x" } }, { status: 404 }), () =>
      listPhotos(req(`/api/series/${SERIE}/photos`), ctx())
    );
    expect(erro.resultado.status).toBe(404);
  });
});

test.describe("FUC26 — upload com fetch real (servidor HTTP de verdade como backend)", () => {
  test("o corpo multipart chega inteiro ao backend, com Content-Type, Content-Length e token, sem ser reescrito", async () => {
    const { boundary, body } = multipart(3 * MB);
    const contentType = `multipart/form-data; boundary=${boundary}`;
    let visto: { length: number; type?: string; len?: string; auth?: string; igual: boolean } | null = null;

    const servidor = createServer((reqHttp, resHttp) => {
      const pedacos: Buffer[] = [];
      reqHttp.on("data", (c: Buffer) => pedacos.push(c));
      reqHttp.on("end", () => {
        const recebido = Buffer.concat(pedacos);
        visto = {
          length: recebido.length,
          type: reqHttp.headers["content-type"],
          len: reqHttp.headers["content-length"],
          auth: reqHttp.headers.authorization,
          igual: recebido.equals(body),
        };
        resHttp.writeHead(201, { "Content-Type": "application/json" });
        resHttp.end(JSON.stringify({ data: { id: FOTO, position: 1 } }));
      });
    });
    await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
    const anterior = process.env.BACKEND_URL;
    process.env.BACKEND_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    try {
      const resposta = await uploadPhoto(
        req(`/api/series/${SERIE}/photos`, {
          method: "POST",
          headers: { "content-type": contentType, "content-length": String(body.length), "x-shottrack-upload": "1" },
          body,
          duplex: "half",
        } as RequestInit),
        ctx()
      );
      expect(resposta.status).toBe(201);
      expect(visto).toEqual({ length: body.length, type: contentType, len: String(body.length), auth: "Bearer jwt-do-atleta", igual: true });
    } finally {
      if (anterior === undefined) delete process.env.BACKEND_URL;
      else process.env.BACKEND_URL = anterior;
      servidor.close();
    }
  });
});
