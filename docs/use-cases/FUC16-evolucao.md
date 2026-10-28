# FUC16 — Evolução (aba do dashboard) — SUBSTITUI a versão anterior

Única tela do dashboard com controles. Modalidade vem do **filtro global**.
- Filtro "Todas": seletor de modalidade da aba pré-preenchido com a mais praticada
  (alterá-lo não muda o filtro global).
- Controles: tipo de resultado (encadeado à modalidade), período 7d/30d/3m/1a, Média/Melhor.
- Novo: **Comparar com período anterior** (alternar) → segunda série (`previousPoints`),
  traço mais discreto, legenda "Atual × Anterior".
- Estados vazios e erros do FUC16 original (modalidade não praticada, tipo não configurado,
  sem pontos) mantidos; sem pontos no anterior → mostrar só a série atual com aviso curto.
- Recebe seleção por URL (vinda do link "Ver evolução" do Resumo ou dos Recordes).

## URL (seleção)
`?aba=evolucao` mais: `modalidade` (filtro global), `mod` (modalidade escolhida na aba,
só com "Todas"), `tipo` (id do tipo de resultado), `periodo` (`7d|30d|3m|1a`),
`modo` (`media|melhor`) e `comparar=1`. Valores inválidos caem nos padrões (30d, Média,
comparação desligada; modalidade = a mais treinada; tipo = o primeiro com recorde).
O link "Ver evolução" do Resumo e os Recordes abrem a aba já com `tipo` (e `mod`).

## Comparação com o período anterior
Com `comparePrevious=true` o backend devolve `{ points, previousPoints }` (período anterior de
mesma duração). O gráfico desloca o anterior pra mesma janela (mesma posição no eixo), traço
tracejado e discreto, e mostra a legenda "Atual × Anterior"; o tooltip traz a data real do
ponto anterior. Há uma tabela por série pra leitor de tela. O interruptor é um
`role="switch"` controlado pela URL.

## Como foi feito
`src/app/dashboard/_components/EvolutionTab.tsx` e `src/components/TimeLineChart.tsx`
(`previousPoints`, `height`). O Resumo usa o mesmo gráfico, pequeno (120px) e sem controles.

## Definição de pronto
- [ ] Modalidade herdada do filtro global; pré-seleção com "Todas"
- [ ] Comparação ligada/desligada; estados vazios
- [ ] Seleção por URL; E2E; lint/build
