# FUC15 - Dashboard com dados reais (Onda 1)

## Objetivo
Substituir os dados fictícios do dashboard por dados reais, com a
hierarquia de conteúdo que mais ajuda o atleta a responder rápido:
"como estou evoluindo, o que fiz recentemente, o que faço agora".

Onda 2 (gráfico de evolução por período, recordes plurais) fica pra uma
sessão de design própria, depois — não faz parte deste use case.

## Referência backend
UC42 — `GET /api/dashboard`

## Landing condicional (pós-login)
Mantido como já definido: visita em andamento → `/treinos`; senão →
`/dashboard`.

## Hierarquia da tela (topo pro fim)

1. **Onboarding** (só se a API retornar pendência) — lista de até 3
   itens, cada um com check (feito) ou círculo vazio (pendente):
   "Criar perfil", "Configurar modalidades", "Cadastrar arma". Botão
   "Continuar configuração" leva pro primeiro item pendente. Some da
   tela sozinho assim que as 3 estiverem completas.

2. **Ação principal** — card em destaque:
   - Com visita ativa: "Continuar treino" + local/modalidade, botão leva
     pra `/treinos`
   - Sem visita ativa: "Pronto pra treinar?" + botão "Iniciar treino",
     mesmo destino

3. **Indicadores universais** — os 3 já existentes (treinos/mês,
   disparos/mês, modalidades praticadas) + o destaque dinâmico geral, no
   mesmo formato que já está implementado

4. **Últimos treinos** — lista compacta (até 5), cada linha: data, local,
   modalidade, métrica de destaque daquele treino (se houver). Tocar uma
   linha leva pro detalhe do treino (dentro da visita correspondente,
   `/treinos/[visitId]`). Link "Ver todos" no fim, se houver mais de 5.

5. **Modalidades** — resumo compacto: nome, contagem de treinos, melhor
   valor. Link "Ver modalidades" leva pra `/usuario/modalidades`.

6. **Acervo** — resumo compacto: contagem de armas + até 3 nomes. Link
   "Gerenciar acervo" leva pra `/acervo`. Fica deliberadamente pequeno —
   o dashboard não vira tela de gerenciar arma.

## Estados
- Atleta sem nenhum dado ainda: onboarding completo (3 pendências),
  ação principal mostra "Pronto pra treinar?", demais seções tratadas
  como estado vazio real (ex: "Ainda não há treinos" com o mesmo convite
  da ação principal, não um card vazio duplicado) — sem gráfico vazio,
  sem indicador artificial
- Carregando: enquanto busca `GET /api/dashboard`

## Definição de pronto
- [ ] Onboarding aparece só com pendência, some quando completo
- [ ] Ação principal reflete visita ativa ou convite genérico
- [ ] Últimos treinos exibidos com métrica por treino (ou sem métrica,
  se o treino não tiver resultado)
- [ ] Resumo de modalidades e de acervo exibidos corretamente
- [ ] Estado de atleta novo tratado sem gráfico/indicador vazio
- [ ] Teste E2E (Playwright) cobrindo: atleta novo vê onboarding completo,
  completar uma pendência faz ela sumir da lista, ação principal muda ao
  iniciar uma visita, últimos treinos aparecem depois de registrar um

## Referências
- Backend: UC42 (revisado)
- FUC13 (Visitas — destino da ação principal e dos itens de "últimos treinos")