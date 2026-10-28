# FUC25 — Visita retroativa e edição de datas

## Iniciar visita (Treinos → Visitas → Iniciar visita)
- O formulário ganha o campo "Quando foi?" com data e horário (pré-preenchido com agora),
  abaixo do local. Mensagem de ajuda: "Para treino que já aconteceu, altere a data".
- Validação no cliente: não aceita futuro nem mais de 12 meses atrás; erros do backend
  (`VISIT_DATE_IN_FUTURE`, `VISIT_DATE_TOO_OLD`) inline.
- Mantém tipo (Treino/Competição), âmbito e demais campos do FUC existente.

## Detalhe da visita
- Ação "Editar datas" no cabeçalho da visita: campos de início e, se encerrada, de fim,
  com os mesmos limites. Visita em andamento mostra só o início.
- Erros inline (`VISIT_DATE_RANGE_INVALID`, etc.). Após salvar, recarregar a visita.
- O cabeçalho continua exibindo "Início/Fim" com o novo valor.

## Efeitos
Dashboard, evolução, habitualidade e meta pessoal usam a data da visita; após editar,
as abas refletem a mudança (sem cache obsoleto).

## Definição de pronto
- [x] Iniciar visita com data passada; validações; erros inline
- [x] Editar datas (início; início e fim); visita em andamento
- [x] Mobile/PWA; E2E Playwright; lint e build

## Notas de implementação
- Datas em `src/lib/visitDates.ts`: o campo é `datetime-local` (hora local) e vai ao backend em ISO UTC.
  Sem mexer no campo ao iniciar, `startedAt` não é enviado (o backend usa "agora").
- Edição em `VisitDatesEditor`, no detalhe da visita (`/treinos/[id]`); BFF `PATCH /api/visits/[visitId]/dates`.
- Sem dado obsoleto: dashboard, evolução, habitualidade e histórico buscam os dados ao montar a tela
  (não há cache de cliente), então refletem a nova data na próxima visita à tela.
- E2E: `tests/visita-retroativa.spec.ts` e o smoke em `tests/mobile-smoke.spec.ts`.
