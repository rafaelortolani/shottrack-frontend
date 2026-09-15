# FUC06 - Usuário > Modalidades praticadas

## Objetivo
Permitir que o atleta veja e gerencie quais modalidades pratica, na aba
"Modalidades" da seção "Usuário" (irmã da aba "Perfil", FUC03).

## Estrutura de navegação
Rota: `/usuario/modalidades`, acessada pela aba "Modalidades" (mesmo
padrão de abas do Acervo) ou pelo link "Editar" no resumo do FUC03.

## Referência backend
- UC11 (catálogo de modalidades) — `GET /api/modality-catalog`
- UC12 (gerenciar modalidades praticadas) — `GET/POST /api/practiced-modalities`,
  `DELETE /api/practiced-modalities/{modalityId}`

## Layout
Grade de chips (um por modalidade do catálogo), cada um num estado
marcado (praticada) ou desmarcado (não praticada). Tocar num chip
desmarcado adiciona; tocar num chip marcado remove. Sem lista separada
de "já praticadas" — o catálogo inteiro aparece sempre, só o estado visual
muda.

- Chip marcado: fundo `accent-target`, ícone de check, texto claro
- Chip desmarcado: borda `border`, sem preenchimento, texto `foreground-muted`
- Contador no rodapé: "X modalidades selecionadas"

## Estados da tela
- Carregando: enquanto busca catálogo + praticadas
- Vazio: nenhuma modalidade praticada ainda — mensagem convidando a adicionar
  a primeira (mesmo tom do estado vazio do acervo, mockup já validado)
- Adicionando: feedback visual rápido (a modalidade aparece na lista assim
  que confirmada, sem precisar recarregar a tela)
- Removendo: idem, remove da lista imediatamente
- Erro ao adicionar/remover: mensagem inline, sem travar o resto da tela

## Definição de pronto
- [ ] Tela reflete o padrão visual já estabelecido
- [ ] Catálogo carregado corretamente
- [ ] Adicionar uma modalidade funciona e reflete na lista
- [ ] Remover uma modalidade funciona sem afetar as demais
- [ ] Estado vazio (nenhuma modalidade praticada) tratado corretamente
- [ ] Teste E2E (Playwright) cobrindo adicionar, remover, e o estado vazio

## Referências
- Backend: UC11, UC12, ADR-0005 (modalidade como catálogo fixo)