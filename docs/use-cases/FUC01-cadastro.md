# FUC01 (revisado) - Solicitar cadastro

## Objetivo
Permitir que um visitante inicie o cadastro informando só o email, e
receba um link por email pra completar.

## Referência backend
UC01 revisado — `POST /api/registration` (conferir nome exato da rota no
Swagger depois de implementado)

## Campos do formulário
- Email (texto, obrigatório, formato de email)

## Estados da tela
- Padrão: formulário só com o campo de email
- Enviando: botão desabilitado
- Erro `EMAIL_ALREADY_REGISTERED`: "Já existe uma conta com esse email"
- Sucesso: tela muda pra "Verifique seu email" — mensagem explicando que
  um link foi enviado, válido por 24h, com botão "Reenviar" (chama o
  mesmo endpoint de novo)

## Navegação
- Link "Já tem conta? Entrar" leva pro `/login`
- Depois de "Verifique seu email", não há próxima tela nesse fluxo — o
  próximo passo acontece quando o visitante clica no link do email
  (FUC10, tela separada)

## Definição de pronto
- [ ] Tela reflete a nova estrutura (só email, depois "verifique seu email")
- [ ] Erro de email duplicado exibido corretamente
- [ ] Botão "Reenviar" funciona
- [ ] Teste E2E (Playwright) cobrindo o fluxo principal e o reenvio —
  lendo o link direto do Mailpit (mesmo padrão já usado no teste de troca
  de email), não exigindo interação manual

## Referências
- Backend: UC01 revisado, ADR-0009
- FUC10 (completar cadastro, próxima etapa)