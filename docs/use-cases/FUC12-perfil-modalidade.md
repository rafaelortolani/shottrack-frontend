# FUC12 - Usuário > Modalidades: configurar tipos de resultado

## Objetivo
Permitir que o atleta veja e ajuste quais tipos de resultado quer
acompanhar em cada modalidade que pratica (Perfil de Modalidade).

## Estrutura de navegação
Não é uma tela nova — se integra na aba "Modalidades" já existente
(FUC06, `/usuario/modalidades`). Abaixo dos chips de seleção (marcar/
desmarcar modalidade praticada), uma seção separada e sempre visível,
**"Resultados por modalidade"**: uma lista (mesmo padrão visual do resumo
de Email/Senha na tela de Perfil), um item por modalidade **praticada**,
cada um mostrando um resumo dos tipos já configurados (ex: "Pontuação,
Agrupamento") e um link "Configurar" que abre o painel de ajuste. Item
some da lista automaticamente quando a modalidade é desmarcada nos chips.

## Referência backend
- UC29 (catálogo de tipos de resultado) — `GET /api/result-type-catalog`
- UC30 (consultar/ajustar perfil de modalidade) —
  `GET/POST /api/practiced-modalities/{modalityId}/result-types`,
  `DELETE /api/practiced-modalities/{modalityId}/result-types/{resultTypeId}`

## Painel de configuração
- Título: nome da modalidade (ex: "Precisão — tipos de resultado")
- Grade de chips (mesmo padrão visual da tela de Modalidades): um por
  tipo de resultado do catálogo, marcado se já configurado pra essa
  modalidade
- Ao abrir pela primeira vez, os tipos já vêm com a sugestão padrão
  aplicada automaticamente pelo backend (ADR-0011) — a tela só reflete o
  que a API retorna, não decide sugestão nenhuma no cliente
- Tocar um chip marca/desmarca (mesma lógica de toggle da tela principal
  de Modalidades)

## Estados
- Carregando catálogo + configuração atual
- Marcando/desmarcando: feedback imediato, sem precisar de botão "salvar"
  separado (mesmo padrão da tela de Modalidades)
- Erro ao adicionar/remover: mensagem inline, sem fechar o painel

## Definição de pronto
- [ ] Lista "Resultados por modalidade" mostra só as modalidades marcadas,
  com resumo dos tipos configurados
- [ ] Item some da lista quando a modalidade correspondente é desmarcada
  nos chips
- [ ] Painel abre mostrando a sugestão padrão já aplicada (não vazio)
- [ ] Marcar um tipo de resultado novo funciona, resumo na lista atualiza
- [ ] Desmarcar um tipo funciona sem afetar os demais, resumo atualiza
- [ ] Teste E2E (Playwright) cobrindo: adicionar modalidade praticada,
  confirmar que ela aparece na lista de resultados com a sugestão padrão
  já resumida, abrir configuração, adicionar um tipo, remover um tipo

## Referências
- Backend: UC29, UC30, ADR-0011
- FUC06 (tela de Modalidades — este use case estende ela, não substitui)