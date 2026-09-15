# FUC06 - Modalidades praticadas

## Objetivo
Permitir que o atleta veja e gerencie quais modalidades pratica.

## Referência backend
- UC11 (catálogo de modalidades) — `GET /api/modality-catalog`
- UC12 (gerenciar modalidades praticadas) — `GET/POST /api/practiced-modalities`,
  `DELETE /api/practiced-modalities/{modalityId}`

## Layout
- Lista das modalidades já praticadas, cada uma com um "x" pra remover
- Abaixo (ou num modal/dropdown), lista do catálogo completo — clicar numa
  modalidade ainda não adicionada, adiciona ela
- Modalidades já praticadas não aparecem mais como opção pra adicionar de novo

## Estados da tela
- Carregando: enquanto busca catálogo + praticadas
- Vazio: nenhuma modalidade praticada ainda — mensagem convidando a adicionar
  a primeira (mesmo tom do estado vazio do acervo, mockup já validado)
- Adicionando: feedback visual rápido (a modalidade aparece na lista assim
  que confirmada, sem precisar recarregar a tela)
- Removendo: idem, remove da lista imediatamente
- Erro ao adicionar/remover: mensagem inline, sem travar o resto da tela

## Navegação
- Acessível a partir do `/perfil` (FUC03) ou item próprio na navegação —
  decidir na implementação, mantendo consistência com o padrão de nav já
  estabelecido no dashboard

## Definição de pronto
- [ ] Tela reflete o padrão visual já estabelecido
- [ ] Catálogo carregado corretamente
- [ ] Adicionar uma modalidade funciona e reflete na lista
- [ ] Remover uma modalidade funciona sem afetar as demais
- [ ] Estado vazio (nenhuma modalidade praticada) tratado corretamente
- [ ] Teste E2E (Playwright) cobrindo adicionar, remover, e o estado vazio

## Referências
- Backend: UC11, UC12, ADR-0005 (modalidade como catálogo fixo)