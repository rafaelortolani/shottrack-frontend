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

## Fluxo de captura
- Dois botões: "Tirar foto" (`<input type="file" accept="image/*" capture="environment">`) e "Escolher da galeria".
- **Antes de enviar**, o navegador reduz a imagem (lado maior 2000 px, JPEG ~0,85, respeitando a orientação da foto) e
  confere o tamanho; isso também converte HEIC. Barra de progresso durante o envio; botão de cancelar.
- Máximo de 5 fotos por série: ao chegar no limite, o botão some e aparece "Limite de 5 fotos por série".

## Visualizador
- Tela cheia (modal) com a foto em tamanho grande, zoom por pinça/duplo toque, deslizar para a próxima/anterior,
  botão fechar e ação "Excluir foto" com confirmação ("Esta foto será removida definitivamente").
- Carrega a imagem pelo BFF (`/content`); miniaturas pelo `/thumbnail`.

## Erros (inline, na linguagem do atleta)
`PHOTO_TOO_LARGE`, `PHOTO_UNSUPPORTED_TYPE`, `PHOTO_INVALID_IMAGE`, `PHOTO_DIMENSIONS_TOO_LARGE`,
`PHOTO_LIMIT_PER_SERIES_REACHED`, `PHOTO_LIMIT_PER_ATHLETE_REACHED`, 429 e falha de rede com "tentar de novo".

## Estados
Carregando (esqueleto da miniatura), erro de carregamento (ícone + "tentar de novo"), série sem foto (só o botão).

## Acessibilidade e mobile
Botões com alvo de toque ≥ 44 px, texto alternativo "Foto do alvo da série N", foco no modal e fechar com Esc.

## Referência backend
- UC60 `POST /api/series/{id}/photos` · UC61 `GET /api/series/{id}/photos`, `.../{photoId}/content`, `.../{photoId}/thumbnail`
- UC62 `DELETE /api/series/{id}/photos/{photoId}` · UC37 traz `photoCount`
(conferir rotas exatas no Swagger depois de implementado)

## Definição de pronto
- [ ] Anexar na série existente e no registro rápido; erro de envio não perde a série
- [ ] Visualizador, exclusão com confirmação, limite de 5
- [ ] Redução no navegador (tamanho final < 2 MB típico); HEIC convertido
- [ ] Mobile/PWA; E2E Playwright (usar imagens pequenas de teste); lint e build
