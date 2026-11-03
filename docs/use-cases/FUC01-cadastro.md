# FUC01 (revisado) - Solicitar cadastro

## Objetivo
Permitir que um visitante inicie o cadastro informando só o email, e
receba um link por email pra completar.

## Referência backend
UC01 revisado — `POST /api/users/registration` (202). A resposta é **sempre a
mesma**, exista ou não conta com o email (o backend não devolve mais
`EMAIL_ALREADY_REGISTERED` aqui): se o email já tem conta, nenhum link é gerado
e o dono recebe só um aviso por email. O email é normalizado para minúsculas.

## Campos do formulário
- Email (texto, obrigatório, formato de email)

## Estados da tela
- Padrão: formulário só com o campo de email
- Enviando: botão desabilitado
- Sucesso (sempre, com conta ou sem): tela muda pra "Verifique seu email" com a
  mensagem neutra "Se o e-mail puder ser cadastrado, enviamos um link para
  continuar. Confira sua caixa de entrada.", com botão "Reenviar" (chama o
  mesmo endpoint de novo). A tela nunca revela se o email já tem conta.
- 429: mensagem padrão do projeto (`src/lib/rateLimit.ts`)

## Navegação
- Link "Já tem conta? Entrar" leva pro `/login`
- Depois de "Verifique seu email", não há próxima tela nesse fluxo — o
  próximo passo acontece quando o visitante clica no link do email
  (FUC10, tela separada)

## Definição de pronto
- [ ] Tela reflete a nova estrutura (só email, depois "verifique seu email")
- [ ] Email já cadastrado mostra a mesma tela de um email novo (sem revelar a conta)
- [ ] Botão "Reenviar" funciona
- [ ] Teste E2E (Playwright) cobrindo o fluxo principal e o reenvio —
  lendo o link direto do Mailpit (mesmo padrão já usado no teste de troca
  de email), não exigindo interação manual; e para email já cadastrado, o
  aviso ao dono (sem link) e a tela idêntica à de um email novo

## Referências
- Backend: UC01 revisado, ADR-0009
- FUC10 (completar cadastro, próxima etapa)