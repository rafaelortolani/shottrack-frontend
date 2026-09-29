# FUC18 - Histórico completo com filtro

## Objetivo
Permitir consultar todo o histórico de séries do atleta, filtrando por
período, modalidade, arma e distância.

## Referência backend
UC47 — `GET /api/series` (filtros na query), via BFF `GET /api/series/history`

## Estrutura de navegação
Nova rota `/treinos/historico` — item dentro da seção Treinos (aba
irmã de Visitas e Locais). A lista de "visitas recentes" que já existe
(Dashboard, FUC15) ganha um link "Ver histórico completo" apontando pra cá.

## Tela
- Filtros no topo: período (De/Até, mesmo padrão de data já usado em
  Visitas), modalidade (select, dentre as praticadas), arma (select,
  dentre o acervo), distância (mín/máx em metros) — todos opcionais,
  combináveis
- Lista de séries (mais recente primeiro): data, local, modalidade,
  arma, resumo dos resultados registrados — mesmo padrão visual de linha
  compacta já usado em outras listas
- Tocar uma linha abre o detalhe (mesmo card de edição do FUC14, mas em
  modo consulta se o treino já estiver encerrado — ainda editável, já que
  UC38 permite completar depois mesmo com treino fechado)

## Estados
- Nenhum filtro aplicado: mostra tudo
- Filtro sem resultado: estado vazio "Nenhuma série encontrada com esses
  filtros", com opção de limpar os filtros
- Carregando

## Definição de pronto
- [ ] Cada filtro funciona isoladamente
- [ ] Filtros combinados funcionam juntos
- [ ] Estado vazio com filtro tratado, com opção de limpar
- [ ] Link "Ver histórico completo" no Dashboard leva pra cá
- [ ] Teste E2E (Playwright) cobrindo: aplicar cada filtro, combinar
  2 filtros, limpar filtros, abrir o detalhe de uma série pela lista

## Referências
- Backend: UC47
- FUC14 (Registro de série — reaproveita o card de edição)
- FUC15 (Dashboard — origem do link)