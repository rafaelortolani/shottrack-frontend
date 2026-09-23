# FUC16 - Evolução (Dashboard Onda 2)

## Objetivo
Área de maior destaque do dashboard: gráfico de evolução do atleta,
parametrizado por modalidade, tipo de resultado e período.

## Referência backend
UC46 — `GET /api/dashboard/evolution` (conferir rota exata no Swagger)

## Layout
Posicionado no topo do dashboard, acima da Ação Principal (hierarquia do
documento de produto).

- Seletor de **modalidade** (dentre as praticadas) e, dentro dela, de
  **tipo de resultado** (dentre os configurados naquela modalidade) —
  dois dropdowns encadeados, mesmo padrão do cadastro em cascata já usado
  no Acervo
- Abas de **período**: 7 dias / 30 dias / 3 meses / 1 ano
- Toggle **Média / Melhor** — alterna o modo de agregação, mesmo gráfico
- Gráfico de linha, um ponto por dia com dado (dias sem registro não
  aparecem como zero, só não têm ponto)
- Seletor de tipo mostra só tipos numéricos ("Exercício concluído" e
  "Anotação livre" não têm valor agregável nem orientação)
- Seleção inicial: a modalidade com mais treinos e, nela, o primeiro
  tipo que já tem recorde (senão, o primeiro tipo); período 30 dias,
  modo Média

## Estados
- Sem modalidade praticada ainda: seção não aparece (não faz sentido
  mostrar seletor vazio)
- Modalidade praticada mas sem tipo de resultado configurado: seção não
  aparece (mesma lógica)
- Combinação escolhida sem nenhum dado no período: gráfico mostra estado
  vazio ("Nenhum registro nesse período"), não gráfico vazio com eixos
  soltos
- Trocar modalidade/tipo/período/modo: recarrega o gráfico, sem sair da
  tela

## Definição de pronto
- [ ] Seletores encadeados funcionam (modalidade → tipo)
- [ ] As 4 abas de período funcionam
- [ ] Toggle Média/Melhor funciona, mesmo gráfico
- [ ] Estado vazio (sem dado no período) tratado sem gráfico solto
- [ ] Seção ausente quando não há modalidade/tipo configurado
- [ ] Teste E2E (Playwright) cobrindo: trocar período, trocar modo,
  trocar modalidade, e o estado vazio de período sem dado

## Referências
- Backend: UC46, ADR-0016
- FUC15 (Dashboard — este use case se integra no topo dele)