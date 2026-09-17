# FUC10 - Completar cadastro

## Objetivo
Tela acessada pelo link recebido por email, onde o visitante informa nome
e senha pra finalizar a criação da conta.

## Referência backend
UC23 — `POST /api/registration/{token}/complete` (conferir rota exata no
Swagger)

## Rota
`/cadastro/completar?token=...` — o token vem da query string do link
recebido por email.

## Campos do formulário
- Nome (texto, obrigatório)
- Senha (senha, obrigatório, mínimo 8 caracteres)

## Estados da tela
- Padrão: formulário com nome e senha
- Token inválido/inexistente (`REGISTRATION_TOKEN_INVALID`): mensagem
  clara + link pra solicitar um cadastro novo (`/cadastro`)
- Token expirado (`REGISTRATION_TOKEN_EXPIRED`): mensagem "Esse link
  expirou" + link pra solicitar um novo
- Token já usado (`REGISTRATION_TOKEN_ALREADY_USED`): mensagem "Esse
  cadastro já foi concluído" + link pro `/login`
- Enviando: botão desabilitado
- Sucesso: redireciona pro `/login` com mensagem de confirmação

## Navegação
- Em qualquer erro de token, oferece caminho claro (voltar pro cadastro
  ou ir pro login) — nunca deixa o visitante travado sem próximo passo

## Definição de pronto
- [ ] Tela reflete o padrão visual já estabelecido
- [ ] Conclusão bem-sucedida redireciona pro `/login`
- [ ] Os três estados de erro de token tratados corretamente, cada um com
  seu próprio texto e próximo passo
- [ ] Erros de validação de nome/senha exibidos corretamente
- [ ] Teste E2E (Playwright) cobrindo: fluxo completo de ponta a ponta
  (solicitar → pegar link do Mailpit → completar → logar), token
  expirado, e token já usado

## Referências
- Backend: UC23, ADR-0009
- FUC01 (solicitar cadastro, etapa anterior)