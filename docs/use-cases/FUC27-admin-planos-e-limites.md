# FUC27 — Administração: planos e limites

## Onde fica
Painel de administração (ADR-0021; visível só para papel ADMIN), novo item **"Planos e limites"** com duas abas:
**Limites** e **Atletas**, mais um bloco **Histórico**.

## Aba Limites
- Botão **"Novo plano"** (abre um diálogo): nome, código (em maiúsculas, com validação do formato; avisar que não muda depois) e
  "Copiar limites de" (lista dos planos existentes, opcional). Erros inline (`PLAN_CODE_INVALID`, `PLAN_CODE_ALREADY_EXISTS`,
  `PLAN_NAME_ALREADY_EXISTS`, `PLAN_COUNT_LIMIT_REACHED`).
- Um cartão por plano (hoje: "Gratuito", marcado como padrão, com o número de atletas) com as ações:
  - **Renomear** (edição do nome);
  - **Ativar/Desativar**, com confirmação que mostra quantos atletas têm o plano e o aviso "Quem já tem este plano mantém o plano e
    os limites; ele só deixa de poder ser atribuído a outros atletas". Desabilitado no plano padrão, com a explicação
    "Defina outro plano como padrão antes de desativar este";
  - **Definir como padrão** (só em plano ativo e não padrão), com confirmação "Novos cadastros passarão a receber este plano".
  Planos inativos aparecem esmaecidos com a etiqueta "Inativo".
- Tabela de limites do plano: nome legível, valor atual editável, unidade, faixa permitida e indicação "padrão"/"personalizado".
  - Fotos por série, fotos por atleta, envios por hora: campo numérico.
  - Espaço total por atleta: campo em **MB** (o backend usa bytes; converter no cliente, aceitar decimais com 1 casa).
  - Análises de IA por mês: linha **desabilitada**, com a nota "Ainda não aplicado (etapa de análise de alvos)".
- Botão "Salvar alterações" (ativo só se algo mudou). Antes de salvar, um resumo "Fotos por série: 5 → 8" e o aviso fixo
  **"Reduzir um limite não apaga fotos já enviadas; só impede novos envios."** com confirmação.
- Botão "Restaurar padrão" por linha (preenche o valor padrão; só grava ao salvar).
- Erros inline: valor fora da faixa (`PLAN_LIMIT_OUT_OF_RANGE`), chave inválida, 403, falha de rede.

## Aba Atletas
- Busca por e-mail do atleta (campo + botão; mínimo de caracteres; sem listar todos).
- Resultado: nome, e-mail, plano atual (mesmo que inativo) e o uso do atleta no formato "N fotos · X MB" (`photoCount` e `storageBytes` de `GET /api/admin/users`; sem fotos aparece "0 fotos · 0 MB"; espaço em MB com 1 casa, como no FUC28). Se o uso passar do limite do plano atual (fotos por atleta ou espaço), a tela mostra em texto "Acima do limite do plano: ..." com o lembrete de que as fotos já enviadas não são apagadas. Sem o plano na lista, mostra só o uso. Seletor de plano (apenas planos ativos) e botão
  "Alterar plano" com confirmação. Mensagem "Atleta não encontrado" (`USER_NOT_FOUND`).

## Histórico
Lista das últimas 50 alterações (UC67): data/hora, quem, o quê (limite ou plano), valor anterior → novo. Atores/alvos de
contas excluídas aparecem como "conta excluída".

## Mobile e acessibilidade
Tabela vira lista de cartões em 390 px; áreas de toque ≥ 44 px; rótulos associados aos campos; foco e teclado.

## Referência backend
UC63 `GET /api/admin/plans` · UC68 `POST /api/admin/plans` · UC69 `PATCH /api/admin/plans/{code}` · UC64 `PATCH /api/admin/plans/{code}/limits` · UC65 `PUT /api/admin/users/{userId}/plan`
`GET /api/admin/users?email=` (busca por trecho do e-mail, mínimo de 3 caracteres, até 10 resultados) · UC67 `GET /api/admin/plans/audit?limit=`. BFF: `src/app/api/admin/plans/**` e `src/app/api/admin/users/**` (código de plano validado por `requirePlanCode`, UUID por `requireUuid`).

## Definição de pronto
- [x] Editar limites, restaurar padrão, confirmação com resumo; erros inline
- [x] Criar plano (com e sem cópia de limites); renomear; ativar/desativar com confirmação; trocar o plano padrão
- [x] Plano padrão não pode ser desativado (botão desabilitado com explicação); plano inativo some do seletor de atribuição
- [x] Alterar o plano de um atleta encontrado por e-mail
- [x] Histórico atualizado após cada alteração
- [x] Atleta comum não vê o item de menu nem acessa as telas (redireciona)
- [x] Mobile 390 px; E2E Playwright (admin e atleta); lint, typecheck e build

## Observações da implementação
- O código do plano padrão semeado é `FREE` (nome "Gratuito"). O backend aceita no máximo 20 planos (inativos contam; não há exclusão).
- Espaço: o backend guarda bytes; a tela edita em MB (1 MB = 1024 × 1024 bytes, 1 casa decimal) — `src/lib/plans.ts`.
- Só vão ao backend os limites que o administrador mudou (edição parcial e atômica).
- Testes: `tests/planos-*.spec.ts` (E2E contra o backend real; planos de teste compartilhados por projeto) e `tests/mobile-planos.spec.ts` (390 px).
