# FUC22 - Aplicativo instalável (PWA) e experiência mobile

## Objetivo
Permitir instalar o ShotTrack no celular, abrir em tela cheia e usar com conforto
no estande, mantendo um único código web.

## Instalação
- Manifest com nome "ShotTrack", cores #232323, `display: standalone`,
  `start_url: /` (passa pela landing inteligente), idioma pt-BR, ícones 192/512
  (any e maskable) e atalhos "Treinos" e "Dashboard".
- Android/Chrome: botão "Instalar app" usa o prompt nativo.
- iPhone/Safari: instruções curtas "Compartilhar > Adicionar à Tela de Início".
- Cartão discreto e dispensável em Boas-vindas (a dispensa é lembrada); seção
  "Aplicativo" em Usuário > Perfil com o mesmo botão/instrução. Some quando o app
  já está instalado (modo standalone).

## Offline
- Sem conexão: página de fallback "Sem conexão" com botão "Tentar de novo".
- Banner "Você está sem conexão. Para registrar, é preciso internet." quando o
  aparelho fica offline dentro do app; formulários de envio ficam desabilitados.
- Nada de dados em cache: sem lista, série ou perfil offline.

## Usabilidade mobile
- Alvos de toque ≥ 44px; botões principais de registro ao alcance do polegar.
- Safe areas (notch/barra inferior) respeitadas na navegação e rodapés.
- Altura com `dvh`, sem rolagem dupla; campos com fonte ≥ 16px (sem zoom no iOS).
- Fluxo "registrar série" fluido com uma mão em 390x844 e em 360x640.
- Navegação mobile consistente com o desktop (regra da skill).

## Como foi feito
- `src/app/manifest.ts`; ícones PNG em `public/icons` (gerados por
  `scripts/generate-icons.mjs` com `sharp`, a partir da retícula de
  `src/app/icon.svg`: 192/512 `any`, 512 `maskable` com ~17% de margem de
  segurança, `apple-touch-icon` 180).
- `public/sw.js`: cache `shottrack-static-v1`, cache-first só para
  `/_next/static`, `/icons`, fontes e imagens; navegação rede-primeiro com
  fallback `/offline` (pré-cacheada, junto com o JS/CSS/fontes que ela usa);
  não intercepta `/api/*` nem não-GET. `/sw.js` sai com `Cache-Control: no-cache`.
- `PwaProvider` (layout raiz): registra o worker só em produção (em dev remove
  worker/cache antigos), guarda `beforeinstallprompt`, detecta standalone/iOS,
  mostra o banner offline e desabilita os botões de envio sem conexão.
- `InstallApp`: cartão dispensável em Boas-vindas (`shottrack_install_dismissed`
  em localStorage) e seção "Aplicativo" em Usuário > Perfil.
- Revisão mobile: regra global de toque (44px, 16px) em `globals.css`, safe
  areas, `dvh`, `min-w-0`/quebra de e-mail longo no Perfil, barra de ações
  presa acima da nav no formulário de série, sidebar fixa com rolagem própria em
  paisagem.

## Testes
- `tests/pwa.spec.ts` (projeto `pwa`, contra o build em `:3100`): manifest e
  ícones públicos, cabeçalho, `/offline`, registro do worker, nenhum `/api` nem
  página autenticada em cache, fallback offline e instalabilidade (CDP).
- `tests/mobile-smoke.spec.ts` e `tests/mobile-install.spec.ts` (projetos
  `mobile-iphone` e `mobile-pixel`): fluxos principais no celular e convite de
  instalação.
- `tests/offline-ui.spec.ts`: banner, envio desabilitado, nada de worker em dev.
- Teste em aparelho real exige HTTPS (túnel ou ambiente de beta): o service
  worker e a instalação não funcionam em HTTP fora de `localhost`.

## Definição de pronto
- [ ] Manifest válido, ícones corretos, instalável no Chrome (Lighthouse)
- [ ] Botão Instalar (Android) e instruções (iPhone); cartão dispensável e some instalado
- [ ] Service worker registra só em produção e não cacheia API nem páginas autenticadas
- [ ] Fallback offline e banner de sem conexão
- [ ] Revisão mobile aplicada aos fluxos principais, com lista do que mudou
- [ ] Playwright com projetos de celular (smoke dos fluxos principais) + testes de PWA
- [ ] Seção "PWA e mobile" na skill convencoes-frontend

## Fora de escopo
Câmera/foto de alvo, push, registro offline com fila, app nativo.

## Referências
- ADR-0020, ADR-0019
