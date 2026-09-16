# FUC08 - Acervo: Munições

## Objetivo
Permitir que o atleta cadastre, liste, edite e exclua munições do seu
acervo — com cadastro parcial (diferente de Armas).

## Estrutura de navegação
Aba "Munições" dentro de Acervo (irmã de Armas/Acessórios).

Rotas: `/acervo/municoes` (lista), `/acervo/municoes/nova` (cadastro),
`/acervo/municoes/[id]` (edição).

## Referência backend
- UC13 (cadastrar) — `POST /api/ammunitions`
- UC14 (listar) — `GET /api/ammunitions`
- UC15 (editar, parcial) — `PATCH /api/ammunitions/{id}`
- UC16 (excluir) — `DELETE /api/ammunitions/{id}`
- Catálogo de fabricante: endpoint próprio (conferir Swagger); calibre
  reaproveita `GET /api/weapon-catalog/calibers`

## Tela de cadastro (mockup já validado)
- Fabricante (seleção, opcional) e Apelido (texto, opcional) em destaque,
  com indicador visual "· opcional" — pelo menos um dos dois é obrigatório
  (validação de negócio, não simples required de campo)
- Seção "Detalhes adicionais (opcional)": Calibre, Peso do projétil,
  Quantidade de pólvora e Lote em **grade 2 colunas** (não empilhados
  verticalmente); Observações ocupa a linha inteira abaixo da grade

## Lista de munições
Busca por texto (fabricante/apelido) e filtro por calibre — mesmo padrão
já aplicado na lista de Armas, client-side, aparecendo só quando há mais
de um item.

## Tela de edição
Mesma estrutura do cadastro, mas **edição parcial** (só os campos
alterados são enviados no PATCH) — diferente do padrão de Armas, que
reenvia tudo. Mesma regra de "fabricante OU apelido" se aplica ao estado
final após a edição.

## Estados
- Carregando lista/catálogo
- Erro `AMMUNITION_IDENTIFICATION_REQUIRED`: "Informe ao menos o
  fabricante ou um apelido"
- Exclusão bloqueada (`AMMUNITION_IN_USE`) — mesmo padrão visual já usado
  no bloqueio de exclusão de arma
- Lista vazia: convite pra cadastrar a primeira munição

## Definição de pronto
- [ ] Tela de cadastro reflete o mockup validado
- [ ] Cadastro só com fabricante funciona
- [ ] Cadastro só com apelido funciona
- [ ] Erro de identificação ausente exibido corretamente
- [ ] Lista mostra as munições do atleta, estado vazio tratado
- [ ] Edição parcial funciona (só o campo alterado muda)
- [ ] Exclusão bem-sucedida e bloqueio de exclusão tratados
- [ ] Teste E2E (Playwright) cobrindo cadastro (só fabricante, só apelido),
  listagem, edição parcial, exclusão

## Referências
- Backend: UC13, UC14, UC15, UC16, ADR-0006, ADR-0007