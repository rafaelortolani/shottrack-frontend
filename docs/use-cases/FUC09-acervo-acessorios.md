# FUC09 - Acervo: Acessórios

## Objetivo
Permitir que o atleta cadastre, liste, edite e exclua acessórios, e os
associe a uma ou mais armas do acervo.

## Estrutura de navegação
Aba "Acessórios" dentro de Acervo (irmã de Armas/Munições).

Rotas: `/acervo/acessorios` (lista), `/acervo/acessorios/novo` (cadastro),
`/acervo/acessorios/[id]` (edição, incluindo associação com armas).

## Referência backend
- UC17 (cadastrar) — `POST /api/accessories`
- UC18 (listar) — `GET /api/accessories`
- UC19 (associar/desassociar arma) — `POST /api/accessories/{accessoryId}/weapons`,
  `DELETE /api/accessories/{accessoryId}/weapons/{weaponId}`
- UC20 (editar) — `PATCH /api/accessories/{id}`
- UC21 (excluir) — `DELETE /api/accessories/{id}`

## Tela de cadastro
- Nome (obrigatório), Tipo (texto livre, opcional), Observações (opcional)
- Cadastro rápido — sem seleção de arma nesse momento (associação é uma
  ação separada, feita depois, na tela de edição)

## Lista de acessórios
- Busca por nome/tipo — mesmo padrão de busca já usado em Armas/Munições
- Cada item mostra, se houver, as armas associadas (resumo compacto,
  ex: "2 armas")
- Estado vazio: convite pra cadastrar o primeiro acessório

## Tela de edição
- Campos de nome/tipo/observações (mesma estrutura do cadastro)
- Seção "Armas associadas": lista das armas já associadas (com opção de
  desassociar) + seletor pra associar uma arma nova do acervo
- Botão "Excluir acessório" — remove o acessório e as associações junto
  (sem bloqueio por associação, conforme ADR-0006/ADR-0008); bloqueado
  apenas se já usado em série (`ACCESSORY_IN_USE`, sem efeito prático
  ainda, já que Série não existe)

## Definição de pronto
- [ ] Cadastro funciona (nome obrigatório, resto opcional)
- [ ] Lista mostra os acessórios do atleta, com busca, estado vazio tratado
- [ ] Associar uma arma a um acessório funciona (e um acessório pode ter
  mais de uma arma associada — N:N)
- [ ] Desassociar funciona sem afetar outras associações
- [ ] Edição de nome/tipo/observações funciona
- [ ] Exclusão bem-sucedida remove as associações junto
- [ ] Teste E2E (Playwright) cobrindo: cadastro, associar a 2 armas,
  desassociar uma, editar, excluir

## Referências
- Backend: UC17, UC18, UC19, UC20, UC21, ADR-0006, ADR-0008