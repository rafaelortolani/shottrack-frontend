# ShotTrack Frontend

Frontend web do ShotTrack, feito em Next.js. Também atua como BFF: os
tokens JWT do backend nunca são expostos ao navegador, ficam em cookies
httpOnly geridos pelo próprio servidor Next.js.

## Pré-requisitos
- Node.js 20+
- Backend do ShotTrack rodando (`shottrack-backend`, porta 8080)

## Rodando localmente
1. `cp .env.example .env.local`
2. `npm install`
3. `npm run dev`
4. Abre `http://localhost:3000`

## Ambiente de teste do E2E
Os testes E2E (Playwright) rodam contra o frontend e o backend **reais**, mas num ambiente
**isolado** que nunca toca o de desenvolvimento:

| Recurso | Desenvolvimento | E2E |
|---|---|---|
| Backend | `localhost:8080` | `localhost:8090` |
| Banco (Postgres) | `shottrack` | `shottrack_test` |
| RabbitMQ | vhost `/` | vhost `shottrack_test` |
| Mailpit | SMTP 1025 / web 8025 | SMTP 1026 / web 8026 (container `shottrack-e2e-mailpit`) |
| Front | `next dev` em `3000` (`.next`) | build de produção em `3091`; `next dev` em `3093` só para o projeto `dev` (`.next-e2e*`) |

**Como rodar**
1. No `shottrack-backend`: `docker compose up -d` (Postgres e RabbitMQ no ar; o Mailpit de teste o script cria).
2. Aqui: `npm install` e `npx playwright install chromium` (uma vez).
3. `npm run test:e2e` — o Playwright sobe sozinho o backend de teste (`scripts/e2e-backend.sh`, a partir
   de uma **cópia** de `../shottrack-backend` (compilada em `/tmp`, sem tocar no `target/` do repositório; outro caminho em `SHOTTRACK_BACKEND_DIR`) e os servidores de front, e os encerra no fim.
   Pode rodar com o `npm run dev` de desenvolvimento ligado: portas e diretórios de build são outros.

**O banco de teste começa vazio.** A cada execução o script derruba e recria o banco `shottrack_test`,
o vhost do RabbitMQ e o Mailpit de teste, então os testes não precisam limpar o que criam (usuários,
regras de habitualidade etc.) e nada se acumula. O backend de teste usa JWT próprio, Sentry desligado e
limites **por IP** altos (cadastro, conclusão do cadastro, redefinição e refresh); os limites por e-mail e por usuário são os reais.

**Travas** (`tests/e2e-env.ts`, `tests/global-setup.ts`): o E2E recusa rodar se `E2E_BACKEND_URL`,
`E2E_BASE_URL`, `E2E_DEV_BASE_URL` ou `E2E_MAILPIT_URL` não forem os de teste (as portas 8080 e 3000 são
barradas); se o processo na porta 8090 apontar para outro banco; se um usuário criado pelo backend não
aparecer no `shottrack_test`; ou se o front de teste não estiver ligado ao backend de teste. Os helpers de
SQL só enxergam `shottrack_test`.

**Variáveis**: `E2E_REUSE=1` reaproveita servidores já no ar (não recria o banco — útil para repetir um
spec; os dados acumulam até a próxima subida limpa). O front do E2E é um **build de produção** (rápido e
sem compilar rota na primeira visita); o `next dev` de teste só sobe para o projeto `dev`, que roda os testes
marcados `@dev` (comportamento que só existe em desenvolvimento). Para remover o Mailpit de teste: `docker rm -f shottrack-e2e-mailpit`.

**`next-env.d.ts` e `tsconfig.json` modificados**: ao subir ou compilar com um `distDir` diferente de `.next`
(`.next-e2e*`, ou `NEXT_DIST_DIR=...`), o próprio Next reescreve esses dois arquivos versionados: aponta o
`next-env.d.ts` para `<distDir>/types` e acrescenta `<distDir>/types/**/*.ts` ao `include` do `tsconfig.json`
(reformatando o JSON). Não há opção do Next para evitar isso. O `npm run test:e2e` os restaura sozinho ao
terminar (`restoreNextGeneratedFilesOnExit`); depois de um `next build`/`next dev` manual com outro
`distDir`, descarte com `git checkout -- next-env.d.ts tsconfig.json`. As pastas `.next-*/` estão no `.gitignore`.

## Sistema de design
| Token | Cor | Uso |
|---|---|---|
| `background` | `#14150F` | Gunmetal/oliva escuro, fundo |
| `surface` | `#1E2018` | Painéis |
| `foreground` | `#E8E2D0` | Texto principal |
| `foreground-muted` | `#8C8878` | Texto secundário |
| `accent-target` | `#C9A876` | Desert tan — ação primária, Armas |
| `accent-brass` | `#D4713C` | Laranja queimado — secundário, Munições |
| `accent-sage` | `#6E7A4F` | Oliva — Acessórios |

Tipografia: **Rajdhani** (títulos/números), **IBM Plex Sans** (corpo).

## Telas prontas (protótipo)
- `/login` — autenticação
- `/dashboard` — esqueleto do dashboard, com dados fictícios

## Documentação do projeto
- [`CLAUDE.md`](CLAUDE.md)
- [`docs/use-cases/`](docs/use-cases)
- [`docs/adr/`](docs/adr)
- [`.claude/skills/`](.claude/skills)

## Roadmap
- [x] Sistema de design (tokens, tipografia)
- [x] Login (BFF com cookie httpOnly)
- [x] Esqueleto do dashboard
- [ ] Integração real do dashboard com o backend
- [ ] Telas de Acervo (armas, munições, acessórios)
- [ ] Telas de Treino (Fase 3 do roadmap de produto)
