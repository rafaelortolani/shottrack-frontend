# FUC02 - Tela de login

## Objetivo
Permitir que um atleta cadastrado entre no ShotTrack.

## Referência backend
UC02 (login) — `POST /api/auth/login`

## Campos do formulário
- Email (texto, obrigatório)
- Senha (senha, obrigatório)

## Estados da tela
- Padrão: formulário vazio
- Enviando: botão desabilitado, texto "Entrando..."
- Erro: mensagem genérica "Email ou senha incorretos" (nunca diferencia
  qual dos dois está errado — mesma regra de segurança do backend, UC02)
- Sucesso: redireciona pro `/dashboard`

## Autenticação (BFF)
- `POST /api/auth/login` (Route Handler) chama o backend, recebe
  access/refresh token, e guarda os dois em cookies `httpOnly`
  (`shottrack_access`, `shottrack_refresh`) — nunca retornados no corpo
  da resposta pro navegador.
- `src/proxy.ts` bloqueia acesso a `/dashboard` sem o cookie de sessão,
  redirecionando pro `/login`.

## Navegação
- Link "Não tem conta? Cadastre-se" leva pro `/cadastro` (FUC01)

## Definição de pronto
- [x] Tela implementada, refletindo o mockup validado
- [x] Login bem-sucedido redireciona pro `/dashboard`
- [x] Erro de credenciais inválidas exibido corretamente
- [x] Acesso a `/dashboard` sem sessão redireciona pro `/login`
- [x] Teste E2E (Playwright) cobrindo os três pontos acima (`tests/login.spec.ts`)

## Referências
- Backend: UC02, ADR-0001 (autenticação JWT)