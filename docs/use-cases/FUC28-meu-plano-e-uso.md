# FUC28 — Meu plano e uso (atleta)

## Onde fica
Cartão **"Meu plano"** na aba Perfil do menu Usuário (abaixo dos dados do perfil).

## Conteúdo
- Nome do plano (hoje "Gratuito").
- Barras de uso: **Fotos** (ex.: "12 de 500") e **Espaço** (ex.: "38 MB de 512 MB"). A barra fica em alerta a partir de 80% e
  em limite a 100%.
- Texto "Seu plano permite até 5 fotos por série e 30 envios por hora." (valores vindos do backend).
- Sem botão de contratar nem preço (cobrança fora do escopo).

## Nas telas de foto (FUC26)
- Perto do limite da série: "3 de 5 fotos nesta série".
- Ao atingir: mensagens específicas de `PHOTO_LIMIT_PER_SERIES_REACHED`, `PHOTO_LIMIT_PER_ATHLETE_REACHED` e
  `PHOTO_STORAGE_LIMIT_REACHED` (por exemplo, "Você atingiu o espaço do seu plano. Exclua fotos antigas para enviar novas.").
- O botão de adicionar foto fica desabilitado com a explicação quando o limite da série foi atingido (limite vindo do plano, não fixo no código).

## Referência backend
UC66 `GET /api/users/me/plan` (conferir no Swagger)

## Definição de pronto
- [x] Cartão com plano, uso e limites; estados de carregando e erro
- [x] Barras em alerta (80%) e em limite (100%)
- [x] Mensagens novas do FUC26; limite da série vindo do plano
- [x] Atualiza depois de enviar ou excluir fotos
- [x] Mobile 390 px; E2E Playwright; lint, typecheck e build

## Observações da implementação
- `useMyPlan` (`src/lib/useMyPlan.ts`) lê `GET /api/users/me/plan` (sempre no-store) e expõe `refresh()`, chamado depois de enviar ou excluir fotos.
- Barra: ok abaixo de 80%, alerta de 80% a 99%, limite a partir de 100% (`usageLevel` em `src/lib/plans.ts`); o texto "Perto do limite"/"Limite atingido" acompanha a cor.
- O limite de fotos por série vem do plano; o carregamento do plano falhando não bloqueia o envio (o backend continua recusando).
