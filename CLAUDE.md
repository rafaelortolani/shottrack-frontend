# ShotTrack Frontend

Frontend web do ShotTrack — Next.js (App Router), que também atua como BFF:
guarda os tokens JWT do backend em cookies httpOnly, nunca expostos ao
JavaScript do navegador.

## Stack
- Next.js (App Router, TypeScript)
- Tailwind CSS v4 (tokens de design em `src/app/globals.css`)
- Fontes: Space Grotesk (display/números), IBM Plex Sans (corpo)

## Como rodar
1. Backend do ShotTrack rodando em `http://localhost:8080` (ver repositório
   `shottrack-backend`)
2. Copia `.env.example` pra `.env.local`
3. `npm install`
4. `npm run dev` — abre em `http://localhost:3000`

## Arquitetura — BFF embutido
Nenhum componente do lado do cliente chama o backend diretamente. O fluxo é:

```
Navegador → Route Handler (src/app/api/**) → backend (src/lib/backend.ts) → resposta
```

O Route Handler guarda o access/refresh token em cookies `httpOnly` e nunca
os retorna no corpo da resposta pro navegador.

## Sistema de design
Tokens de cor e tipografia estão em `src/app/globals.css` — nunca usar cor
hexadecimal direto num componente, sempre pelas classes Tailwind geradas a
partir desses tokens (`bg-background`, `text-accent-target`, etc.).

Motivo gráfico: anéis concêntricos (`src/components/TargetRings.tsx`), usado
como textura decorativa sutil — nunca mais de uma vez por tela, nunca como
ícone literal de mira.

## Onde estão as coisas
- `docs/use-cases/` — cada tela/fluxo formalizado antes de implementar
- `docs/adr/` — decisões técnicas
- `.claude/skills/` — convenções de código

## Definição de pronto
Nenhuma tela nova (FUCxx) é considerada concluída sem teste E2E (Playwright)
cobrindo o fluxo principal e pelo menos um erro relevante. Sem teste, a
tarefa não está terminada — independente de "funcionar manualmente".

## Regra de ouro
Mesma do backend: não adicionar documentação especulativa. Documentação
nasce do código que já existe.