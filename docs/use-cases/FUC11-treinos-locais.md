# FUC11 - Treinos: Locais

## Objetivo
Permitir que o atleta cadastre, liste, edite e exclua locais de treino.

## Estrutura de navegação
Item "Treinos" na nav principal (hoje placeholder) passa a ter conteúdo
real: por enquanto só a lista de Locais, sem abas ainda (não há outra
seção pra dividir). Quando Visita existir (próximo bloco da Fase 3),
reestrutura pra abas "Locais | Visitas", mesmo padrão já usado em
Usuário/Acervo — não implementar isso agora, só deixar registrado.

Rotas: `/treinos` (lista de locais, tela padrão), `/treinos/locais/novo`
(cadastro), `/treinos/locais/[id]` (edição).

## Referência backend
- UC24 (cadastrar) — `POST /api/training-locations` (conferir rota exata
  no Swagger)
- UC25 (listar) — `GET /api/training-locations`
- UC26 (editar, parcial) — `PATCH /api/training-locations/{id}`
- UC27 (excluir) — `DELETE /api/training-locations/{id}`

## Tela de cadastro/edição
- Nome (texto, obrigatório)
- Cidade (texto, obrigatório)
- Estado (seleção, obrigatório — lista fixa das 27 UFs brasileiras,
  hardcoded no frontend, sem endpoint de catálogo; é uma lista universal
  que não muda)
- Edição é parcial — só os campos alterados são enviados, mesmo padrão de
  Munição

## Lista de locais
- Busca por texto (nome/cidade) e filtro por estado — mesmo padrão já
  usado nas listas do Acervo, aparecendo só quando há mais de um item
- Estado vazio: convite pra cadastrar o primeiro local
- Ícone da categoria: `IconMapPin`, acento `accent-target` (mesma família
  visual de Treinos definida na skill)

## Estados
- Exclusão bloqueada (`TRAINING_LOCATION_IN_USE`) — mesmo padrão visual já
  usado no bloqueio de exclusão de arma/munição/acessório

## Definição de pronto
- [ ] Cadastro funciona (nome, cidade, estado)
- [ ] Lista mostra os locais do atleta, com busca e filtro por estado,
  estado vazio tratado
- [ ] Edição parcial funciona
- [ ] Exclusão bem-sucedida funciona
- [ ] Teste E2E (Playwright) cobrindo: cadastro, listagem, busca/filtro,
  edição parcial, exclusão

## Referências
- Backend: UC24, UC25, UC26, UC27, ADR-0006, ADR-0010