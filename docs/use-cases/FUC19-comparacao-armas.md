# FUC19 - Comparação entre armas

## Objetivo
Permitir comparar o desempenho do atleta entre duas ou mais armas, numa
modalidade e tipo de resultado específicos.

## Referência backend
UC48 — `GET /api/dashboard/weapon-comparison`, via BFF `GET /api/weapons/comparison`

## Estrutura de navegação
Nova rota `/acervo/comparar` — acessível a partir da lista de Armas
(Acervo), um link/botão "Comparar armas" perto do "+ Cadastrar arma".

## Tela
- Seletores encadeados: modalidade (dentre as praticadas) → tipo de
  resultado (dentre os configurados nela) — mesmo padrão do FUC16
- Seleção de 2 ou mais armas (checkboxes na lista do acervo, ou chips
  removíveis depois de escolhidas)
- Período opcional (mesmo padrão De/Até já usado em outras telas)
- Resultado: uma linha por arma — nome, contagem de séries, média,
  melhor valor. Arma sem dado aparece com "Sem dados nesse período/
  modalidade" em vez de zero enganoso

## Estados
- Menos de 2 armas selecionadas: botão "Comparar" desabilitado
- Nenhuma modalidade praticada ainda, ou nenhum tipo configurado: seção
  não aparece (mesma lógica já usada no FUC16)
- Carregando

## Definição de pronto
- [ ] Seleção de 2+ armas funciona
- [ ] Seletores encadeados (modalidade → tipo) funcionam
- [ ] Resultado exibido lado a lado corretamente
- [ ] Arma sem dado tratada com mensagem clara, não zero enganoso
- [ ] Teste E2E (Playwright) cobrindo: comparar 2 armas com dado, comparar
  3 armas incluindo uma sem dado, trocar o tipo de resultado e conferir
  que o resultado recalcula

## Referências
- Backend: UC48
- FUC07 (Acervo — Armas, ponto de entrada)
- FUC16 (Evolução — mesmo padrão de seletores encadeados)