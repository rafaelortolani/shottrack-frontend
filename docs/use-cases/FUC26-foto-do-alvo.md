# FUC26 — Foto do alvo na série

## Objetivo
Permitir guardar fotos do alvo junto de cada série, de forma rápida no celular (PWA), sem atrapalhar o
registro rápido (FUC14).

## Onde aparece
- **Linha da série (accordion de treino, FUC13/FUC14)**: ícone de câmera com o número de fotos; abaixo, até 5
  miniaturas. Tocar numa miniatura abre o visualizador.
- **Card de registro rápido de série**: botão discreto "Foto do alvo" (opcional). A foto escolhida fica no aparelho
  e é enviada logo depois que a série é salva. Se o envio falhar, a série continua salva e aparece o aviso
  "Série salva. A foto não foi enviada — tentar de novo".
  **A foto pendente vive só em memória**: recarregar a página (ou fechar a aba) entre salvar a série e terminar o
  envio perde a foto. É aceito; a série fica salva e a foto pode ser anexada de novo pela linha da série.

## Fluxo de captura
- Dois botões: "Tirar foto" (`<input type="file" accept="image/*" capture="environment">`) e "Escolher da galeria".
- **Antes de enviar**, o navegador reduz a imagem (lado maior 2000 px, JPEG ~0,85, respeitando a orientação da foto) e
  confere o tamanho; isso também converte HEIC. Barra de progresso durante o envio; botão de cancelar.
- Limite de fotos por série vem do plano do atleta (FUC28, `GET /api/users/me/plan`; 5 no plano Gratuito), nunca fixo no código: a tela mostra "N de LIMITE fotos nesta série" e, ao chegar no limite, os botões ficam desabilitados com a explicação "Você atingiu o limite de N fotos por série do seu plano. Exclua uma foto para enviar outra.". Se o limite for reduzido abaixo do que já existe, todas as fotos continuam visíveis; só novos envios são bloqueados.
- Mensagens do backend: `PHOTO_LIMIT_PER_SERIES_REACHED`, `PHOTO_LIMIT_PER_ATHLETE_REACHED` e `PHOTO_STORAGE_LIMIT_REACHED` ("Você atingiu o espaço do seu plano. Exclua fotos antigas para enviar novas."). O uso do plano é lido de novo depois de enviar ou excluir fotos.

## Visualizador
- Tela cheia (modal) com a foto em tamanho grande, zoom por pinça/duplo toque, deslizar para a próxima/anterior,
  botão fechar e ação "Excluir foto" com confirmação ("Esta foto será removida definitivamente").
- Renderizado num portal em `document.body`, na camada `z-viewer` (acima da barra de navegação do app; escala de
  camadas em `src/app/globals.css`), respeitando as áreas seguras do aparelho (`env(safe-area-inset-*)`).
- Carrega a imagem pelo BFF (`/content`); miniaturas pelo `/thumbnail`.
- Foto que não existe mais (404, ex.: excluída em outro aparelho): aparece "Foto não encontrada.", a foto sai da lista
  e o visualizador segue para a vizinha. Não há "tentar de novo" para 404. Um 401 de sessão numa imagem renova a sessão
  uma vez (como nas demais chamadas); um 404 nunca dispara renovação, logout nem redirecionamento.

## Erros (inline, na linguagem do atleta)
`PHOTO_TOO_LARGE`, `PHOTO_UNSUPPORTED_TYPE`, `PHOTO_INVALID_IMAGE`, `PHOTO_DIMENSIONS_TOO_LARGE`,
`PHOTO_LIMIT_PER_SERIES_REACHED`, `PHOTO_LIMIT_PER_ATHLETE_REACHED`, `PHOTO_PROCESSING_BUSY` (503: "O servidor está
processando outras fotos. Tente de novo em instantes."), 429 e falha de rede com "tentar de novo".
O texto de tipo não suportado segue o backend: "JPEG ou PNG".

## Cache e privacidade
Nenhuma foto fica em cache: o `Cache-Control` efetivo no navegador, em todas as rotas de foto, é `no-store`
(`next.config.ts` aplica `no-store` a `/api/**`; o handler das imagens também envia `private, no-store`, mas o do
`next.config` é o que chega), com `X-Content-Type-Options: nosniff` e `Content-Type: image/jpeg` fixo. O service worker
nunca intercepta `/api/`.

## Estados
Carregando (esqueleto da miniatura), erro de carregamento (ícone + "tentar de novo"), série sem foto (só o botão).

## Acessibilidade e mobile
Botões com alvo de toque ≥ 44 px, texto alternativo "Foto do alvo da série N", foco no modal e fechar com Esc.

## Referência backend
- UC60 `POST /api/series/{id}/photos` · UC61 `GET /api/series/{id}/photos`, `.../{photoId}/content`, `.../{photoId}/thumbnail`
- UC62 `DELETE /api/series/{id}/photos/{photoId}` · UC37 traz `photoCount`
- Backend implementado (ADR-0026, UC60–62): 10 MB por arquivo, 5 fotos por série, 500 por atleta (valores do plano Gratuito; editáveis pelo administrador, FUC27), 40 megapixels,
  30 envios por hora por atleta (429 `TOO_MANY_REQUESTS`).

## Definição de pronto
- [x] Anexar na série existente e no registro rápido; erro de envio não perde a série
- [x] Visualizador (inclusive no celular, 390 px), exclusão com confirmação, limite da série vindo do plano
- [x] Redução no navegador (ex.: 4032×3024 de 11 MB vira 2000×1500 de ~1,4 MB). HEIC: convertido onde o navegador o
  decodifica (Safari); onde não decodifica, erro claro (só este caminho é testado, em Chromium)
- [x] Mobile/PWA; E2E Playwright contra o backend real (falhas injetadas por `page.route`); lint e build
