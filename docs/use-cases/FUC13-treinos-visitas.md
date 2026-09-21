# FUC13 - Treinos: Visitas

## Objetivo
Permitir iniciar uma visita, abrir/encerrar treinos dentro dela (múltiplos
simultâneos), encerrar a visita, e consultar o histórico.

## Estrutura de navegação
Reestrutura a seção "Treinos" pra abas — mesmo padrão já usado em
Usuário/Acervo:
- **Visitas** (aba padrão) — este use case
- **Locais** — conteúdo do FUC11, movido de `/treinos` (tela única) pra
  `/treinos/locais` (aba); nenhuma mudança de funcionalidade, só de rota

Rotas: `/treinos` (aba Visitas), `/treinos/locais` (aba Locais, era
`/treinos` antes), `/treinos/nova` (iniciar visita), `/treinos/[id]`
(detalhe de uma visita — ativa ou do histórico).

## Referência backend
- UC31 (iniciar visita) — `POST /api/visits` (conferir rota exata no Swagger)
- UC32 (abrir treino) — `POST /api/visits/{visitId}/trainings`
- UC33 (encerrar treino) — `PATCH /api/trainings/{id}/close`
- UC34 (encerrar visita) — `PATCH /api/visits/{id}/close`
- UC35 (listar visitas) — `GET /api/visits`

## Tela "Visitas" (aba padrão)
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
- [ ] Abrir treino funciona, inclusive dois da mesma modalidade
- [ ] Encerrar um treino individualmente funciona
- [ ] Encerrar visita com confirmação, cascata refletida na tela depois
- [ ] Histórico lista visitas encerradas corretamente
- [ ] Teste E2E (Playwright) cobrindo: iniciar visita, abrir 2 treinos
  (mesma modalidade), encerrar 1 manualmente, encerrar a visita com o
  outro ainda aberto (confirmando a cascata), conferir no histórico

## Referências
- Backend: UC31, UC32, UC33, UC34, UC35, ADR-0012
- FUC11 (Locais — vira aba irmã)
- FUC06 (Modalidades praticadas — pré-requisito pra abrir treino)