# FUC12 - Usuário > Modalidades: configurar tipos de resultado

## Objetivo
Permitir que o atleta veja e ajuste quais tipos de resultado quer
acompanhar em cada modalidade que pratica (Perfil de Modalidade).

## Estrutura de navegação
Não é uma tela nova — se integra na aba "Modalidades" já existente
(FUC06, `/usuario/modalidades`). Cada chip de modalidade **marcada**
(praticada) ganha um ícone de engrenagem (`IconAdjustments`), que abre um
painel (modal/sheet) com a configuração de tipos de resultado daquela
modalidade. Chips desmarcadas não têm esse ícone — só faz sentido
configurar resultado de algo que o atleta pratica.

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
- [ ] Ícone de configurar aparece só em modalidades marcadas
- [ ] Painel abre mostrando a sugestão padrão já aplicada (não vazio)
- [ ] Marcar um tipo de resultado novo funciona
- [ ] Desmarcar um tipo funciona sem afetar os demais
- [ ] Teste E2E (Playwright) cobrindo: adicionar modalidade praticada,
  abrir configuração e confirmar que a sugestão padrão já veio marcada,
  adicionar um tipo, remover um tipo

## Referências
- Backend: UC29, UC30, ADR-0011
- FUC06 (tela de Modalidades — este use case estende ela, não substitui)