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

## Sistema de design
| Token | Cor | Uso |
|---|---|---|
| `background` | `#1A1917` | Grafite quente, fundo |
| `surface` | `#24221E` | Painéis |
| `foreground` | `#F1EFE9` | Texto principal |
| `foreground-muted` | `#9C968A` | Texto secundário |
| `accent-target` | `#A6323A` | Destaque principal (recorde, ação primária) |
| `accent-brass` | `#B8863B` | Destaque secundário |

Tipografia: **Space Grotesk** (títulos/números), **IBM Plex Sans** (corpo).

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
