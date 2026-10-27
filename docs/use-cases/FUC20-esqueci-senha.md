# FUC20 - Esqueci minha senha / Redefinir senha

## Objetivo
Permitir ao atleta recuperar o acesso e garantir que logout e troca de senha
encerrem as sessões de verdade.

## Referência backend
UC49, UC50, UC51 e ADR-0018:
`POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/confirm`,
`POST /api/auth/logout`.

## Telas (públicas, sem proxy de login)
- `/esqueci-senha`: campo e-mail + botão. Ao enviar, sempre mostra a mesma
  mensagem ("Se existir uma conta com esse e-mail, enviamos um link..."),
  sem revelar se a conta existe. Link "Voltar ao login".
- `/redefinir-senha?token=...`: nova senha + confirmação. Sucesso → vai ao
  login com aviso "Senha redefinida. Entre com a nova senha". Token
  inválido/expirado/usado → mensagem clara com link para pedir um novo.
- Tela de login ganha o link "Esqueci minha senha".

## BFF (Route Handlers, sem exigir sessão)
- `POST /api/auth/password-reset/request` → backend `.../request` (202)
- `POST /api/auth/password-reset/confirm` → backend `.../confirm` (200),
  repassa `PASSWORD_RESET_TOKEN_INVALID` / `_EXPIRED` / `_ALREADY_USED`
- `/esqueci-senha` e `/redefinir-senha` ficam fora do matcher do `proxy.ts`
  (públicas). Link do e-mail: `/redefinir-senha?token=...`
- O 429 do backend é repassado com o header `Retry-After`
  (`retryAfterHeaders` em `src/lib/backend.ts`); a mensagem vem de
  `src/lib/rateLimit.ts`: "Muitas tentativas. Tente novamente em N minutos."
  (ou "em alguns minutos" sem `Retry-After`)

## Comportamentos
- Logout: o BFF chama `POST /api/auth/logout` com o refresh token e SÓ DEPOIS
  limpa os cookies (se o backend falhar, os cookies são limpos mesmo assim).
- Alterar senha (FUC05): ao concluir, o atleta é levado ao login com a
  mensagem "Senha alterada. Entre novamente." (o backend revogou as sessões).
- `/redefinir-senha` valida no cliente: mínimo 8 caracteres e confirmação
  igual. Sem `token` na URL mostra a mesma tela de erro do token inválido,
  com o link "Pedir um novo link" para `/esqueci-senha`.
- 429 (`TOO_MANY_REQUESTS`) em login, cadastro e esqueci-senha: mensagem
  "Muitas tentativas. Tente novamente em alguns minutos" (usa `Retry-After`
  quando houver), sem quebrar o formulário.

## Definição de pronto
- [ ] Link "Esqueci minha senha" no login
- [ ] Pedido mostra sempre a mesma mensagem
- [ ] Redefinição com token válido leva ao login; inválido/expirado/usado mostra erro
- [ ] Logout revoga no backend e limpa cookies
- [ ] Alterar senha leva ao login
- [ ] 429 tratado nas três telas
- [ ] E2E Playwright: fluxo completo com e-mail lido do Mailpit, token reutilizado,
      logout, alterar senha, 429

## Testes
- `tests/esqueci-senha.spec.ts` — fluxo completo com e-mail do Mailpit (corpo
  completo da mensagem: o `Snippet` trunca o token), link reutilizado, token
  inválido/ausente, validação, e-mail inexistente com a mesma mensagem, 429
  nas telas de login, cadastro e esqueci-senha (resposta simulada, pra não
  depender de limite configurado) e um 429 real do backend via BFF.
- Rodar a suíte completa exige o backend com os limites **por IP** altos
  (`APP_RATE_LIMIT_REGISTRATION_PER_IP=100000` e
  `APP_RATE_LIMIT_PASSWORD_RESET_REQUEST_PER_IP=100000`): o padrão (20/hora) é
  menor que o número de cadastros e pedidos que a suíte faz do mesmo IP. O
  limite **por e-mail** fica no padrão — é ele que o teste de 429 real estoura.

## Referências
- Backend: UC49, UC50, UC51, ADR-0018
