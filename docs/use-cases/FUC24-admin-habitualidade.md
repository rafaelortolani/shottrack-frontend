# FUC24 — Administração de habitualidade

## Telas (somente ADMIN; /admin/habitualidade)
1. **Lista de regras**: nome, referência legal, ativa, versão vigente; criar regra; ativar/
   desativar. O cartão "Regras de habitualidade — em breve" de /admin passa a ser ativo.
2. **Detalhe da regra** (`/admin/habitualidade/[id]`): editar nome/referência; lista de
   versões (vigente destacada, futuras e passadas); criar nova versão.
3. **Editor de versão**: data de vigência, janela em meses; níveis (adicionar, reordenar,
   remover) e, por nível, exigências (tipo de atividade, quantidade mínima, só em clube,
   eventos distintos, âmbito mínimo). Mostrar um resumo legível por nível ("8 treinos";
   "12 treinos + 2 competições estaduais, eventos distintos").
   Versões vigentes/passadas ficam somente leitura (com a exceção do backend: editáveis
   se ninguém acompanha — o erro `HABITUALITY_VERSION_NOT_EDITABLE` é exibido de forma clara).
   Versões futuras: editar e excluir (com confirmação).
4. Erros do backend exibidos inline (datas inválidas, níveis duplicados, etc.).

## Definição de pronto
- [x] Fluxo completo de cadastro regra → versão → níveis → exigências
- [x] Versão futura editável/removível; vigente somente leitura
- [x] Acesso negado a não-admin; E2E; lint e build

## Notas de implementação
- Telas em `src/app/admin/habitualidade/**`; BFF em `src/app/api/admin/habituality/**` (`requireAdmin`).
- E2E: `tests/habitualidade.spec.ts` (cadastro completo, ativar/desativar, versão futura,
  erros inline, não admin barrado) e `tests/mobile-smoke.spec.ts`.
