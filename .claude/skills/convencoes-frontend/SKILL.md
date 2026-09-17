---
name: convencoes-frontend
description: Convenções de código do frontend ShotTrack — estrutura Next.js, sistema de design, padrão de BFF. Usar sempre que criar ou alterar páginas, componentes ou Route Handlers.
---

# Convenções de Frontend — ShotTrack

## Estrutura
- `src/app/<rota>/page.tsx` — telas
- `src/app/api/<recurso>/route.ts` — Route Handlers (BFF), nunca chamado direto do cliente sem passar por aqui
- `src/components/` — componentes reutilizáveis
- `src/lib/` — helpers (ex: `backend.ts`, cliente do backend)

## BFF — regra inegociável
Nenhum componente client-side chama `BACKEND_URL` diretamente. Toda
comunicação com o backend passa por um Route Handler em `src/app/api/`, que
é o único lugar que conhece o token JWT (guardado em cookie `httpOnly`).

## Sistema de design
- Cores: sempre via tokens Tailwind definidos em `globals.css`
  (`bg-background`, `bg-surface`, `text-foreground`, `text-foreground-muted`,
  `border-border`) — nunca hex direto num componente.
- Três acentos, cada um com um papel fixo — nunca usar um no lugar do outro:
  - `accent-target` (vermelho) — ação primária / categoria "Armas" ou
    desempenho principal.
  - `accent-brass` (latão) — ação secundária / categoria "Munições" ou
    informação complementar.
  - `accent-sage` (verde-sálvia) — categoria "Acessórios" / terceiro dado
    numa comparação (ex: terceira linha de um gráfico).
  - Botões e ações usam a variante sólida (`bg-accent-target`). Ícones e
    texto de destaque sobre fundo escuro usam a variante `-soft`
    (`text-accent-target-soft`). Fundos tintados (chip, badge, ícone com
    fundo colorido) usam a variante sólida com opacidade via Tailwind:
    `bg-accent-target/15`.
  - Os acentos devem aparecer com presença real (ícones de categoria,
    tags, linhas de gráfico) — não só como detalhe raro num botão. Ao
    mesmo tempo, cada uso precisa ter significado (categoria, estado,
    destaque) — nunca decoração sem propósito.

## Ícones por categoria (fixo — não varia por tipo de item)
Cada categoria do Acervo usa **um único ícone**, sempre o mesmo, em vez de
tentar diferenciar por tipo de item dentro dela (ex: não usar ícone
diferente pra pistola vs. revólver) — biblioteca: `@tabler/icons-react`.

| Categoria | Ícone | Acento |
|---|---|---|
| Armas | `IconFocus2` | `accent-target` |
| Munições | `IconCapsuleHorizontal` | `accent-brass` |
| Acessórios | `IconBackpack` | `accent-sage` |
| Dashboard (nav) | `IconLayoutDashboard` | `accent-target-soft` |
| Treinos (nav) | `IconTarget` | `accent-brass-soft` |
| Acervo (nav) | `IconBriefcase` | `accent-sage-soft` |
| Usuário (nav) | `IconUser` | neutro (`foreground-muted`) |
| Locais de treino | `IconMapPin` | `accent-target` |

Nunca usar ícone literal de arma/munição — nem essa biblioteca teria um, e
a diretriz de identidade visual já pede pra evitar estética tática.
- Tipografia: `font-display` (Space Grotesk) pra títulos e números de
  destaque; `font-sans` (IBM Plex Sans, padrão do body) pro resto.
- Motivo dos anéis concêntricos (`TargetRings`): no máximo uma vez por tela,
  sempre como textura de fundo de baixa opacidade — nunca como ícone
  literal, nunca em primeiro plano.
- Cards com leve fundo (`bg-surface`, sem sombra) são aceitáveis pra
  agrupar estatísticas com ícone de categoria — evitar é a sombra e o
  contorno idênticos em todo canto, não o card em si.

## Densidade — compacto, não espaçoso
Erro recorrente a evitar: espaçamento generoso demais entre elementos,
deixando a tela com sensação de vazio. Referência de escala (Tailwind):
- Padding de container de tela/card: `p-5`/`p-6` (não `p-8`+).
- Gap entre campos de formulário empilhados: `gap-2`/`gap-3` (não `gap-5`+).
- Padding interno de input/botão: `py-2 px-3` (não `py-3`+).
- Linhas de lista: `py-2` entre itens, divisor fino (`border-border`),
  nunca card com borda própria por item — ver seção de cor acima
  (ícone com fundo tintado, sem borda ao redor do item inteiro).
- Fonte de título de tela: `text-base`/`text-lg` (não `text-xl`+); número
  de destaque no dashboard é a exceção (esse sim grande).

## Busca e filtro em listas do Acervo
Toda lista do Acervo (Armas, Munições, Acessórios) inclui busca por texto
e filtro por atributo relevante (ex: tipo, calibre) assim que houver mais
de um item — implementado no cliente, filtrando a lista já carregada
(`GET` sem paginação). Reavaliar para filtro no backend só se o volume
por atleta crescer muito (centenas de itens) — não é o caso hoje.

## Consistência entre mobile e desktop — regra inegociável
Não existe "tema mobile" separado. Os breakpoints (`md:`, `lg:`, etc.)
controlam apenas **layout** — visibilidade de elementos, espaçamento,
tamanho de fonte dentro da escala já definida, organização de nav
(lateral no desktop → barra inferior no mobile). Eles nunca alteram cor,
família tipográfica, ou a presença/ausência do motivo dos anéis
concêntricos. Qualquer variação visual entre tamanhos de tela que não seja
puramente estrutural é um erro, não uma escolha de responsividade.

## Autenticação
- Cookies: `shottrack_access` (1h) e `shottrack_refresh` (7d), sempre
  `httpOnly`, `sameSite: lax`, `secure` em produção.
- `src/proxy.ts` (antigo middleware) protege rotas autenticadas checando a
  presença do cookie — validação de verdade do token acontece no backend a
  cada chamada.

## Testes (obrigatório)
Toda tela nova (FUCxx) é entregue com teste E2E em Playwright, cobrindo o
fluxo principal e pelo menos um erro relevante — mesmo espírito da regra
já aplicada no backend.

- Testes ficam em `tests/<nome-da-tela>.spec.ts`, rodam contra o frontend
  E o backend reais (localhost), nunca mockados — é a integração de
  verdade que mais importa capturar.
- Seletores usam `getByLabel`/`getByRole` (acessibilidade), nunca
  `data-testid` como primeira opção — se um elemento não tem label ou role
  acessível, isso é um problema da tela, não do teste.
- Dados de teste (usuários, etc.) são criados direto via chamada ao
  backend (`tests/helpers.ts`), não preenchendo formulário — só a parte
  que o teste realmente quer validar passa pela UI.
- Rodar com `npm run test:e2e` (ou `test:e2e:ui` pra depurar visualmente).