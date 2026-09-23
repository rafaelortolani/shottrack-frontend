# FUC13 - Treinos: Visitas

## Objetivo
Permitir iniciar uma visita, abrir/encerrar treinos dentro dela (múltiplos
simultâneos), encerrar a visita, e consultar o histórico.

## Estrutura de navegação
Reestrutura a seção "Treinos" pro mesmo padrão hub-com-cards já usado em
Usuário/Acervo (não abas visíveis — esse padrão foi removido nessas duas
seções, ver commit `0482b43`):
- `/treinos` — hub: título "Treinos" + cards (Visitas, Locais), sem
  breadcrumb, igual `/acervo` e `/usuario`
- **Visitas** — este use case, `/treinos/visitas`
- **Locais** — conteúdo do FUC11, movido de `/treinos` (tela única) pra
  `/treinos/locais`; nenhuma mudança de funcionalidade, só de rota

Rotas: `/treinos` (hub), `/treinos/visitas` (breadcrumb "Treinos /
Visitas"), `/treinos/locais` (breadcrumb "Treinos / Locais", era
`/treinos` antes), `/treinos/nova` (iniciar visita), `/treinos/[id]`
(detalhe de uma visita — ativa ou do histórico).

## Referência backend
- UC31 (iniciar visita) — `POST /api/visits` (conferir rota exata no Swagger)
- UC32 (abrir treino) — `POST /api/visits/{visitId}/trainings`
- UC33 (encerrar treino) — `PATCH /api/trainings/{id}/close`
- UC34 (encerrar visita) — `PATCH /api/visits/{id}/close`
- UC35 (listar visitas) — `GET /api/visits`
- UC43 (excluir treino) — `DELETE /api/trainings/{id}`
- UC44 (excluir visita) — `DELETE /api/visits/{id}`

## Tela "Visitas"
- **Se há visita em andamento**: card destacado no topo, "Visita em
  andamento" — local, horário de início, lista dos treinos dela (cada um
  com modalidade e status), botão "Abrir novo treino" (seleciona uma
  modalidade dentre as praticadas do atleta), e cada treino em andamento
  tem um botão "Encerrar" próprio. Botão "Encerrar visita" no fim do card.
- **Se não há visita em andamento**: botão "Iniciar visita" (seleciona um
  local dentre os cadastrados — se não houver nenhum, direciona pra
  cadastrar um primeiro, aba Locais)
- **Histórico**: abaixo, lista de visitas já encerradas — local, data,
  modalidades praticadas naquela visita (resumo), com busca por local

## Estado vazio: visita sem nenhum treino aberto
Enquanto a visita ativa não tem nenhum treino, em vez do botão
secundário "Abrir novo treino", mostra um bloco de estado vazio (borda tracejada,
componente `EmptyState`, o mesmo do treino sem série no FUC14): ícone,
título "Nenhum treino aberto ainda", texto curto explicando, e um
**botão** (não link) "Abrir treino" em destaque. Assim que existir pelo
menos um treino, o botão secundário (contorno, ícone +) "Abrir novo
treino" passa a ser suficiente (a pessoa já entendeu o padrão).

## Excluir treino e excluir visita
- Cada treino ganha uma ação "Excluir" (além de "Encerrar", quando em
  andamento) — confirmação simples antes de excluir, avisando que as
  séries dele somem junto (UC43)
- A visita ganha uma ação "Excluir visita" (além de "Encerrar visita") —
  confirmação avisando que treinos e séries somem junto (UC44)
- As duas ações existem na visita ativa (tela Visitas) e no detalhe de
  qualquer visita (`/treinos/[id]`), inclusive encerrada — excluir a
  visita pelo detalhe volta pra `/treinos/visitas`

## Encerrar visita com treino(s) aberto(s)
O backend sempre aceita e cascateia (ADR-0012) — mas a UI confirma antes:
modal "Você tem N treino(s) em andamento. Encerrar a visita vai encerrar
eles também. Confirmar?" — só chama o endpoint depois da confirmação.

## Estados
- Carregando visita ativa + histórico
- Nenhuma modalidade praticada ainda → ao tentar abrir treino, direciona
  pra configurar modalidades praticadas primeiro (FUC06)
- Nenhum local cadastrado ainda → ao tentar iniciar visita, direciona pra
  cadastrar local primeiro (aba Locais)
- Estado vazio: nenhuma visita no histórico ainda

## Definição de pronto
- [ ] Tela "Locais" migrada pra `/treinos/locais` sem quebrar nada do FUC11
- [ ] Iniciar visita funciona
- [ ] Estado vazio (visita sem treino) mostra o CTA em destaque
- [ ] Abrir treino funciona, inclusive dois da mesma modalidade
- [ ] Encerrar um treino individualmente funciona
- [ ] Excluir um treino funciona, com confirmação
- [ ] Encerrar visita com confirmação, cascata refletida na tela depois
- [ ] Excluir visita funciona, com confirmação
- [ ] Excluir treino e visita também no detalhe de visita encerrada
- [ ] Histórico lista visitas encerradas corretamente
- [ ] Teste E2E (Playwright) cobrindo: iniciar visita, abrir 3 treinos
  (mesma modalidade), encerrar 1 manualmente, excluir 1, encerrar a
  visita com o outro ainda aberto (confirmando a cascata), conferir no
  histórico

## Referências
- Backend: UC31, UC32, UC33, UC34, UC35, UC43, UC44, ADR-0012
- FUC11 (Locais — vira aba irmã)
- FUC06 (Modalidades praticadas — pré-requisito pra abrir treino)