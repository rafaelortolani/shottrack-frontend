# FUC15 v6 — Dashboard em abas (shell + Resumo) — SUBSTITUI a v5

## Estrutura
Página /dashboard com cabeçalho, **filtro global de modalidade** e abas
**Resumo | Evolução | Recordes | Modalidades** (mesmo padrão de abas de Usuário/Acervo/Treinos;
no celular as abas rolam na horizontal). Aba ativa e modalidade na URL
(`?aba=` e `?modalidade=`), persistindo ao trocar de aba. Modalidades ignora o filtro
(indicar visualmente que é "todas").

## Filtro global
Seletor "Todas as modalidades" + modalidades praticadas (vindas de /api/dashboard/modalities).
Trocar o filtro recarrega a aba atual.

## Aba Resumo (ordem)
1. Ação principal compacta (como hoje).
2. 3 indicadores com delta vs período anterior ("▲ 3 vs mês anterior"); cor neutra ou
   verde para melhora, sem vermelho; previous = 0 → mostrar "—" no delta.
3. Mini evolução do `suggestedEvolution`: gráfico pequeno, sem controles, link
   "Ver evolução" que abre a aba Evolução com a seleção; sem dados → oculta o bloco.
4. 3 últimos treinos (com a métrica por treino) e link "Ver histórico".
5. 3 recordes e link "Ver todos" (aba Recordes).
Acervo e resumo de modalidades NÃO aparecem mais aqui. Onboarding segue só em Boas-vindas.

## Estados
Vazio (sem treino): convite para iniciar o primeiro treino; carregando (esqueleto); erro com
tentar de novo.

## Referência backend
UC42 v7 — `GET /api/dashboard?modalityId=` (indicadores `{ value, previous }`,
`suggestedEvolution`, 3 últimos treinos, recordes) e `GET /api/dashboard/modalities`;
UC46 — `GET /api/dashboard/evolution` (ver FUC16). BFF: `/api/dashboard` (aceita
`modalityId`; completa o `visitId` dos últimos treinos a partir de `/api/visits`),
`/api/dashboard/modalities`, `/api/dashboard/evolution`.

## URL (estado do dashboard)
`?aba=resumo|evolucao|recordes|modalidades` (Resumo é o padrão e não aparece),
`?modalidade=<id>` (filtro global; id que o atleta não treinou vira "Todas"). Trocar de
aba preserva o resto. Parâmetros da Evolução: ver FUC16.

## Como foi feito
- `src/app/dashboard/page.tsx` + `_components/` (`DashboardShell`, `DashboardTabs`,
  `SummaryTab`, `EvolutionTab`, `RecordsTab`, `ModalitiesTab`); tipos, URL e formatação em
  `src/lib/dashboard.ts`. Uma aba nova (ex.: Habitualidade) entra em `DASHBOARD_TABS` e no
  mapa de componentes do shell.
- Aba Modalidades: o filtro fica desabilitado em "Todas as modalidades", com o aviso
  "Esta aba mostra todas as modalidades.".
- Delta: melhora em verde (`text-positive`), piora e igual neutros — nunca vermelho; sem
  mês anterior (`previous = 0`) mostra "—". O indicador "Modalidades praticadas" ignora o filtro.
- O recálculo do resumo é assíncrono (ADR-0015): recordes e evolução sugerida podem levar
  um instante a aparecer depois de registrar resultados.

## Testes
`tests/dashboard.spec.ts` (Resumo, deltas, abas na URL, filtro global, Recordes, Modalidades,
estados), `tests/evolucao.spec.ts` (aba Evolução e comparação) e o smoke mobile em
`tests/mobile-smoke.spec.ts`. Dado do mês anterior não dá pra criar pela API (o treino nasce
"hoje"), então os casos com período anterior usam a resposta real do backend e só acrescentam
`previous`/`previousPoints`.

## Definição de pronto
- [ ] Abas e filtro na URL; mobile com abas roláveis
- [ ] Indicadores com delta e estados "sem anterior"
- [ ] Mini evolução e links entre abas
- [ ] Acervo removido do dashboard
- [ ] E2E Playwright cobrindo os fluxos acima; lint e build limpos
